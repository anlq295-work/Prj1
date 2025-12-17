// controllers/invoiceController.js
const { Invoice, InvoiceItem, Apartment, FeeConfig, Usage } = require('../models');
const { Op } = require('sequelize');

// --- HÀM HELPER: TÍNH GIÁ LŨY TIẾN ---
/**
 * Logic tính toán giá điện/nước theo bậc thang
 * Trả về: { total: số tiền, breakdown: mảng chi tiết các bậc }
 */
const calculateTieredFee = (usage, tierConfig) => {
    // Validate đầu vào
    if (!tierConfig || !Array.isArray(tierConfig) || usage <= 0) {
        return { total: 0, breakdown: [] };
    }

    let totalAmount = 0;
    let remainingUsage = usage;
    let previousLimit = 0;
    let breakdown = [];

    for (let i = 0; i < tierConfig.length; i++) {
        const tier = tierConfig[i];
        const limit = tier.limit; // Ngưỡng trên (null nghĩa là vô cực/bậc cuối)
        const price = tier.price;

        if (remainingUsage <= 0) break;

        let usageInTier;
        
        // Xác định lượng dùng ở bậc hiện tại
        if (limit === null) {
            usageInTier = remainingUsage; // Bậc cuối (không giới hạn)
        } else {
            const gap = limit - previousLimit;
            usageInTier = Math.min(remainingUsage, gap);
        }

        const cost = usageInTier * price;
        totalAmount += cost;

        // Lưu chi tiết bậc để hiển thị ở Frontend
        breakdown.push({
            tierIndex: i + 1,
            usage: usageInTier,
            price: price,
            cost: cost
        });

        // Trừ đi số lượng đã tính
        remainingUsage -= usageInTier;
        if (limit !== null) previousLimit = limit;
    }

    return { total: totalAmount, breakdown };
};

// ==========================================
// 1. API: TẠO HÓA ĐƠN HÀNG LOẠT (CHỐT SỔ)
// ==========================================
exports.generateInvoices = async (req, res) => {
    // Input: { "month": 10, "year": 2025 }
    const { month, year } = req.body;

    try {
        // Kiểm tra xem tháng này đã chốt chưa
        const existingInvoices = await Invoice.findOne({ where: { month, year } });
        if (existingInvoices) {
            // Lưu ý: Tùy logic, bạn có thể return lỗi hoặc cho phép ghi đè (ở đây mình chặn để an toàn)
            return res.status(400).json({ message: `Hóa đơn cho tháng ${month}/${year} đã tồn tại!` });
        }

        // Lấy dữ liệu nguồn
        const apartments = await Apartment.findAll(); // Lấy tất cả căn hộ
        const activeFees = await FeeConfig.findAll({ where: { is_active: true } }); // Lấy phí đang kích hoạt

        const invoicesData = [];

        // Vòng lặp xử lý từng căn hộ
        for (const apt of apartments) {
            
            // Lấy chỉ số điện nước (Nếu chưa có bản ghi Usage thì coi như dùng = 0)
            const usageRecord = await Usage.findOne({ 
                where: { apartment_code: apt.code, month, year } 
            });

            const electricUsed = usageRecord ? (usageRecord.new_electric - usageRecord.old_electric) : 0;
            const waterUsed = usageRecord ? (usageRecord.new_water - usageRecord.old_water) : 0;

            let totalBill = 0;
            const items = [];

            // Duyệt qua từng loại phí cấu hình
            for (const fee of activeFees) {
                let amount = 0;
                let quantity = 0;
                let metaData = null; // Biến lưu cấu trúc JSON chi tiết (quan trọng cho Lũy tiến)
                let description = fee.calc_method;

                // --- LOGIC TÍNH TOÁN ---
                if (fee.calc_method === 'FLAT') {
                    // Phí cố định (Internet, Rác...)
                    quantity = 1;
                    amount = fee.unit_price;

                } else if (fee.calc_method === 'PER_M2') {
                    // Phí theo diện tích (Phí quản lý)
                    quantity = apt.area;
                    amount = fee.unit_price * apt.area;

                } else if (fee.calc_method === 'PER_UNIT') {
                    // Phí theo chỉ số (Nhân thẳng đơn giá)
                    if (fee.name.toLowerCase().includes('điện')) quantity = electricUsed;
                    else if (fee.name.toLowerCase().includes('nước')) quantity = waterUsed;
                    else quantity = 1; 

                    amount = fee.unit_price * quantity;

                } else if (fee.calc_method === 'TIERED') {
                    // Phí Lũy tiến (Điện/Nước sinh hoạt)
                    if (fee.name.toLowerCase().includes('điện')) quantity = electricUsed;
                    else if (fee.name.toLowerCase().includes('nước')) quantity = waterUsed;
                    else quantity = 0;

                    // Gọi hàm helper tính toán
                    const result = calculateTieredFee(quantity, fee.tier_config);
                    
                    amount = result.total;
                    metaData = result.breakdown; // Lưu mảng các bậc giá vào đây
                    description = 'Tính theo bậc thang';
                }

                // Nếu có phát sinh tiền thì thêm vào danh sách items
                if (amount > 0 || fee.calc_method === 'FLAT') {
                    items.push({
                        fee_name: fee.name,
                        description: description,
                        quantity: quantity,
                        unit_price: fee.unit_price || 0,
                        amount: amount,
                        details: metaData // Lưu JSON vào DB (cần cột details kiểu JSONB trong InvoiceItem)
                    });
                    totalBill += amount;
                }
            }

            // Chỉ tạo hóa đơn nếu có tổng tiền > 0
            if (totalBill > 0) {
                invoicesData.push({
                    apartment_code: apt.code,
                    owner_name: apt.owner_name, // Lưu tên chủ hộ tại thời điểm tạo
                    month: month,
                    year: year,
                    total_amount: totalBill,
                    status: 'DRAFT', // Trạng thái nháp
                    InvoiceItems: items // Sequelize sẽ tự động insert vào bảng con
                });
            }
        }

        // Lưu Bulk vào Database
        if (invoicesData.length > 0) {
            await Invoice.bulkCreate(invoicesData, { 
                include: [InvoiceItem] 
            });
            
            res.json({ 
                message: `Đã khởi tạo xong hóa đơn tháng ${month}/${year} cho ${invoicesData.length} căn hộ.`,
                count: invoicesData.length
            });
        } else {
            res.json({ message: "Không có dữ liệu sử dụng hoặc phí nào để tính toán." });
        }

    } catch (err) {
        console.error("Lỗi tạo hóa đơn:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 2. API: THÊM KHOẢN THU LẺ/PHÁT SINH (AD-HOC)
// ==========================================
exports.addAdHocItem = async (req, res) => {
    // Body: { apartment_code, fee_name, amount, description, month, year }
    const { apartment_code, fee_name, amount, description, month, year } = req.body;

    try {
        // Tìm hóa đơn NHÁP (DRAFT) của tháng này
        let invoice = await Invoice.findOne({
            where: { apartment_code, month, year, status: 'DRAFT' }
        });

        // Nếu chưa có hóa đơn (ví dụ đầu tháng chưa chốt sổ), thì tạo mới hóa đơn Nháp
        if (!invoice) {
            const apartment = await Apartment.findOne({ where: { code: apartment_code } });
            if (!apartment) return res.status(404).json({ message: "Không tìm thấy căn hộ này" });

            invoice = await Invoice.create({
                apartment_code,
                owner_name: apartment.owner_name,
                month,
                year,
                total_amount: 0,
                status: 'DRAFT'
            });
        }

        // Thêm dòng phí lẻ vào InvoiceItems
        const newItem = await InvoiceItem.create({
            invoice_id: invoice.id,
            fee_name: fee_name,
            description: description || 'Phí phát sinh',
            quantity: 1,
            unit_price: amount,
            amount: amount,
            details: null // Phí này nhập tay nên không có chi tiết bậc thang
        });

        // Cập nhật lại tổng tiền hóa đơn cha
        invoice.total_amount = parseFloat(invoice.total_amount) + parseFloat(amount);
        await invoice.save();

        res.json({ message: "Đã thêm khoản thu thành công!", data: newItem });

    } catch (err) {
        console.error("Lỗi thêm phí lẻ:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 3. API: TÌM KIẾM HÓA ĐƠN
// ==========================================
exports.searchInvoices = async (req, res) => {
    const { code, month, year } = req.query;

    const whereClause = {};
    if (code) whereClause.apartment_code = code;
    if (month) whereClause.month = month;
    if (year) whereClause.year = year;

    try {
        const result = await Invoice.findAll({
            where: whereClause,
            include: [InvoiceItem], // Lấy kèm chi tiết để xem được breakdown
            order: [['createdAt', 'DESC']]
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 4. API: PHÁT HÀNH HÓA ĐƠN (DRAFT -> PENDING)
// ==========================================
exports.publishInvoices = async (req, res) => {
    const { month, year } = req.body;
    try {
        // Chỉ cập nhật những hóa đơn đang là DRAFT
        const updated = await Invoice.update(
            { status: 'PENDING' }, 
            { where: { month, year, status: 'DRAFT' } }
        );
        
        res.json({ message: `Đã phát hành hóa đơn tháng ${month}/${year}. Số lượng: ${updated[0]}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 5. API: THANH TOÁN HÓA ĐƠN
// ==========================================
exports.payInvoice = async (req, res) => {
    const { id } = req.params;
    const { method } = req.body; // "CASH" hoặc "TRANSFER"
    
    try {
        const inv = await Invoice.findByPk(id);
        if (!inv) return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });

        inv.status = 'PAID';
        inv.payment_method = method;
        await inv.save();

        res.json({ message: 'Thanh toán thành công', invoice: inv });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};