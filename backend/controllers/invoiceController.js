const { sequelize, Invoice, InvoiceItem, Apartment, Household, FeeDefinition, MeterReading, Payment } = require('../models');
const { Op } = require('sequelize');
const { calculateTieredFee } = require('../services/BillCalculator');

// ==========================================
// 1. TÍNH PHÍ THÁNG (Tạo Invoice Draft)
// ==========================================
exports.generateInvoices = async (req, res) => {
    const { month, year, debug } = req.body;
    const t = await sequelize.transaction();

    try {
        console.log(`--- TÍNH PHÍ THÁNG ${month}/${year} ---`);

        // 1. Lấy danh sách căn hộ & Hộ dân (Kèm số dư ví)
        const occupiedApartments = await Apartment.findAll({
            include: [{ 
                model: Household, 
                as: 'Households', 
                where: { status: 'ACTIVE' }, 
                required: true 
            }],
            transaction: t
        });

        // 2. Lấy danh sách TẤT CẢ các loại phí định kỳ (để xóa sạch dữ liệu cũ)
        const allRecurringFees = await FeeDefinition.findAll({
            attributes: ['id'],
            where: { category: { [Op.ne]: 'OTHER' } },
            transaction: t
        });
        const allRecurringFeeIds = allRecurringFees.map(f => f.id);

        // 3. Lấy danh sách phí ĐANG HOẠT ĐỘNG (để tính mới)
        const activeFees = await FeeDefinition.findAll({
            where: { is_active: true, category: { [Op.ne]: 'OTHER' } },
            transaction: t
        });

        let countCreated = 0;

        for (const apt of occupiedApartments) {
            const household = apt.Households[0]; 

            // Tìm/Tạo Invoice Header
            let [invoice, created] = await Invoice.findOrCreate({
                where: { household_id: household.id, month, year },
                defaults: { status: 'DRAFT', total_amount: 0 },
                transaction: t
            });

            // Nếu đã chốt sổ (và không phải debug) thì bỏ qua
            if (!debug && ['PAID', 'ISSUED'].includes(invoice.status)) continue;
            if (created) countCreated++;

            // --- A. XÓA DỮ LIỆU CŨ ---
            // 1. Hoàn lại tiền ví nếu hóa đơn cũ đã trừ tiền ví (tránh trừ 2 lần)
            const oldDeduction = await InvoiceItem.findOne({
                where: { invoice_id: invoice.id, unit_price: { [Op.lt]: 0 } }, // Tìm item âm
                transaction: t
            });
            if (oldDeduction) {
                const refundAmount = Math.abs(parseFloat(oldDeduction.amount));
                await household.increment('balance', { by: refundAmount, transaction: t });
                await oldDeduction.destroy({ transaction: t });
            }

            // 2. Xóa các khoản phí định kỳ cũ
            if (allRecurringFeeIds.length > 0) {
                await InvoiceItem.destroy({
                    where: { 
                        invoice_id: invoice.id, 
                        fee_definition_id: { [Op.in]: allRecurringFeeIds } 
                    },
                    transaction: t
                });
            }

            // --- B. TÍNH TOÁN PHÍ MỚI ---
            for (const fee of activeFees) {
                let amount = 0, quantity = 0, description = '', details = null;

                if (fee.calc_method === 'FIXED') {
                    quantity = 1;
                    amount = parseFloat(fee.unit_price);
                    description = 'Phí cố định hàng tháng';
                } 
                else if (fee.calc_method === 'BY_AREA') {
                    // Lấy diện tích an toàn
                    quantity = parseFloat(apt.area || 0);
                    const price = parseFloat(fee.unit_price || 0);
                    amount = Math.round(quantity * price); // Làm tròn
                    description = `Diện tích: ${quantity} m²`;
                }
                else if (['BY_METER', 'TIERED'].includes(fee.calc_method)) {
                    const reading = await MeterReading.findOne({
                        where: { apartment_id: apt.id, fee_definition_id: fee.id, month, year },
                        transaction: t
                    });

                    if (reading) {
                        quantity = Number(reading.new_value) - Number(reading.old_value);
                        if (quantity < 0) quantity = 0;

                        description = `Tiêu thụ: ${quantity} ${fee.unit}`;
                        if (fee.calc_method === 'TIERED') {
                            const result = calculateTieredFee(quantity, fee.tier_config);
                            amount = result.total;
                            details = result.breakdown;
                        } else {
                            amount = quantity * parseFloat(fee.unit_price);
                        }
                    }
                }

                if (amount > 0) {
                    await InvoiceItem.create({
                        invoice_id: invoice.id,
                        fee_definition_id: fee.id,
                        description, quantity,
                        unit_price: fee.calc_method !== 'TIERED' ? fee.unit_price : 0,
                        amount, metadata: details
                    }, { transaction: t });
                }
            }

            // --- C. KHẤU TRỪ SỐ DƯ VÍ (NẾU CÓ) ---
            // Tính tổng tiền tạm thời
            const currentTotal = await InvoiceItem.sum('amount', { where: { invoice_id: invoice.id }, transaction: t }) || 0;
            
            // Reload household để lấy balance mới nhất (sau khi hoàn tiền ở bước A.1)
            await household.reload({ transaction: t });
            const currentBalance = parseFloat(household.balance || 0);

            if (currentBalance > 0 && currentTotal > 0) {
                // Trừ tối đa bằng tổng tiền hóa đơn hoặc số dư ví
                const deductionAmount = Math.min(currentTotal, currentBalance);
                
                // Tạo item âm để trừ tiền
                await InvoiceItem.create({
                    invoice_id: invoice.id,
                    description: `Sử dụng số dư ví (Còn lại: ${(currentBalance - deductionAmount).toLocaleString()}đ)`,
                    quantity: 1,
                    unit_price: -deductionAmount,
                    amount: -deductionAmount,
                    // Có thể tạo 1 loại phí hệ thống 'WALLET' nếu cần, ở đây để null hoặc OTHER
                }, { transaction: t });

                // Trừ tiền trong ví
                await household.decrement('balance', { by: deductionAmount, transaction: t });
            }

            // --- D. CẬP NHẬT TỔNG TIỀN CUỐI CÙNG ---
            const finalTotal = await InvoiceItem.sum('amount', { where: { invoice_id: invoice.id }, transaction: t });
            invoice.total_amount = finalTotal || 0;
            await invoice.save({ transaction: t });
        }

        await t.commit();
        res.json({ message: "Tính phí thành công!", details: `Đã xử lý ${occupiedApartments.length} căn hộ.` });

    } catch (err) {
        await t.rollback();
        console.error("Generate Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 2. TÌM KIẾM HÓA ĐƠN (ADMIN)
// ==========================================
exports.searchInvoices = async (req, res) => {
    const { code, month, year } = req.query;
    try {
        const whereClause = {};
        if (month) whereClause.month = month;
        if (year) whereClause.year = year;

        const householdInclude = {
            model: Household,
            as: 'Household',
            include: []
        };

        if (code) {
            householdInclude.include.push({
                model: Apartment,
                as: 'Apartment',
                where: { code: { [Op.iLike]: `%${code}%` } },
                required: true 
            });
        } else {
            householdInclude.include.push({
                model: Apartment,
                as: 'Apartment'
            });
        }

        const invoices = await Invoice.findAll({
            where: whereClause,
            include: [
                householdInclude,
                { 
                    model: InvoiceItem, 
                    as: 'Items', 
                    include: [{ model: FeeDefinition, as: 'FeeDefinition' }] 
                }
            ],
            order: [
                [ { model: Household, as: 'Household' }, { model: Apartment, as: 'Apartment' }, 'code', 'ASC' ]
            ]
        });

        const result = invoices.map(inv => ({
            id: inv.id,
            apartment_code: inv.Household?.Apartment?.code || 'N/A',
            owner_name: inv.Household?.owner_name,
            month: inv.month,
            year: inv.year,
            total_amount: inv.total_amount,
            status: inv.status,
            issued_at: inv.issued_at,
            createdAt: inv.createdAt,
            items: inv.Items
        }));

        res.json({ data: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 3. CHỐT SỔ (PUBLISH)
// ==========================================
exports.publishInvoices = async (req, res) => {
    const { month, year } = req.body;
    try {
        const [count] = await Invoice.update(
            { status: 'ISSUED', issued_at: new Date() },
            { where: { month, year, status: 'DRAFT' } }
        );
        res.json({ message: `Đã phát hành ${count} hóa đơn.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 4. THÊM PHÍ LẺ (AD-HOC)
// ==========================================
exports.addAdHocItem = async (req, res) => {
    const { apartment_codes, fee_name, amount, description, month, year } = req.body;
    const t = await sequelize.transaction();

    try {
        let otherFee = await FeeDefinition.findOne({ where: { category: 'OTHER' } });
        if (!otherFee) {
            otherFee = await FeeDefinition.create({ 
                name: 'Phí khác', category: 'OTHER', calc_method: 'FIXED', unit: 'Lần' 
            }, { transaction: t });
        }

        let count = 0;
        for (const code of apartment_codes) {
            const apt = await Apartment.findOne({ where: { code: code.trim() } });
            if (!apt) continue;

            const household = await Household.findOne({ where: { apartment_id: apt.id, status: 'ACTIVE' } });
            if (!household) continue;

            let invoice = await Invoice.findOne({ 
                where: { household_id: household.id, month, year }, 
                transaction: t 
            });
            
            if (!invoice) {
                 invoice = await Invoice.create({
                     household_id: household.id, month, year, status: 'DRAFT'
                 }, { transaction: t });
            }

            if (invoice.status === 'PAID') continue;

            const val = parseFloat(amount);
            await InvoiceItem.create({
                invoice_id: invoice.id,
                fee_definition_id: otherFee.id,
                description: description || fee_name,
                quantity: 1, unit_price: val, amount: val
            }, { transaction: t });

            await invoice.increment('total_amount', { by: val, transaction: t });
            count++;
        }

        await t.commit();
        res.json({ message: `Đã thêm phí cho ${count} căn hộ.` });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 5. CẬP NHẬT CHI TIẾT HÓA ĐƠN
// ==========================================
exports.updateInvoice = async (req, res) => {
    const { id } = req.params;
    const { items, deletedIds } = req.body; 
    const t = await sequelize.transaction();

    try {
        const invoice = await Invoice.findByPk(id);
        if (!invoice || invoice.status === 'PAID') {
            await t.rollback();
            return res.status(400).json({ message: "Không thể sửa hóa đơn đã thanh toán." });
        }

        // 1. Xử lý xóa items
        if (deletedIds && deletedIds.length > 0) {
            await InvoiceItem.destroy({
                where: {
                    id: { [Op.in]: deletedIds },
                    invoice_id: invoice.id 
                },
                transaction: t
            });
        }

        // 2. Cập nhật / Thêm mới items
        if (items && items.length > 0) {
            for (const item of items) {
                if (item.id) {
                    // Update
                    const invoiceItem = await InvoiceItem.findByPk(item.id, { transaction: t });
                    if (invoiceItem && invoiceItem.invoice_id === invoice.id) {
                        invoiceItem.quantity = item.quantity;
                        invoiceItem.unit_price = item.unit_price;
                        invoiceItem.amount = item.amount;
                        invoiceItem.description = item.description;
                        if (item.fee_name) invoiceItem.description = item.fee_name; // Fallback
                        await invoiceItem.save({ transaction: t });
                    }
                } else {
                    // Create new
                    let feeDefId = item.fee_definition_id;
                    if (!feeDefId) {
                        const otherFee = await FeeDefinition.findOne({ where: { category: 'OTHER' } });
                        feeDefId = otherFee ? otherFee.id : null;
                    }
                    if (feeDefId) {
                        await InvoiceItem.create({
                            invoice_id: invoice.id,
                            fee_definition_id: feeDefId,
                            description: item.fee_name || item.description || 'Phí phát sinh',
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            amount: item.amount
                        }, { transaction: t });
                    }
                }
            }
        }

        // 3. Tính lại tổng tiền
        const newTotal = await InvoiceItem.sum('amount', { where: { invoice_id: invoice.id }, transaction: t });
        invoice.total_amount = newTotal || 0;
        await invoice.save({ transaction: t });

        await t.commit();
        res.json({ message: "Cập nhật thành công", total_amount: newTotal });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 6. XÓA HÓA ĐƠN & HOÀN TIỀN VÍ
// ==========================================
exports.deleteInvoice = async (req, res) => {
    const { id } = req.params;
    const t = await sequelize.transaction();
    try {
        const invoice = await Invoice.findByPk(id, { include: ['Items', 'Household'] });
        if (!invoice) { await t.rollback(); return res.status(404).json({message: "Not found"}); }
        if (invoice.status === 'PAID') { await t.rollback(); return res.status(400).json({message: "Đã thanh toán, không thể xóa."}); }

        // 1. Kiểm tra xem có mục nào trừ tiền ví (số âm) không để hoàn tiền
        const deductionItem = invoice.Items.find(item => item.amount < 0 && item.description.includes('số dư ví'));
        if (deductionItem) {
            const refundAmount = Math.abs(parseFloat(deductionItem.amount));
            await invoice.Household.increment('balance', { by: refundAmount, transaction: t });
        }

        // 2. Xóa
        await InvoiceItem.destroy({ where: { invoice_id: id }, transaction: t });
        await invoice.destroy({ transaction: t });

        await t.commit();
        res.json({ message: "Đã xóa hóa đơn và hoàn lại số dư ví (nếu có)." });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 7. PUBLIC API: GET (Dân xem)
// ==========================================
exports.getPublicInvoices = async (req, res) => {
    const { code } = req.query;
    try {
        const apt = await Apartment.findOne({ 
            where: { code },
            include: [{ model: Household, as: 'Households', where: { status: 'ACTIVE' } }]
        });
        
        if (!apt || !apt.Households[0]) return res.status(404).json({ message: "Không tìm thấy thông tin." });

        const invoices = await Invoice.findAll({
            where: { 
                household_id: apt.Households[0].id, 
                status: { [Op.in]: ['ISSUED', 'PAID', 'PARTIAL'] } 
            },
            include: [
                { model: InvoiceItem, as: 'Items', include: [{ model: FeeDefinition, as: 'FeeDefinition' }] }
            ],
            order: [['year', 'DESC'], ['month', 'DESC']]
        });
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 8. THANH TOÁN (ADMIN) - XỬ LÝ TIỀN THỪA
// ==========================================
exports.payInvoice = async (req, res) => {
    const { id } = req.params;
    const { amount_received } = req.body; // Số tiền thực nhận
    const t = await sequelize.transaction();
    try {
        const inv = await Invoice.findByPk(id, { include: ['Household'] });
        if(!inv) return res.status(404).json({message: "Not found"});
        
        const totalToPay = parseFloat(inv.total_amount);
        const received = parseFloat(amount_received || totalToPay); // Mặc định trả đủ

        // 1. Update trạng thái
        inv.status = 'PAID';
        inv.paid_at = new Date();
        await inv.save({ transaction: t });
        
        // 2. Xử lý tiền thừa vào Ví
        let note = '';
        if (received > totalToPay) {
            const surplus = received - totalToPay;
            await inv.Household.increment('balance', { by: surplus, transaction: t });
            note = `Thừa ${surplus.toLocaleString()}đ nạp ví.`;
        }

        // 3. Tạo Payment Log
        if (Payment) {
            await Payment.create({
                invoice_id: id,
                amount: received,
                method: 'CASH',
                paid_at: new Date(),
                transaction_code: 'ADMIN_MANUAL',
                note: note
            }, { transaction: t });
        }
        
        await t.commit();
        res.json({ message: "Thanh toán thành công" + (note ? `. ${note}` : "") });
    } catch(err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 9. THANH TOÁN ONLINE (PUBLIC)
// ==========================================
exports.publicPayInvoice = async (req, res) => {
    const { id } = req.params;
    const { payment_method } = req.body;
    const t = await sequelize.transaction();
    try {
        const invoice = await Invoice.findByPk(id);
        if (!invoice) return res.status(404).json({ message: "Not found" });
        if (invoice.status === 'PAID') return res.status(400).json({ message: "Đã thanh toán rồi" });

        invoice.status = 'PAID';
        invoice.paid_at = new Date();
        await invoice.save({ transaction: t });

        if (Payment) {
            await Payment.create({
                invoice_id: id,
                amount: invoice.total_amount,
                method: payment_method || 'TRANSFER',
                paid_at: new Date()
            }, { transaction: t });
        }

        await t.commit();
        res.json({ message: "Thanh toán thành công" });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
};