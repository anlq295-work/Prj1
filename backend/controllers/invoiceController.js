const { sequelize, Invoice, InvoiceItem, Apartment, Household, FeeConfig, FeeType, MeterReading, BillingPeriod, Payment } = require('../models');
const { Op } = require('sequelize');
const { calculateTieredFee } = require('../services/BillCalculator');

// ==========================================
// 1. API: TẠO BIÊN LAI (CHỐT SỔ)
// ==========================================
exports.generateInvoices = async (req, res) => {
    const { month, year } = req.body;
    
    // Sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
    const t = await sequelize.transaction();

    try {
        console.log(`--- BẮT ĐẦU TÍNH PHÍ THÁNG ${month}/${year} ---`);

        // A. Tìm/Tạo Kỳ thu
        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { status: 'OPEN', month, year },
            transaction: t
        });

        if (period.status === 'CLOSED') {
            await t.rollback();
            return res.status(400).json({ message: "Kỳ thu này đã đóng, không thể chốt sổ lại!" });
        }

        // B. Lấy danh sách CĂN HỘ CÓ NGƯỜI Ở (Occupied Apartments)
        // Logic: Chỉ lấy căn hộ có liên kết với Household đang ACTIVE
        const occupiedApartments = await Apartment.findAll({
            include: [{
                model: Household,
                where: { status: 'ACTIVE' }, // Chỉ lấy hộ đang ở
                required: true // INNER JOIN: Loại bỏ căn hộ trống
            }],
            transaction: t
        });

        console.log(`📋 Tìm thấy ${occupiedApartments.length} căn hộ có người ở.`);

        if (occupiedApartments.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: "Không có căn hộ nào đang có người ở để tính phí." });
        }

        // C. Lấy cấu hình phí đang hoạt động
        const activeConfigs = await FeeConfig.findAll({
            where: { is_active: true },
            include: [{ model: FeeType }],
            transaction: t
        });

        if (activeConfigs.length === 0) {
            console.log("⚠️ CẢNH BÁO: Không tìm thấy cấu hình phí nào đang hoạt động!");
        }

        let countCreated = 0;
        let countUpdated = 0;

        // D. Duyệt từng căn hộ để tính phí
        for (const apt of occupiedApartments) {
            // Lấy thông tin hộ dân (Do đã include ở trên nên chắc chắn có phần tử [0])
            const household = apt.Households[0]; 
            
            // 1. Kiểm tra xem đã có hóa đơn ĐÃ THANH TOÁN chưa
            const existingInvoice = await Invoice.findOne({
                where: { 
                    household_id: household.id,
                    billing_period_id: period.id 
                },
                transaction: t
            });

            // Nếu đã thanh toán rồi thì bỏ qua, không tính lại để tránh sai lệch
            if (existingInvoice && existingInvoice.status === 'PAID') {
                continue; 
            }

            // 2. Tạo hoặc Lấy hóa đơn (Draft/Pending)
            const [invoice, created] = await Invoice.findOrCreate({
                where: { 
                    household_id: household.id,
                    billing_period_id: period.id
                },
                defaults: {
                    apartment_id: apt.id,
                    total_amount: 0,
                    status: 'DRAFT',
                    owner_name: household.representative_name // Lưu tên chủ hộ tại thời điểm chốt
                },
                transaction: t
            });

            // Nếu là cập nhật lại (không phải tạo mới), xóa các item cũ để tính lại từ đầu
            if (!created) {
                await InvoiceItem.destroy({ where: { invoice_id: invoice.id }, transaction: t });
            }

            let invoiceTotal = 0;

            // 3. Tính toán từng loại phí
            for (const config of activeConfigs) {
                const feeType = config.FeeType; 
                
                if (!feeType) {
                    console.error(`❌ LỖI: Cấu hình phí ID ${config.id} bị mất liên kết FeeType.`);
                    continue;
                }

                let amount = 0;
                let quantity = 0;
                let details = null;
                let description = '';

                // --- Case 1: Phí Cố Định (Dịch vụ, Gửi xe...) ---
                if (config.calc_method === 'FIXED') {
                    if (feeType.unit === 'm2') {
                        quantity = apt.area || 0;
                        amount = parseFloat(config.unit_price) * parseFloat(quantity);
                        description = `Diện tích: ${quantity} m2`;
                    } else {
                        quantity = 1;
                        amount = parseFloat(config.unit_price);
                        description = 'Phí trọn gói tháng';
                    }
                } 
                // --- Case 2: Phí Bậc Thang (Điện/Nước) ---
                else if (config.calc_method === 'TIERED') {
                    // Tìm chỉ số điện/nước của tháng này
                    const reading = await MeterReading.findOne({
                        where: {
                            apartment_id: apt.id,
                            billing_period_id: period.id,
                            fee_type_id: feeType.id
                        },
                        transaction: t
                    });

                    if (reading) {
                        quantity = reading.new_value - reading.old_value;
                        if (quantity < 0) quantity = 0; // Đề phòng lỗi âm

                        // Gọi service tính bậc thang
                        const result = calculateTieredFee(quantity, config.tier_config);
                        amount = result.total;
                        details = result.breakdown;
                        description = `Tiêu thụ: ${quantity} ${feeType.unit} (Cũ: ${reading.old_value} - Mới: ${reading.new_value})`;
                    } else {
                        // Nếu không có chỉ số -> Coi như không dùng (0 đồng)
                        amount = 0;
                    }
                }

                // Lưu dòng phí vào InvoiceItem
                if (amount > 0) {
                    await InvoiceItem.create({
                        invoice_id: invoice.id,
                        fee_type_id: feeType.id,
                        fee_name: config.name,
                        unit_price: config.calc_method === 'FIXED' ? config.unit_price : 0,
                        quantity: quantity,
                        amount: amount,
                        details: details,
                        description: description
                    }, { transaction: t });
                    
                    invoiceTotal += amount;
                }
            }

            // Cập nhật tổng tiền
            invoice.total_amount = invoiceTotal;
            await invoice.save({ transaction: t });
            
            created ? countCreated++ : countUpdated++;
        }

        await t.commit();
        console.log("--- HOÀN TẤT TÍNH PHÍ ---");
        
        res.json({ 
            message: `Hoàn tất chốt sổ tháng ${month}/${year}.`,
            details: `Đã xử lý ${occupiedApartments.length} căn hộ. Tạo mới: ${countCreated}, Cập nhật: ${countUpdated}`
        });

    } catch (err) {
        await t.rollback();
        console.error("Generate Error:", err);
        res.status(500).json({ error: "Lỗi Server: " + err.message });
    }
};

// ==========================================
// 2. API: TÌM KIẾM BIÊN LAI (ADMIN)
// ==========================================
exports.searchInvoices = async (req, res) => {
    const { code, month, year } = req.query;
    try {
        const period = await BillingPeriod.findOne({ where: { month, year } });
        
        let whereClause = {};
        if (period) whereClause.billing_period_id = period.id;
        else return res.json([]); 

        const invoices = await Invoice.findAll({
            where: whereClause,
            include: [
                { 
                    model: Household, 
                    as: 'Household',
                    include: [{ 
                        model: Apartment, 
                        as: 'Apartment',
                        where: code ? { code: { [Op.iLike]: `%${code}%` } } : {} 
                    }]
                },
                {
                    model: InvoiceItem,
                    as: 'InvoiceItems',
                    // [QUAN TRỌNG] Include FeeType để Frontend phân loại phí
                    include: [{ model: FeeType }] 
                }
            ],
            order: [
                [{ model: Household, as: 'Household' }, { model: Apartment, as: 'Apartment' }, 'code', 'ASC']
            ]
        });

        // Format lại dữ liệu trả về cho gọn
        const results = invoices
            .filter(inv => inv.Household && inv.Household.Apartment) 
            .map(inv => ({
                id: inv.id,
                apartment_code: inv.Household.Apartment.code,
                owner_name: inv.Household.owner_name,
                month: month,
                year: year,
                total_amount: inv.total_amount,
                status: inv.status,
                items: inv.InvoiceItems 
            }));

        res.json(results);

    } catch (err) {
        console.error("Search Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 3. API: PHÁT HÀNH BIÊN LAI
// ==========================================
exports.publishInvoices = async (req, res) => {
    const { month, year } = req.body;
    try {
        const period = await BillingPeriod.findOne({ where: { month, year } });
        if (!period) return res.status(404).json({ message: "Chưa có kỳ thu." });

        const [count] = await Invoice.update(
            { status: 'PENDING' }, 
            { where: { billing_period_id: period.id, status: 'DRAFT' } }
        );
        res.json({ message: `Đã phát hành ${count} biên lai.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 4. API: THÊM PHÍ LẺ (Dùng Category: OTHER)
// ==========================================
exports.addAdHocItem = async (req, res) => {
    const { apartment_codes, fee_name, amount, description, month, year } = req.body;
    
    // Tạo timestamp để phân biệt trong mô tả
    const timeStamp = new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

    console.log(`\n--- THÊM PHÍ LẺ: "${fee_name}" ---`);

    const t = await sequelize.transaction();

    try {
        if (!apartment_codes || apartment_codes.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: "Chưa chọn căn hộ nào." });
        }

        // 1. Tìm/Tạo kỳ thu
        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { status: 'OPEN', month, year },
            transaction: t
        });

        if (period.status === 'CLOSED') {
            await t.rollback();
            return res.status(400).json({ message: "Kỳ thu này đã đóng sổ hoàn toàn." });
        }

        // 2. Lấy loại phí chung (Generic)
        let genericFeeType = await FeeType.findOne({ where: { category: 'OTHER' } });
        if (!genericFeeType) {
            genericFeeType = await FeeType.create({
                name: 'Phí phát sinh khác', category: 'OTHER', unit: 'Lần', description: 'Khoản thu mặc định'
            }, { transaction: t });
        }

        let successCount = 0;
        let failList = [];

        for (const code of apartment_codes) {
            const cleanCode = code.trim(); 
            
            // Tìm căn hộ (Không phân biệt hoa thường)
            const apartment = await Apartment.findOne({ 
                where: { code: { [Op.iLike]: cleanCode } } 
            });

            if (!apartment) {
                failList.push(`${cleanCode} (Sai mã)`);
                continue;
            }

            const household = await Household.findOne({
                where: { apartment_id: apartment.id, status: 'ACTIVE' }
            });

            if (!household) {
                failList.push(`${cleanCode} (Trống)`);
                continue;
            }

            // --- [LOGIC ĐA HÓA ĐƠN] ---
            // Tìm xem có hóa đơn nào ĐANG MỞ (PENDING hoặc DRAFT) không
            let invoice = await Invoice.findOne({
                where: {
                    household_id: household.id,
                    billing_period_id: period.id,
                    status: { [Op.in]: ['PENDING', 'DRAFT'] } // Chỉ lấy cái chưa đóng tiền
                },
                transaction: t
            });

            // Nếu KHÔNG CÓ (tức là chưa có, hoặc cái cũ đã PAID) -> TẠO MỚI
            if (!invoice) {
                console.log(`💡 Căn ${cleanCode}: Tạo hóa đơn bổ sung.`);
                invoice = await Invoice.create({
                    household_id: household.id,
                    billing_period_id: period.id,
                    apartment_id: apartment.id,
                    total_amount: 0,
                    status: 'PENDING',
                    payment_method: 'CASH',
                    owner_name: household.representative_name
                }, { transaction: t });
            }

            // 3. Tạo dòng phí
            const itemAmount = parseFloat(amount);
            
            await InvoiceItem.create({
                invoice_id: invoice.id,
                fee_type_id: genericFeeType.id, 
                fee_name: fee_name,             
                unit_price: itemAmount,
                quantity: 1,
                amount: itemAmount,
                description: description ? `${description} (${timeStamp})` : `Thêm lúc ${timeStamp}`
            }, { transaction: t });

            // 4. Cập nhật tổng tiền
            await invoice.increment('total_amount', { by: itemAmount, transaction: t });
            
            successCount++;
        }

        await t.commit();
        
        if (successCount === 0) {
            return res.status(400).json({ message: "Không thêm được.", details: failList });
        }

        res.json({ 
            message: `Thành công ${successCount} căn.`,
            failed: failList.length > 0 ? failList : null
        });

    } catch (err) {
        await t.rollback();
        console.error("AdHoc Error:", err);
        res.status(500).json({ error: "Lỗi Server: " + err.message });
    }
};

// ==========================================
// 5. API: CẬP NHẬT CHI TIẾT BIÊN LAI
// ==========================================
exports.updateInvoice = async (req, res) => {
    const { id } = req.params;
    const { items } = req.body;
    const t = await sequelize.transaction();

    try {
        const invoice = await Invoice.findByPk(id);
        if (!invoice) throw new Error("Không tìm thấy biên lai");
        if (invoice.status === 'PAID') throw new Error("Biên lai đã thanh toán, không thể sửa.");

        let newTotal = 0;
        for (const item of items) {
            if (item.id) {
                await InvoiceItem.update({
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    amount: item.amount,
                    description: item.description,
                    fee_name: item.fee_name // Cho phép sửa tên phí
                }, { where: { id: item.id }, transaction: t });
                newTotal += parseFloat(item.amount);
            }
        }

        invoice.total_amount = newTotal;
        await invoice.save({ transaction: t });

        await t.commit();
        res.json({ message: "Cập nhật thành công!", total_amount: newTotal });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 6. API: XÁC NHẬN THANH TOÁN
// ==========================================
exports.payInvoice = async (req, res) => {
    const { id } = req.params;
    const t = await sequelize.transaction();

    try {
        const invoice = await Invoice.findByPk(id);

        if (!invoice) {
            await t.rollback();
            return res.status(404).json({ message: "Không tìm thấy biên lai" });
        }

        if (invoice.status === 'PAID') {
            await t.rollback();
            return res.status(400).json({ message: "Biên lai này đã thanh toán rồi!" });
        }

        // Cập nhật trạng thái
        invoice.status = 'PAID';
        invoice.paid_amount = invoice.total_amount;
        invoice.payment_method = 'CASH'; 
        await invoice.save({ transaction: t });

        // Lưu lịch sử
        await Payment.create({
            invoice_id: invoice.id,
            amount: invoice.total_amount,
            method: 'CASH',
            transaction_code: 'ADMIN_MANUAL',
            note: 'Admin xác nhận thu tiền trực tiếp',
            paid_at: new Date()
        }, { transaction: t });

        await t.commit();
        res.json({ message: "Xác nhận thanh toán thành công!" });

    } catch (err) {
        await t.rollback();
        res.status(500).json({ message: "Lỗi Server: " + err.message });
    }
};

// ==========================================
// 7. API TRA CỨU CÔNG KHAI (PUBLIC)
// ==========================================
exports.getPublicInvoices = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ message: "Vui lòng nhập mã căn hộ." });
    }

    try {
        const apartment = await Apartment.findOne({ where: { code } });
        if (!apartment) {
            return res.status(404).json({ message: "Không tìm thấy căn hộ này." });
        }

        const invoices = await Invoice.findAll({
            where: { 
                apartment_id: apartment.id,
                status: { [Op.in]: ['PENDING', 'PAID'] } 
            },
            include: [
                { model: Household, as: 'Household' },
                { 
                    model: InvoiceItem, 
                    as: 'InvoiceItems',
                    include: [{ model: FeeType }] // Lấy FeeType để phân loại
                },
                { model: BillingPeriod } 
            ],
            order: [
                [ { model: BillingPeriod }, 'year', 'DESC'],
                [ { model: BillingPeriod }, 'month', 'DESC']
            ]
        });

        const results = invoices.map(inv => {
            const period = inv.BillingPeriod || {}; 
            return {
                id: inv.id,
                apartment_code: code,
                owner_name: inv.Household ? inv.Household.owner_name : "Unknown",
                month: period.month, 
                year: period.year,
                total_amount: inv.total_amount,
                status: inv.status,
                items: inv.InvoiceItems,
                created_at: inv.createdAt
            };
        });

        res.json(results);

    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
    }
};

// ==========================================
// 8. API THANH TOÁN CÔNG KHAI
// ==========================================
exports.publicPayInvoice = async (req, res) => {
    const { id } = req.params;
    const { transaction_code, payment_method, note } = req.body;
    const t = await sequelize.transaction();

    try {
        const invoice = await Invoice.findByPk(id);
        if (!invoice) {
            await t.rollback();
            return res.status(404).json({ message: "Không tìm thấy biên lai." });
        }

        if (invoice.status === 'PAID') {
            await t.rollback();
            return res.status(400).json({ message: "Biên lai này đã được thanh toán rồi." });
        }

        invoice.status = 'PAID';
        invoice.paid_amount = invoice.total_amount;
        invoice.payment_method = payment_method || 'TRANSFER';
        await invoice.save({ transaction: t });

        await Payment.create({
            invoice_id: invoice.id,
            amount: invoice.total_amount,
            method: payment_method || 'TRANSFER',
            transaction_code: transaction_code || 'SELF-CONFIRM',
            note: note || 'Cư dân tự xác nhận',
            paid_at: new Date()
        }, { transaction: t });

        await t.commit();
        res.json({ message: "Thanh toán thành công! Cảm ơn bạn." });

    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: "Lỗi xử lý thanh toán." });
    }
};

// ==========================================
// 9. API: XÓA KHOẢN THU
// ==========================================
exports.deleteInvoice = async (req, res) => {
    const { id } = req.params;
    const t = await sequelize.transaction();

    try {
        const invoice = await Invoice.findByPk(id);

        if (!invoice) {
            await t.rollback();
            return res.status(404).json({ message: "Không tìm thấy khoản thu." });
        }

        if (invoice.status === 'PAID') {
            await t.rollback();
            return res.status(400).json({ message: "Khoản thu đã thanh toán, không thể xóa." });
        }

        await InvoiceItem.destroy({ where: { invoice_id: id }, transaction: t });
        await invoice.destroy({ transaction: t });

        await t.commit();
        res.json({ message: "Đã xóa khoản thu thành công." });

    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: "Lỗi Server: " + err.message });
    }
};