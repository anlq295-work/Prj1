const { sequelize, Invoice, InvoiceItem, Apartment, Household, FeeConfig, FeeType, MeterReading, BillingPeriod } = require('../models');
const { Op } = require('sequelize');
// 1. IMPORT SERVICE TÍNH TOÁN (QUAN TRỌNG)
const { calculateTieredFee } = require('../services/BillCalculator');

// ==========================================
// API: TẠO HÓA ĐƠN (CHỐT SỔ)
// ==========================================
exports.generateInvoices = async (req, res) => {
    const { month, year } = req.body;
    const t = await sequelize.transaction(); // Transaction đảm bảo an toàn dữ liệu

    try {
        // 1. Tìm hoặc tạo KỲ THU
        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { status: 'OPEN', month, year },
            transaction: t
        });

        if (period.status === 'CLOSED') {
            await t.rollback();
            return res.status(400).json({ message: "Kỳ thu này đã đóng, không thể tính lại!" });
        }

        // 2. Lấy dữ liệu nền (Hộ dân & Cấu hình phí đang Active)
        const households = await Household.findAll({
            where: { status: 'ACTIVE' },
            include: [{ model: Apartment, as: 'Apartment' }], // Alias phải khớp models/index.js
            transaction: t
        });

        const activeConfigs = await FeeConfig.findAll({
            where: { is_active: true },
            include: [{ model: FeeType }],
            transaction: t
        });

        let countCreated = 0;
        let countUpdated = 0;

        // 3. Vòng lặp tính toán từng hộ
        for (const household of households) {
            // Tìm/Tạo hóa đơn nháp
            const [invoice, created] = await Invoice.findOrCreate({
                where: { 
                    household_id: household.id,
                    billing_period_id: period.id
                },
                defaults: {
                    apartment_id: household.apartment_id, // Lưu thêm cái này để query cho nhanh
                    total_amount: 0,
                    status: 'DRAFT'
                },
                transaction: t
            });

            if (invoice.status === 'PAID') continue; // Đã trả tiền thì không sửa nữa

            // Xóa chi tiết cũ để tính lại từ đầu (tránh cộng dồn sai)
            if (!created) {
                await InvoiceItem.destroy({ 
                    where: { invoice_id: invoice.id }, 
                    transaction: t 
                });
            }

            let invoiceTotal = 0;
            const apartmentId = household.apartment_id;

            // 4. Duyệt qua từng loại phí để tính tiền
            for (const config of activeConfigs) {
                const feeType = config.FeeType; 
                let amount = 0;
                let quantity = 0;
                let details = null; // Biến lưu chi tiết bậc thang (JSON)
                let description = '';

                // --- TRƯỜNG HỢP 1: PHÍ CỐ ĐỊNH (Rác, An ninh, Gửi xe cố định) ---
                if (config.calc_method === 'FIXED') {
                    if (feeType.unit === 'm2') {
                        // Phí theo diện tích
                        quantity = household.Apartment.area;
                        amount = parseFloat(config.unit_price) * parseFloat(quantity);
                        description = `Diện tích: ${quantity} m2`;
                    } else {
                        // Phí trọn gói (VD: Gửi xe tháng)
                        quantity = 1;
                        amount = parseFloat(config.unit_price);
                        description = 'Phí trọn gói tháng';
                    }
                } 
                
                // --- TRƯỜNG HỢP 2: PHÍ BẬC THANG (Điện, Nước) ---
                else if (config.calc_method === 'TIERED') {
                    // Tìm chỉ số trong bảng MeterReading (Thay cho Usage cũ)
                    const reading = await MeterReading.findOne({
                        where: {
                            apartment_id: apartmentId,
                            billing_period_id: period.id,
                            fee_type_id: feeType.id
                        },
                        transaction: t
                    });

                    if (reading) {
                        // Tính số lượng tiêu thụ
                        quantity = reading.new_value - reading.old_value;
                        if (quantity < 0) quantity = 0; // Tránh âm

                        // GỌI SERVICE TÍNH TOÁN
                        const result = calculateTieredFee(quantity, config.tier_config);
                        
                        amount = result.total;
                        details = result.breakdown; // Lưu mảng breakdown vào cột details
                        description = `Tiêu thụ: ${quantity} ${feeType.unit}`;
                    }
                }

                // Lưu dòng chi tiết (InvoiceItem) nếu có tiền
                if (amount > 0) {
                    await InvoiceItem.create({
                        invoice_id: invoice.id,
                        fee_type_id: feeType.id,
                        fee_name: config.name,  // Snapshot tên phí (VD: Điện 2024)
                        unit_price: config.calc_method === 'FIXED' ? config.unit_price : 0, // Bậc thang thì unit_price để 0
                        quantity: quantity,
                        amount: amount,
                        details: details, // PostgreSQL sẽ tự lưu thành JSONB
                        description: description
                    }, { transaction: t });
                    
                    invoiceTotal += amount;
                }
            }

            // Cập nhật tổng tiền hóa đơn
            invoice.total_amount = invoiceTotal;
            await invoice.save({ transaction: t });
            
            created ? countCreated++ : countUpdated++;
        }

        await t.commit();
        res.json({ 
            message: `Hoàn tất chốt sổ tháng ${month}/${year}.`,
            details: `Kỳ thu ID: ${period.id}. Tạo mới: ${countCreated}, Cập nhật: ${countUpdated}`
        });

    } catch (err) {
        await t.rollback();
        console.error("Lỗi tạo hóa đơn:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// API: TÌM KIẾM HÓA ĐƠN
// ==========================================
exports.searchInvoices = async (req, res) => {
    const { code, month, year } = req.query; // code là Mã Căn Hộ
    try {
        const period = await BillingPeriod.findOne({ where: { month, year } });
        
        let whereClause = {};
        if (period) whereClause.billing_period_id = period.id;
        else return res.json([]); 

        // Tìm hóa đơn kèm thông tin Hộ dân và Căn hộ
        const invoices = await Invoice.findAll({
            where: whereClause,
            include: [
                { 
                    model: Household, 
                    as: 'Household',
                    include: [{ 
                        model: Apartment, 
                        as: 'Apartment',
                        // Lọc theo mã căn hộ nếu user có nhập
                        where: code ? { code: { [Op.iLike]: `%${code}%` } } : {} 
                    }]
                },
                {
                    model: InvoiceItem,
                    as: 'InvoiceItems' // Lấy chi tiết để hiển thị popup
                }
            ],
            // Sắp xếp theo mã căn hộ
            order: [
                [{ model: Household, as: 'Household' }, { model: Apartment, as: 'Apartment' }, 'code', 'ASC']
            ]
        });

        // Lọc bỏ những hóa đơn không khớp mã căn hộ (do cách include where lồng nhau)
        const results = invoices
            .filter(inv => inv.Household && inv.Household.Apartment) 
            .map(inv => ({
                id: inv.id,
                apartment_code: inv.Household.Apartment.code,
                owner_name: inv.Household.owner_name, // Lấy tên chủ hộ tại thời điểm đó
                month: month,
                year: year,
                total_amount: inv.total_amount,
                status: inv.status,
                items: inv.InvoiceItems
            }));

        res.json(results);

    } catch (err) {
        console.error("Lỗi tìm kiếm:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// API: PHÁT HÀNH HÓA ĐƠN
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
        res.json({ message: `Đã phát hành ${count} hóa đơn.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// API: THÊM PHÍ LẺ (Thủ công)
// ==========================================
exports.addAdHocItem = async (req, res) => {
    // Input: Danh sách căn hộ, tên phí, số tiền, mô tả
    const { apartment_codes, fee_name, amount, description, month, year } = req.body;
    const t = await sequelize.transaction();

    try {
        // 1. Validate dữ liệu đầu vào
        if (!apartment_codes || !Array.isArray(apartment_codes) || apartment_codes.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: "Vui lòng chọn ít nhất một căn hộ." });
        }
        if (!fee_name || !amount) {
            await t.rollback();
            return res.status(400).json({ message: "Tên phí và số tiền không được để trống." });
        }

        // 2. Tìm hoặc Tạo KỲ THU (BillingPeriod)
        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { status: 'OPEN', month, year },
            transaction: t
        });

        if (period.status === 'CLOSED') {
            await t.rollback();
            return res.status(400).json({ message: "Kỳ thu này đã đóng sổ, không thể thêm phí mới." });
        }

        // 3. Xử lý LOẠI PHÍ (FeeType)
        // Tìm xem tên phí này có chưa. Nếu chưa -> Tạo mới loại phí tạm (Category: OTHER)
        const [feeType] = await FeeType.findOrCreate({
            where: { name: fee_name },
            defaults: {
                name: fee_name,
                category: 'OTHER', // Đánh dấu là phí khác
                unit: 'Lần',
                description: 'Phí phát sinh thêm thủ công'
            },
            transaction: t
        });

        let successCount = 0;
        let failCount = 0;
        let errors = [];

        // 4. Duyệt qua danh sách mã căn hộ gửi lên
        for (const code of apartment_codes) {
            // a. Tìm Căn hộ
            const apartment = await Apartment.findOne({ where: { code } });
            if (!apartment) {
                failCount++;
                errors.push(`${code}: Không tìm thấy căn hộ`);
                continue;
            }

            // b. Tìm Hộ dân ĐANG Ở (Active) để gán nợ
            const household = await Household.findOne({
                where: { apartment_id: apartment.id, status: 'ACTIVE' },
                transaction: t
            });

            if (!household) {
                failCount++;
                errors.push(`${code}: Căn hộ trống, không có chủ hộ`);
                continue;
            }

            // c. Tìm hoặc Tạo Hóa đơn (DRAFT)
            const [invoice] = await Invoice.findOrCreate({
                where: { 
                    household_id: household.id, 
                    billing_period_id: period.id 
                },
                defaults: {
                    household_id: household.id,
                    billing_period_id: period.id,
                    apartment_id: apartment.id, // Lưu apartment_id để query nhanh
                    total_amount: 0,
                    status: 'DRAFT'
                },
                transaction: t
            });

            // d. Kiểm tra trạng thái hóa đơn
            if (invoice.status === 'PAID') {
                failCount++;
                errors.push(`${code}: Hóa đơn đã thanh toán`);
                continue;
            }

            // e. Tạo dòng phí chi tiết (InvoiceItem)
            const itemAmount = parseFloat(amount);
            
            await InvoiceItem.create({
                invoice_id: invoice.id,
                fee_type_id: feeType.id,
                fee_name: fee_name,       // Snapshot tên phí
                unit_price: itemAmount,   // Giá
                quantity: 1,              // Số lượng mặc định là 1
                amount: itemAmount,       // Thành tiền
                description: description || 'Phí thu thêm thủ công',
                details: null             // Phí lẻ thường không có bậc thang json
            }, { transaction: t });

            // f. Cập nhật tổng tiền Hóa đơn (Cộng dồn)
            // Lưu ý: Phải ép kiểu float để tránh cộng chuỗi
            invoice.total_amount = parseFloat(invoice.total_amount) + itemAmount;
            await invoice.save({ transaction: t });

            successCount++;
        }

        await t.commit();

        res.json({ 
            message: "Xử lý hoàn tất.",
            stats: {
                success: successCount,
                failed: failCount
            },
            errors: errors.length > 0 ? errors : null
        });

    } catch (err) {
        await t.rollback();
        console.error("Lỗi thêm phí lẻ:", err);
        res.status(500).json({ error: err.message });
    }
};