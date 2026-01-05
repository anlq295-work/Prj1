const { sequelize, Invoice, InvoiceItem, Apartment, Household, FeeConfig, FeeType, Usage, BillingPeriod } = require('../models');
const { Op } = require('sequelize');

// --- HÀM HELPER: TÍNH GIÁ LŨY TIẾN (Giữ nguyên logic cũ) ---
const calculateTieredFee = (usage, tierConfig) => {
    if (!tierConfig || !Array.isArray(tierConfig) || usage <= 0) return { total: 0, breakdown: [] };
    let totalAmount = 0;
    let remainingUsage = usage;
    let previousLimit = 0;
    let breakdown = [];

    for (let i = 0; i < tierConfig.length; i++) {
        const tier = tierConfig[i];
        const limit = tier.limit; 
        const price = tier.price;
        if (remainingUsage <= 0) break;
        
        let usageInTier = (limit === null) ? remainingUsage : Math.min(remainingUsage, limit - previousLimit);
        const cost = usageInTier * price;
        totalAmount += cost;
        breakdown.push({ tierIndex: i + 1, usage: usageInTier, price: price, cost: cost });
        
        remainingUsage -= usageInTier;
        if (limit !== null) previousLimit = limit;
    }
    return { total: totalAmount, breakdown };
};

// ==========================================
// 1. API: TẠO HÓA ĐƠN (CHỐT SỔ) - LOGIC MỚI
// ==========================================
exports.generateInvoices = async (req, res) => {
    const { month, year } = req.body;
    const transaction = await sequelize.transaction(); // Dùng transaction để an toàn dữ liệu

    try {
        // 1. Tạo hoặc lấy KỲ THU (BillingPeriod)
        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { status: 'OPEN', month, year },
            transaction
        });

        if (period.status === 'CLOSED') {
            await transaction.rollback();
            return res.status(400).json({ message: "Kỳ thu này đã đóng, không thể tính lại!" });
        }

        // 2. Lấy tất cả HỘ DÂN đang hoạt động (kèm thông tin Căn hộ)
        const households = await Household.findAll({
            where: { status: 'ACTIVE' },
            include: [{ model: Apartment, as: 'Apartment' }],
            transaction
        });

        // 3. Lấy các loại phí đang kích hoạt (Kèm thông tin Loại phí)
        const activeConfigs = await FeeConfig.findAll({
            where: { is_active: true },
            include: [{ model: FeeType }],
            transaction
        });

        let countCreated = 0;
        let countUpdated = 0;

        // 4. Vòng lặp tính toán từng hộ
        for (const household of households) {
            // Tìm/Tạo hóa đơn cho Hộ này trong Kỳ này
            const [invoice, created] = await Invoice.findOrCreate({
                where: { 
                    household_id: household.id,
                    billing_period_id: period.id
                },
                defaults: {
                    household_id: household.id,
                    billing_period_id: period.id,
                    total_amount: 0,
                    status: 'DRAFT'
                },
                transaction
            });

            if (invoice.status === 'PAID') continue; // Đã đóng tiền thì bỏ qua

            let addedAmount = 0;
            const apartmentId = household.apartment_id;

            // Duyệt qua từng loại phí cấu hình
            for (const config of activeConfigs) {
                const feeType = config.FeeType; // Lấy thông tin loại phí (Điện/Nước/Dịch vụ...)
                
                // Kiểm tra xem đã có dòng phí này trong hóa đơn chưa
                const existingItem = await InvoiceItem.findOne({
                    where: { invoice_id: invoice.id, fee_type_id: feeType.id },
                    transaction
                });
                if (existingItem) continue;

                let amount = 0;
                let quantity = 0;
                let metaData = null;
                let description = config.calc_method;

                // --- LOGIC TÍNH TOÁN ---
                if (config.calc_method === 'FLAT') {
                    // Phí cố định (VD: Rác, An ninh)
                    quantity = 1;
                    amount = config.unit_price;

                } else if (config.calc_method === 'PER_M2') {
                    // Phí theo diện tích (VD: Phí quản lý)
                    quantity = household.Apartment.area;
                    amount = config.unit_price * quantity;

                } else if (config.calc_method === 'METER' || config.calc_method === 'TIERED') {
                    // Phí theo đồng hồ (Điện/Nước) -> Tìm trong bảng Usage
                    // Tìm record Usage khớp với Căn hộ + Kỳ thu + Loại phí
                    const usageRecord = await Usage.findOne({
                        where: {
                            apartment_id: apartmentId,
                            billing_period_id: period.id,
                            fee_type_id: feeType.id
                        },
                        transaction
                    });

                    if (usageRecord) {
                        quantity = usageRecord.new_value - usageRecord.old_value;
                        if (quantity < 0) quantity = 0;

                        if (config.calc_method === 'TIERED') {
                            const result = calculateTieredFee(quantity, config.tier_config);
                            amount = result.total;
                            metaData = result.breakdown;
                            description = 'Tính theo bậc thang';
                        } else {
                            amount = quantity * config.unit_price;
                        }
                    }
                }

                // Lưu dòng chi tiết (Snapshot giá)
                if (amount > 0 || config.calc_method === 'FLAT') {
                    await InvoiceItem.create({
                        invoice_id: invoice.id,
                        fee_type_id: feeType.id,
                        fee_name: feeType.name, // Snapshot tên
                        unit_price: config.unit_price, // Snapshot giá
                        quantity: quantity,
                        amount: amount,
                        details: metaData,
                        description: description
                    }, { transaction });
                    
                    addedAmount += amount;
                }
            }

            // Cập nhật tổng tiền Invoice
            if (addedAmount > 0) {
                invoice.total_amount += addedAmount;
                await invoice.save({ transaction });
                created ? countCreated++ : countUpdated++;
            }
        }

        await transaction.commit();
        res.json({ 
            message: `Hoàn tất chốt sổ tháng ${month}/${year}.`,
            details: `Kỳ thu ID: ${period.id}. Tạo mới: ${countCreated}, Cập nhật: ${countUpdated}`
        });

    } catch (err) {
        await transaction.rollback();
        console.error("Lỗi tạo hóa đơn:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 2. API: TÌM KIẾM HÓA ĐƠN
// ==========================================
exports.searchInvoices = async (req, res) => {
    const { code, month, year } = req.query; // code ở đây là Mã Căn Hộ
    try {
        // Tìm kỳ thu trước
        const period = await BillingPeriod.findOne({ where: { month, year } });
        
        let whereClause = {};
        if (period) whereClause.billing_period_id = period.id;
        else return res.json([]); // Chưa có kỳ thu thì chưa có hóa đơn

        // Tìm các hóa đơn thỏa mãn
        const invoices = await Invoice.findAll({
            where: whereClause,
            include: [
                { 
                    model: Household, 
                    as: 'Household',
                    include: [{ 
                        model: Apartment, 
                        as: 'Apartment',
                        where: code ? { code: { [Op.iLike]: `%${code}%` } } : {} // Lọc theo mã phòng
                    }]
                },
                {
                    model: InvoiceItem,
                    as: 'InvoiceItems'
                }
            ],
            order: [[ { model: Household, as: 'Household' }, { model: Apartment, as: 'Apartment' }, 'code', 'ASC' ]]
        });

        // Format dữ liệu trả về cho Frontend (giữ cấu trúc cũ để đỡ sửa Frontend nhiều)
        const results = invoices.map(inv => {
            if (!inv.Household || !inv.Household.Apartment) return null; // Skip dữ liệu lỗi
            return {
                id: inv.id,
                apartment_code: inv.Household.Apartment.code,
                owner_name: inv.Household.owner_name,
                month: month,
                year: year,
                total_amount: inv.total_amount,
                status: inv.status,
                createdAt: inv.createdAt,
                InvoiceItems: inv.InvoiceItems
            };
        }).filter(item => item !== null);

        res.json(results);

    } catch (err) {
        console.error("Lỗi tìm kiếm:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 3. API: PHÁT HÀNH HÓA ĐƠN
// ==========================================
exports.publishInvoices = async (req, res) => {
    const { month, year } = req.body;
    try {
        const period = await BillingPeriod.findOne({ where: { month, year } });
        if (!period) return res.status(404).json({ message: "Chưa có kỳ thu nào được tạo." });

        const [updated] = await Invoice.update(
            { status: 'PENDING' }, 
            { where: { billing_period_id: period.id, status: 'DRAFT' } }
        );
        res.json({ message: `Đã phát hành ${updated} hóa đơn.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// API: THÊM PHÍ LẺ (Cần cập nhật lại theo cấu trúc mới nếu dùng)
exports.addAdHocItem = async (req, res) => {
    const { apartment_codes, fee_name, amount, description, month, year } = req.body;
    const transaction = await sequelize.transaction();

    try {
        // 1. Kiểm tra đầu vào
        if (!apartment_codes || apartment_codes.length === 0) {
            return res.status(400).json({ message: "Chưa chọn căn hộ nào." });
        }

        // 2. Tìm KỲ THU (BillingPeriod)
        // Nếu chưa có kỳ thu tháng này thì tạo mới (Status: OPEN)
        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { status: 'OPEN', month, year },
            transaction
        });

        if (period.status === 'CLOSED') {
            await transaction.rollback();
            return res.status(400).json({ message: "Kỳ thu này đã đóng sổ, không thể thêm phí." });
        }

        // 3. Xử lý LOẠI PHÍ (FeeType)
        // Tìm xem trong hệ thống đã có loại phí tên này chưa. 
        // Nếu chưa -> Tạo mới loại phí tạm (Category: OTHER) để thỏa mãn khóa ngoại
        const [feeType] = await FeeType.findOrCreate({
            where: { name: fee_name },
            defaults: {
                name: fee_name,
                category: 'OTHER', // Loại phí khác
                unit: 'Lần',
                description: 'Phí phát sinh tạo thủ công'
            },
            transaction
        });

        let successCount = 0;
        let failCount = 0;

        // 4. Duyệt qua danh sách mã căn hộ gửi lên
        for (const code of apartment_codes) {
            // a. Tìm Căn hộ từ mã
            const apartment = await Apartment.findOne({ where: { code } });
            if (!apartment) {
                failCount++; 
                continue;
            }

            // b. Tìm Hộ dân ĐANG Ở (Active) trong căn hộ này
            // (Vì hóa đơn phải gắn với Hộ dân, không phải Căn hộ vật lý)
            const household = await Household.findOne({
                where: { apartment_id: apartment.id, status: 'ACTIVE' },
                transaction
            });

            if (!household) {
                // Căn hộ trống, không có người ở -> Không thể thu phí
                console.warn(`Căn hộ ${code} chưa có chủ hộ Active, bỏ qua.`);
                failCount++;
                continue;
            }

            // c. Tìm hoặc Tạo Hóa đơn cho Hộ này trong Kỳ này
            const [invoice] = await Invoice.findOrCreate({
                where: { 
                    household_id: household.id, 
                    billing_period_id: period.id 
                },
                defaults: {
                    household_id: household.id,
                    billing_period_id: period.id,
                    total_amount: 0,
                    status: 'DRAFT'
                },
                transaction
            });

            if (invoice.status === 'PAID') {
                // Nếu hóa đơn đã thanh toán rồi thì không chèn thêm được (hoặc tùy logic của bạn)
                failCount++;
                continue;
            }

            // d. Tạo dòng phí (InvoiceItem)
            const itemAmount = parseFloat(amount);
            
            await InvoiceItem.create({
                invoice_id: invoice.id,
                fee_type_id: feeType.id,
                fee_name: fee_name,       // Snapshot tên phí
                unit_price: itemAmount,   // Snapshot giá
                quantity: 1,
                amount: itemAmount,
                description: description || 'Phí thu thêm thủ công'
            }, { transaction });

            // e. Cập nhật lại tổng tiền Hóa đơn
            invoice.total_amount += itemAmount;
            await invoice.save({ transaction });

            successCount++;
        }

        await transaction.commit();

        res.json({ 
            message: `Đã xử lý xong. Thành công: ${successCount}, Bỏ qua: ${failCount} (do căn hộ trống hoặc đã đóng tiền).`,
        });

    } catch (err) {
        await transaction.rollback();
        console.error("Lỗi thêm phí lẻ:", err);
        res.status(500).json({ error: err.message });
    }
};