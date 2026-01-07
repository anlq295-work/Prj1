const { sequelize, Invoice, InvoiceItem, Apartment, Household, FeeConfig, FeeType, MeterReading, BillingPeriod, Payment } = require('../models');
const { Op } = require('sequelize');
const { calculateTieredFee } = require('../services/BillCalculator');

// ==========================================
// 1. TÍNH PHÍ THÁNG
// ==========================================
exports.generateInvoices = async (req, res) => {
    const { month, year, confirm_recalc, debug } = req.body;
    const t = await sequelize.transaction();

    try {
        console.log(`--- BẮT ĐẦU TÍNH PHÍ THÁNG ${month}/${year}${debug ? ' [DEBUG MODE]' : ''} ---`);

        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { status: 'OPEN', month, year },
            transaction: t
        });

        if (period.status === 'CLOSED' && !debug) {
            await t.rollback();
            return res.status(403).json({ message: "Kỳ thu này ĐÃ CHỐT SỔ." });
        }

        const occupiedApartments = await Apartment.findAll({
            include: [{ model: Household, where: { status: 'ACTIVE' }, required: true }],
            transaction: t
        });

        const activeConfigs = await FeeConfig.findAll({
            where: { is_active: true },
            include: [{ model: FeeType }],
            transaction: t
        });
        
        const monthlyFeeTypeIds = activeConfigs.map(c => c.fee_type_id).filter(id => id);

        let countCreated = 0;
        let countUpdated = 0;

        for (const apt of occupiedApartments) {
            const household = apt.Households[0]; 

            const existingInvoices = await Invoice.findAll({
                where: {
                    household_id: household.id,
                    billing_period_id: period.id,
                    status: { [Op.ne]: 'PAID' }
                },
                transaction: t
            });

            let monthlyInvoice = null;
            for (const inv of existingInvoices) {
                const hasMonthlyItem = await InvoiceItem.findOne({
                    where: { invoice_id: inv.id, fee_type_id: { [Op.in]: monthlyFeeTypeIds } },
                    transaction: t
                });
                if (hasMonthlyItem) { monthlyInvoice = inv; break; }
            }

            let isNew = false;
            if (!monthlyInvoice) {
                monthlyInvoice = await Invoice.create({
                    household_id: household.id, billing_period_id: period.id, apartment_id: apt.id,
                    total_amount: 0, status: 'DRAFT', owner_name: household.representative_name
                }, { transaction: t });
                isNew = true; countCreated++;
            } else { countUpdated++; }

            await InvoiceItem.destroy({
                where: { invoice_id: monthlyInvoice.id, fee_type_id: { [Op.in]: monthlyFeeTypeIds } },
                transaction: t
            });

            for (const config of activeConfigs) {
                const feeType = config.FeeType; 
                if (!feeType) continue;

                let amount = 0; let quantity = 0; let details = null; let description = '';

                if (config.calc_method === 'FIXED') {
                    if (feeType.unit === 'm2') {
                        quantity = apt.area || 0; amount = parseFloat(config.unit_price) * parseFloat(quantity); description = `Diện tích: ${quantity} m2`;
                    } else {
                        quantity = 1; amount = parseFloat(config.unit_price); description = 'Phí trọn gói';
                    }
                } else if (config.calc_method === 'TIERED') {
                    const reading = await MeterReading.findOne({
                        where: { apartment_id: apt.id, billing_period_id: period.id, fee_type_id: feeType.id },
                        transaction: t
                    });
                    if (reading) {
                        quantity = reading.new_value - reading.old_value; 
                        
                        // Xử lý đồng hồ quay vòng
                        if (quantity < 0) {
                            let maxReading = feeType.unit?.toLowerCase() === 'm3' ? 99999 : 999999; 
                            quantity = (maxReading + 1 - reading.old_value) + reading.new_value;
                            description = `Quay vòng: ${reading.old_value} -> ${reading.new_value}`;
                        } else {
                            description = `Tiêu thụ: ${quantity} ${feeType.unit}`;
                        }

                        const result = calculateTieredFee(quantity, config.tier_config);
                        amount = result.total; details = result.breakdown; 
                    }
                }

                if (amount > 0) {
                    await InvoiceItem.create({
                        invoice_id: monthlyInvoice.id, fee_type_id: feeType.id, fee_name: config.name,
                        unit_price: config.calc_method === 'FIXED' ? config.unit_price : 0, quantity: quantity, amount: amount, details: details, description: description
                    }, { transaction: t });
                }
            }
            
            const totalResult = await InvoiceItem.sum('amount', { where: { invoice_id: monthlyInvoice.id }, transaction: t });
            monthlyInvoice.total_amount = totalResult || 0;
            await monthlyInvoice.save({ transaction: t });
        }

        await t.commit();
        res.json({ 
            message: `Tính phí tháng thành công! ${debug ? '(Debug Mode)' : ''}`,
            details: `Đã tạo ${countCreated}, cập nhật ${countUpdated}.`
        });

    } catch (err) {
        await t.rollback();
        console.error("Generate Error:", err);
        res.status(500).json({ error: err.message });
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
        let currentStatus = period ? period.status : 'OPEN'; 

        if (period) whereClause.billing_period_id = period.id;
        else return res.json({ data: [], status: 'OPEN' });

        const invoices = await Invoice.findAll({
            where: whereClause,
            include: [
                { model: Household, as: 'Household', include: [{ model: Apartment, as: 'Apartment', where: code ? { code: { [Op.iLike]: `%${code}%` } } : {} }] },
                { model: InvoiceItem, as: 'InvoiceItems', include: [{ model: FeeType }] }
            ],
            order: [[{ model: Household, as: 'Household' }, { model: Apartment, as: 'Apartment' }, 'code', 'ASC']]
        });

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
                items: inv.InvoiceItems,
                // [FIX LỖI NGÀY LẬP] Thêm createdAt vào đây
                createdAt: inv.createdAt,
                updatedAt: inv.updatedAt
            }));

        res.json({ data: results, status: currentStatus });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ==========================================
// 3. API: PHÁT HÀNH BIÊN LAI
// ==========================================
exports.publishInvoices = async (req, res) => {
    const { month, year } = req.body;
    const t = await sequelize.transaction();
    try {
        const period = await BillingPeriod.findOne({ where: { month, year }, transaction: t });
        if (!period) { await t.rollback(); return res.status(404).json({ message: "Chưa có kỳ thu." }); }

        period.status = 'CLOSED';
        await period.save({ transaction: t });

        const [count] = await Invoice.update(
            { status: 'PENDING' }, 
            { where: { billing_period_id: period.id, status: 'DRAFT' }, transaction: t }
        );
        await t.commit();
        res.json({ message: `Đã chốt sổ thành công! ${count} hóa đơn đã được phát hành.` });
    } catch (err) { await t.rollback(); res.status(500).json({ error: err.message }); }
};

// ==========================================
// 4. API: THÊM PHÍ LẺ
// ==========================================
exports.addAdHocItem = async (req, res) => {
    const { apartment_codes, fee_name, amount, description, month, year } = req.body;
    const timeStamp = new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const t = await sequelize.transaction();

    try {
        if (!apartment_codes || apartment_codes.length === 0) {
            await t.rollback(); return res.status(400).json({ message: "Chưa chọn căn hộ." });
        }

        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { status: 'OPEN', month, year },
            transaction: t
        });

        const monthlyConfigs = await FeeConfig.findAll({ include: [{ model: FeeType }], transaction: t });
        const monthlyFeeTypeIds = monthlyConfigs.map(c => c.fee_type_id).filter(id => id);

        let genericFeeType = await FeeType.findOne({ where: { category: 'OTHER' } });
        if (!genericFeeType) {
            genericFeeType = await FeeType.create({ name: 'Phí phát sinh khác', category: 'OTHER', unit: 'Lần' }, { transaction: t });
        }

        let successCount = 0;

        for (const code of apartment_codes) {
            const cleanCode = code.trim();
            const apartment = await Apartment.findOne({ where: { code: { [Op.iLike]: cleanCode } } });
            if (!apartment) continue;

            const household = await Household.findOne({ where: { apartment_id: apartment.id, status: 'ACTIVE' } });
            if (!household) continue;

            const existingInvoices = await Invoice.findAll({
                where: { household_id: household.id, billing_period_id: period.id, status: { [Op.ne]: 'PAID' } },
                transaction: t
            });

            let adHocInvoice = null;
            for (const inv of existingInvoices) {
                const hasMonthlyItem = await InvoiceItem.findOne({
                    where: { invoice_id: inv.id, fee_type_id: { [Op.in]: monthlyFeeTypeIds } },
                    transaction: t
                });
                if (!hasMonthlyItem) { adHocInvoice = inv; break; }
            }

            if (!adHocInvoice) {
                adHocInvoice = await Invoice.create({
                    household_id: household.id, billing_period_id: period.id, apartment_id: apartment.id,
                    total_amount: 0, status: 'PENDING', payment_method: 'CASH', owner_name: household.representative_name
                }, { transaction: t });
            }

            const itemAmount = parseFloat(amount);
            await InvoiceItem.create({
                invoice_id: adHocInvoice.id, fee_type_id: genericFeeType.id, fee_name: fee_name,
                unit_price: itemAmount, quantity: 1, amount: itemAmount,
                description: description ? `${description} (${timeStamp})` : `Thêm lúc ${timeStamp}`
            }, { transaction: t });

            await adHocInvoice.increment('total_amount', { by: itemAmount, transaction: t });
            successCount++;
        }

        await t.commit();
        res.json({ message: `Đã thêm phí lẻ cho ${successCount} căn.` });

    } catch (err) { await t.rollback(); res.status(500).json({ error: err.message }); }
};

// ==========================================
// 5. CÁC HÀM CRUD KHÁC
// ==========================================
exports.updateInvoice = async (req, res) => {
    const { id } = req.params; const { items } = req.body;
    const t = await sequelize.transaction();
    try {
        const invoice = await Invoice.findByPk(id);
        if (!invoice || invoice.status === 'PAID') throw new Error("Không thể sửa.");
        let newTotal = 0;
        for (const item of items) {
            if (item.id) {
                await InvoiceItem.update({ quantity: item.quantity, unit_price: item.unit_price, amount: item.amount, fee_name: item.fee_name, description: item.description }, { where: { id: item.id }, transaction: t });
                newTotal += parseFloat(item.amount);
            }
        }
        invoice.total_amount = newTotal;
        await invoice.save({ transaction: t });
        await t.commit(); res.json({ message: "OK" });
    } catch (err) { await t.rollback(); res.status(500).json({ error: err.message }); }
};

exports.deleteInvoice = async (req, res) => {
    const { id } = req.params; const t = await sequelize.transaction();
    try {
        const invoice = await Invoice.findByPk(id);
        if (!invoice || invoice.status === 'PAID') { await t.rollback(); return res.status(400).json({message: "Lỗi"}); }
        await InvoiceItem.destroy({ where: { invoice_id: id }, transaction: t });
        await invoice.destroy({ transaction: t });
        await t.commit(); res.json({ message: "OK" });
    } catch (err) { await t.rollback(); res.status(500).json({ error: err.message }); }
};

exports.payInvoice = async (req, res) => {
    const { id } = req.params; const t = await sequelize.transaction();
    try {
        const invoice = await Invoice.findByPk(id);
        if (!invoice || invoice.status === 'PAID') { await t.rollback(); return res.status(400).json({message: "Lỗi"}); }
        invoice.status = 'PAID'; invoice.paid_amount = invoice.total_amount; invoice.payment_method = 'CASH';
        await invoice.save({ transaction: t });
        await Payment.create({ invoice_id: id, amount: invoice.total_amount, method: 'CASH', paid_at: new Date(), transaction_code: 'ADMIN_MANUAL' }, { transaction: t });
        await t.commit(); res.json({ message: "OK" });
    } catch (err) { await t.rollback(); res.status(500).json({ error: err.message }); }
};

exports.getPublicInvoices = async (req, res) => {
    const { code } = req.query;
    try {
        const apartment = await Apartment.findOne({ where: { code } });
        if (!apartment) return res.status(404).json({ message: "Không tìm thấy" });
        const invoices = await Invoice.findAll({
            where: { apartment_id: apartment.id, status: { [Op.in]: ['PENDING', 'PAID'] } },
            include: [{ model: Household, as: 'Household' }, { model: InvoiceItem, as: 'InvoiceItems', include: [{ model: FeeType }] }, { model: BillingPeriod }],
            order: [[ { model: BillingPeriod }, 'year', 'DESC'], [ { model: BillingPeriod }, 'month', 'DESC']]
        });
        res.json(invoices.map(inv => ({
            id: inv.id, apartment_code: code, owner_name: inv.Household?.owner_name,
            month: inv.BillingPeriod?.month, year: inv.BillingPeriod?.year,
            total_amount: inv.total_amount, status: inv.status, items: inv.InvoiceItems,
            // [FIX LỖI NGÀY LẬP] Thêm createdAt vào đây
            createdAt: inv.createdAt,
            updatedAt: inv.updatedAt
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.publicPayInvoice = async (req, res) => {
    const { id } = req.params; const { payment_method } = req.body;
    const t = await sequelize.transaction();
    try {
        const invoice = await Invoice.findByPk(id);
        if (!invoice || invoice.status === 'PAID') { await t.rollback(); return res.status(400).json({message: "Lỗi"}); }
        invoice.status = 'PAID'; invoice.paid_amount = invoice.total_amount; invoice.payment_method = payment_method || 'TRANSFER';
        await invoice.save({ transaction: t });
        await Payment.create({ invoice_id: id, amount: invoice.total_amount, method: payment_method, paid_at: new Date() }, { transaction: t });
        await t.commit(); res.json({ message: "OK" });
    } catch (err) { await t.rollback(); res.status(500).json({ error: err.message }); }
};