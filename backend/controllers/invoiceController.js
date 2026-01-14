const { sequelize, Invoice, InvoiceItem, Apartment, Household, FeeDefinition, MeterReading, Payment } = require('../models');
const { Op } = require('sequelize');
const { calculateTieredFee } = require('../services/BillCalculator');

// ==========================================
// 1. TÍNH PHÍ THÁNG (Recalculate)
// ==========================================
exports.generateInvoices = async (req, res) => {
    const { month, year, debug } = req.body;
    const t = await sequelize.transaction();

    try {
        console.log(`--- TÍNH PHÍ THÁNG ${month}/${year} ---`);

        const occupiedApartments = await Apartment.findAll({
            include: [{ model: Household, as: 'Households', where: { status: 'ACTIVE' }, required: true }],
            transaction: t
        });

        const allRecurringFees = await FeeDefinition.findAll({
            attributes: ['id'], where: { category: { [Op.ne]: 'OTHER' } }, transaction: t
        });
        const allRecurringFeeIds = allRecurringFees.map(f => f.id);

        const activeFees = await FeeDefinition.findAll({
            where: { is_active: true, category: { [Op.ne]: 'OTHER' } }, transaction: t
        });

        let countCreated = 0;

        for (const apt of occupiedApartments) {
            const household = apt.Households[0]; 

            let [invoice, created] = await Invoice.findOrCreate({
                where: { household_id: household.id, month, year },
                defaults: { status: 'DRAFT', total_amount: 0 },
                transaction: t
            });

            // Nếu không phải debug và đã thanh toán thì bỏ qua (nếu muốn chặn tính lại PAID)
            // Nhưng logic mới của bạn là CHO PHÉP tính lại PAID để bù trừ ví, nên ta bỏ qua check này hoặc chỉ check logic debug.
            // if (!debug && ['PAID'].includes(invoice.status)) continue; 
            
            if (created) countCreated++;

            // --- [FIX QUAN TRỌNG: XỬ LÝ TRẠNG THÁI] ---
            // 1. Nếu đang là ISSUED (Đã phát hành) -> Đưa về DRAFT (Nháp) để có thể Chốt sổ lại.
            if (invoice.status === 'ISSUED') {
                invoice.status = 'DRAFT';
                invoice.issued_at = null; // Xóa ngày phát hành cũ
            }
            // 2. Nếu là PAID (Đã thanh toán) -> Giữ nguyên PAID, chỉ cập nhật tiền.
            
            // Lưu tổng tiền cũ để tính chênh lệch cho PAID
            const oldTotal = parseFloat(invoice.total_amount || 0);

            // --- A. XÓA DỮ LIỆU CŨ ---
            // Nếu là DRAFT (hoặc vừa chuyển từ ISSUED về DRAFT), hoàn lại tiền ví ảo cũ
            if (invoice.status === 'DRAFT') {
                const oldDeduction = await InvoiceItem.findOne({
                    where: { invoice_id: invoice.id, unit_price: { [Op.lt]: 0 } },
                    transaction: t
                });
                if (oldDeduction) {
                    await household.increment('balance', { by: Math.abs(parseFloat(oldDeduction.amount)), transaction: t });
                    await oldDeduction.destroy({ transaction: t });
                }
            }

            // Xóa các khoản phí định kỳ để tính lại
            if (allRecurringFeeIds.length > 0) {
                await InvoiceItem.destroy({
                    where: { invoice_id: invoice.id, fee_definition_id: { [Op.in]: allRecurringFeeIds } },
                    transaction: t
                });
            }

            // --- B. TÍNH TOÁN PHÍ MỚI ---
            for (const fee of activeFees) {
                let amount = 0, quantity = 0, description = '', details = null;

                if (fee.calc_method === 'FIXED') {
                    quantity = 1; amount = parseFloat(fee.unit_price);
                    description = 'Phí cố định hàng tháng';
                } else if (fee.calc_method === 'BY_AREA') {
                    quantity = parseFloat(apt.area || 0);
                    amount = Math.round(quantity * parseFloat(fee.unit_price || 0));
                    description = `Diện tích: ${quantity} m²`;
                } else if (['BY_METER', 'TIERED'].includes(fee.calc_method)) {
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
                            amount = result.total; details = result.breakdown;
                        } else {
                            amount = quantity * parseFloat(fee.unit_price);
                        }
                    }
                }

                if (amount > 0) {
                    await InvoiceItem.create({
                        invoice_id: invoice.id, fee_definition_id: fee.id,
                        description, quantity, amount, metadata: details,
                        unit_price: fee.calc_method !== 'TIERED' ? fee.unit_price : 0,
                    }, { transaction: t });
                }
            }

            // --- C. TÍNH TỔNG MỚI ---
            const finalTotal = await InvoiceItem.sum('amount', { where: { invoice_id: invoice.id }, transaction: t }) || 0;

            // --- D. XỬ LÝ SỐ DƯ (LOGIC KHÁC NHAU GIỮA DRAFT VÀ PAID) ---
            
            if (invoice.status === 'PAID') {
                // Nếu đã thanh toán: Tính chênh lệch và cập nhật vào ví thật
                const difference = oldTotal - finalTotal;
                if (difference !== 0) {
                    await household.increment('balance', { by: difference, transaction: t });
                }
                // Update total mới vào hóa đơn
                invoice.total_amount = finalTotal;
            } 
            else { 
                // Nếu là DRAFT (Vừa được reset từ ISSUED hoặc mới tạo): Trừ ví tự động (Khấu trừ)
                await household.reload({ transaction: t });
                const currentBalance = parseFloat(household.balance || 0);
                
                // Cần tính lại finalTotal vì có thể vừa add items ở bước B
                // Logic khấu trừ: Nếu có tiền trong ví -> Trừ vào hóa đơn ngay
                if (currentBalance > 0 && finalTotal > 0) {
                    const deductionAmount = Math.min(finalTotal, currentBalance);
                    await InvoiceItem.create({
                        invoice_id: invoice.id,
                        description: `Sử dụng số dư ví (Còn lại: ${(currentBalance - deductionAmount).toLocaleString()}đ)`,
                        quantity: 1, unit_price: -deductionAmount, amount: -deductionAmount,
                    }, { transaction: t });
                    
                    await household.decrement('balance', { by: deductionAmount, transaction: t });
                    
                    // Cập nhật lại total_amount sau khi trừ
                    invoice.total_amount = finalTotal - deductionAmount;
                } else {
                    invoice.total_amount = finalTotal;
                }
            }

            await invoice.save({ transaction: t });
        }

        await t.commit();
        res.json({ message: "Tính phí thành công!", details: `Đã xử lý ${occupiedApartments.length} căn hộ.` });
    } catch (err) {
        await t.rollback();
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 2. SEARCH INVOICES
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
// 3. PUBLISH INVOICES (Draft -> Issued)
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
// 4. ADD AD-HOC ITEM
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

            // If invoice is PAID, deduct from wallet as this is a new charge
            const val = parseFloat(amount);
            if (invoice.status === 'PAID') {
                await household.decrement('balance', { by: val, transaction: t });
            }

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
// 5. UPDATE INVOICE (Balance Logic Here)
// ==========================================
exports.updateInvoice = async (req, res) => {
    const { id } = req.params;
    const { items, deletedIds } = req.body; 
    const t = await sequelize.transaction();

    try {
        const invoice = await Invoice.findByPk(id, { include: ['Household'], transaction: t });
        if (!invoice) {
            await t.rollback();
            return res.status(404).json({ message: "Không tìm thấy hóa đơn." });
        }

        // --- ALLOW EDITS FOR ALL STATUSES ---
        
        const oldTotal = parseFloat(invoice.total_amount || 0);

        // 1. Process deletions
        if (deletedIds && deletedIds.length > 0) {
            await InvoiceItem.destroy({
                where: {
                    id: { [Op.in]: deletedIds },
                    invoice_id: invoice.id 
                },
                transaction: t
            });
        }

        // 2. Process updates/creations
        if (items && items.length > 0) {
            for (const item of items) {
                if (item.id) {
                    // Update existing
                    const invoiceItem = await InvoiceItem.findByPk(item.id, { transaction: t });
                    if (invoiceItem && invoiceItem.invoice_id === invoice.id) {
                        invoiceItem.quantity = item.quantity;
                        invoiceItem.unit_price = item.unit_price;
                        invoiceItem.amount = item.amount;
                        invoiceItem.description = item.description || invoiceItem.description;
                        if (item.fee_name) invoiceItem.description = item.fee_name;
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

        // 3. Recalculate total
        const newTotalData = await InvoiceItem.sum('amount', { where: { invoice_id: invoice.id }, transaction: t });
        const newTotal = parseFloat(newTotalData || 0);

        // 4. [BALANCE LOGIC] Only if PAID
        if (invoice.status === 'PAID') {
            const difference = oldTotal - newTotal;
            // difference > 0: Old was higher -> Customer overpaid -> Add to balance
            // difference < 0: Old was lower -> Customer underpaid -> Deduct from balance
            
            if (difference !== 0) {
                await invoice.Household.increment('balance', { by: difference, transaction: t });
            }
        }

        // 5. Save invoice
        invoice.total_amount = newTotal;
        await invoice.save({ transaction: t });

        await t.commit();
        res.json({ message: "Cập nhật thành công", total_amount: newTotal });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 6. DELETE INVOICE
// ==========================================
exports.deleteInvoice = async (req, res) => {
    const { id } = req.params;
    const t = await sequelize.transaction();
    try {
        const invoice = await Invoice.findByPk(id, { include: ['Items', 'Household'] });
        if (!invoice) { await t.rollback(); return res.status(404).json({message: "Not found"}); }
        
        // If PAID, refund the full amount to balance
        if (invoice.status === 'PAID') {
             const amountPaid = parseFloat(invoice.total_amount);
             await invoice.Household.increment('balance', { by: amountPaid, transaction: t });
        }

        // Refund any explicit deduction items
        const deductionItem = invoice.Items.find(item => item.amount < 0 && item.description.includes('số dư ví'));
        if (deductionItem) {
            const deductionAmount = Math.abs(parseFloat(deductionItem.amount));
            await invoice.Household.increment('balance', { by: deductionAmount, transaction: t });
        }

        await InvoiceItem.destroy({ where: { invoice_id: id }, transaction: t });
        await invoice.destroy({ transaction: t });

        await t.commit();
        res.json({ message: "Đã xóa hóa đơn. (Tiền đã được hoàn vào ví nếu có)." });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 7. PUBLIC API: GET (Dân xem)
// ==========================================
exports.getPublicInvoices = async (req, res) => {
    const { code, phone } = req.query; // Nhận thêm tham số phone

    try {
        let households = [];

        // 1. Tìm hộ dân theo SĐT hoặc Mã căn
        if (phone) {
            // Tìm các hộ dân có SĐT khớp (Một SĐT có thể sở hữu nhiều căn)
            households = await Household.findAll({ 
                where: { 
                    phone: { [Op.like]: `%${phone.trim()}%` }, // Tìm gần đúng hoặc chính xác
                    status: 'ACTIVE' 
                },
                include: [{ model: Apartment, as: 'Apartment' }] // Kèm thông tin căn hộ
            });
        } else if (code) {
            // Logic cũ: Tìm theo mã căn
            const apt = await Apartment.findOne({ where: { code } });
            if (apt) {
                households = await Household.findAll({
                    where: { apartment_id: apt.id, status: 'ACTIVE' },
                    include: [{ model: Apartment, as: 'Apartment' }]
                });
            }
        }

        if (!households || households.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy thông tin cư dân." });
        }

        // Lấy danh sách ID của các hộ tìm được
        const householdIds = households.map(h => h.id);

        // 2. Tìm hóa đơn của các hộ này
        const invoices = await Invoice.findAll({
            where: { 
                household_id: { [Op.in]: householdIds }, // Tìm theo danh sách ID
                status: { [Op.in]: ['ISSUED', 'PAID', 'PARTIAL'] } 
            },
            include: [
                { 
                    model: InvoiceItem, 
                    as: 'Items', 
                    include: [{ model: FeeDefinition, as: 'FeeDefinition' }] 
                },
                // Include lại Household -> Apartment để lấy mã căn hiển thị cho từng hóa đơn
                {
                    model: Household,
                    as: 'Household',
                    include: [{ model: Apartment, as: 'Apartment' }]
                }
            ],
            order: [['year', 'DESC'], ['month', 'DESC']]
        });

        // 3. Format dữ liệu trả về để Frontend dễ dùng
        const result = invoices.map(inv => ({
            id: inv.id,
            apartment_code: inv.Household?.Apartment?.code || 'N/A', // Trả về mã căn để hiển thị
            owner_name: inv.Household?.owner_name,
            phone: inv.Household?.phone,
            household_balance: inv.Household ? parseFloat(inv.Household.balance || 0) : 0,
            month: inv.month,
            year: inv.year,
            total_amount: inv.total_amount,
            status: inv.status,
            createdAt: inv.createdAt,
            items: inv.Items
        }));

        res.json(result);

    } catch (err) {
        console.error("Public Search Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 8. ADMIN PAYMENT
// ==========================================
exports.payInvoice = async (req, res) => {
    const { id } = req.params;
    const { amount_received } = req.body;
    const t = await sequelize.transaction();
    try {
        const inv = await Invoice.findByPk(id, { include: ['Household'] });
        if(!inv) return res.status(404).json({message: "Not found"});
        
        const totalToPay = parseFloat(inv.total_amount);
        const received = parseFloat(amount_received || totalToPay);

        inv.status = 'PAID';
        inv.paid_at = new Date();
        await inv.save({ transaction: t });
        
        let note = '';
        if (received > totalToPay) {
            const surplus = received - totalToPay;
            await inv.Household.increment('balance', { by: surplus, transaction: t });
            note = `Thừa ${surplus.toLocaleString()}đ nạp ví.`;
        }

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
// 9. PUBLIC PAYMENT
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