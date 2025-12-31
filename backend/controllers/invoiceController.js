const { Invoice, InvoiceItem, Apartment, FeeConfig, Usage } = require('../models');
const { Op } = require('sequelize');

// --- HÀM HELPER: TÍNH GIÁ LŨY TIẾN ---
const calculateTieredFee = (usage, tierConfig) => {
    if (!tierConfig || !Array.isArray(tierConfig) || usage <= 0) {
        return { total: 0, breakdown: [] };
    }

    let totalAmount = 0;
    let remainingUsage = usage;
    let previousLimit = 0;
    let breakdown = [];

    for (let i = 0; i < tierConfig.length; i++) {
        const tier = tierConfig[i];
        const limit = tier.limit; 
        const price = tier.price;

        if (remainingUsage <= 0) break;

        let usageInTier;
        
        if (limit === null) {
            usageInTier = remainingUsage; 
        } else {
            const gap = limit - previousLimit;
            usageInTier = Math.min(remainingUsage, gap);
        }

        const cost = usageInTier * price;
        totalAmount += cost;

        breakdown.push({
            tierIndex: i + 1,
            usage: usageInTier,
            price: price,
            cost: cost
        });

        remainingUsage -= usageInTier;
        if (limit !== null) previousLimit = limit;
    }

    return { total: totalAmount, breakdown };
};

// ==========================================
// 1. API: TẠO HÓA ĐƠN HÀNG LOẠT (SMART UPDATE - CÁCH 2)
// ==========================================
exports.generateInvoices = async (req, res) => {
    const { month, year } = req.body;

    try {
        // --- BỎ CHECK CŨ: Không chặn nếu hóa đơn đã tồn tại ---
        // const existingInvoices = await Invoice.findOne... (ĐÃ XÓA)

        const apartments = await Apartment.findAll();
        const activeFees = await FeeConfig.findAll({ where: { is_active: true } });

        let countCreated = 0;
        let countUpdated = 0;

        for (const apt of apartments) {
            // 1. Tìm hoặc Tạo hóa đơn cho căn hộ này (Trạng thái DRAFT)
            const [invoice, created] = await Invoice.findOrCreate({
                where: { 
                    apartment_code: apt.code, 
                    month, 
                    year 
                },
                defaults: {
                    apartment_code: apt.code,
                    owner_name: apt.owner_name,
                    month,
                    year,
                    total_amount: 0,
                    status: 'DRAFT'
                }
            });

            // Quan trọng: Nếu hóa đơn đã thanh toán hoặc chờ duyệt (PENDING/PAID), bỏ qua không sửa
            if (invoice.status !== 'DRAFT') continue;

            // 2. Lấy chỉ số điện nước
            const usageRecord = await Usage.findOne({ 
                where: { apartment_code: apt.code, month, year } 
            });
            const electricUsed = usageRecord ? (usageRecord.new_electric - usageRecord.old_electric) : 0;
            const waterUsed = usageRecord ? (usageRecord.new_water - usageRecord.old_water) : 0;

            let addedAmount = 0;

            // 3. Duyệt qua các loại phí để thêm vào
            for (const fee of activeFees) {
                // Kiểm tra xem phí này đã có trong hóa đơn chưa (để tránh cộng trùng)
                const existingItem = await InvoiceItem.findOne({
                    where: {
                        invoiceId: invoice.id, // Sử dụng invoiceId khớp với Model
                        fee_name: fee.name
                    }
                });

                if (existingItem) continue; // Đã có rồi thì bỏ qua

                // --- TÍNH TOÁN PHÍ ---
                let amount = 0;
                let quantity = 0;
                let metaData = null;
                let description = fee.calc_method;

                if (fee.calc_method === 'FLAT') {
                    quantity = 1;
                    amount = fee.unit_price;

                } else if (fee.calc_method === 'PER_M2') {
                    quantity = apt.area;
                    amount = fee.unit_price * apt.area;

                } else if (fee.calc_method === 'PER_UNIT') {
                    if (fee.name.toLowerCase().includes('điện')) quantity = electricUsed;
                    else if (fee.name.toLowerCase().includes('nước')) quantity = waterUsed;
                    else quantity = 1; 
                    amount = fee.unit_price * quantity;

                } else if (fee.calc_method === 'TIERED') {
                    if (fee.name.toLowerCase().includes('điện')) quantity = electricUsed;
                    else if (fee.name.toLowerCase().includes('nước')) quantity = waterUsed;
                    else quantity = 0;

                    const result = calculateTieredFee(quantity, fee.tier_config);
                    amount = result.total;
                    metaData = result.breakdown;
                    description = 'Tính theo bậc thang';
                }

                // Lưu vào DB nếu có tiền
                if (amount > 0 || fee.calc_method === 'FLAT') {
                    await InvoiceItem.create({
                        invoiceId: invoice.id,
                        fee_name: fee.name,
                        description: description,
                        quantity: quantity,
                        unit_price: fee.unit_price || 0,
                        amount: amount,
                        details: metaData
                    });
                    addedAmount += amount;
                }
            }

            // 4. Cập nhật tổng tiền Invoice
            if (addedAmount > 0) {
                // Ép kiểu float để cộng cho chính xác
                const currentTotal = parseFloat(invoice.total_amount) || 0;
                invoice.total_amount = currentTotal + addedAmount;
                await invoice.save();
                
                if (created) countCreated++; else countUpdated++;
            }
        }

        res.json({ 
            message: `Hoàn tất chốt sổ tháng ${month}/${year}.`,
            details: `Tạo mới: ${countCreated}, Cập nhật thêm phí: ${countUpdated}`
        });

    } catch (err) {
        console.error("Lỗi tạo hóa đơn:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 2. API: TÌM KIẾM HÓA ĐƠN
// ==========================================
exports.searchInvoices = async (req, res) => {
    const { code, month, year } = req.query;

    try {
        const aptWhere = {};
        if (code) {
            aptWhere.code = { [Op.iLike]: `%${code}%` };
        }

        const apartments = await Apartment.findAll({
            where: aptWhere,
            include: [{
                model: Invoice,
                required: false, // Left Join
                where: { month, year },
                include: [{ 
                    model: InvoiceItem, 
                    as: 'InvoiceItems' // Giữ nguyên alias đã fix
                }] 
            }],
            order: [['code', 'ASC']]
        });

        const results = apartments.map(apt => {
            const inv = apt.Invoices && apt.Invoices.length > 0 ? apt.Invoices[0] : null;

            if (inv) {
                return {
                    ...inv.toJSON(),
                    owner_name: apt.owner_name,
                    status: inv.status
                };
            } else {
                return {
                    id: null,
                    code: apt.code,
                    apartment_code: apt.code,
                    owner_name: apt.owner_name,
                    month: parseInt(month),
                    year: parseInt(year),
                    total_amount: 0,
                    status: 'NOT_CREATED',
                    InvoiceItems: []
                };
            }
        });

        res.json(results);

    } catch (err) {
        console.error("Lỗi tìm kiếm:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 3. API: THÊM KHOẢN THU LẺ
// ==========================================
exports.addAdHocItem = async (req, res) => {
    const { apartment_codes, fee_name, amount, description, month, year } = req.body;

    if (!apartment_codes || !Array.isArray(apartment_codes) || apartment_codes.length === 0) {
        return res.status(400).json({ message: "Vui lòng chọn ít nhất một căn hộ!" });
    }

    const results = { success: [], failed: [] };

    try {
        for (const code of apartment_codes) {
            try {
                const apartment = await Apartment.findOne({ where: { code } });
                if (!apartment) {
                    results.failed.push({ code, reason: "Không tìm thấy căn hộ" });
                    continue;
                }

                const [invoice, created] = await Invoice.findOrCreate({
                    where: { 
                        apartment_code: code, 
                        month, 
                        year, 
                        status: 'DRAFT' 
                    },
                    defaults: {
                        apartment_code: code,
                        // owner_name: apartment.owner_name, 
                        month,
                        year,
                        total_amount: 0,
                        status: 'DRAFT'
                    }
                });

                await InvoiceItem.create({
                    invoiceId: invoice.id,
                    fee_name: fee_name,
                    description: description || 'Phí phát sinh',
                    quantity: 1,
                    unit_price: amount,
                    amount: amount,
                    details: null
                });

                const currentTotal = parseFloat(invoice.total_amount);
                const addAmount = parseFloat(amount);
                invoice.total_amount = currentTotal + addAmount;
                
                await invoice.save();
                results.success.push(code);

            } catch (innerError) {
                console.error(`Lỗi xử lý căn ${code}:`, innerError);
                results.failed.push({ code, reason: innerError.message });
            }
        }

        res.json({ 
            message: `Đã xử lý xong. Thành công: ${results.success.length}, Lỗi: ${results.failed.length}`,
            data: results 
        });

    } catch (err) {
        console.error("Lỗi hệ thống:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 4. CÁC API KHÁC
// ==========================================
exports.publishInvoices = async (req, res) => {
    const { month, year } = req.body;
    try {
        // Chỉ chuyển đổi những hóa đơn đang là DRAFT sang PENDING
        const [updatedCount] = await Invoice.update(
            { status: 'PENDING' }, 
            { 
                where: { 
                    month, 
                    year, 
                    status: 'DRAFT' 
                } 
            }
        );

        if (updatedCount === 0) {
            return res.status(400).json({ message: "Không có hóa đơn nháp nào để phát hành hoặc tất cả đã được phát hành." });
        }

        res.json({ message: `Đã phát hành thành công ${updatedCount} hóa đơn.` });
    } catch (err) {
        console.error("Lỗi phát hành:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.payInvoice = async (req, res) => {
    const { id } = req.params;
    const { method } = req.body; 
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