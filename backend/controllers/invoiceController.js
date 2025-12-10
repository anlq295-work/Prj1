const { Invoice, Apartment, FeeConfig } = require('../models');
const { Op } = require('sequelize');

exports.generateInvoices = async (req, res) => {
    const { billing_cycle } = req.body;
    try {
        // 1. Lấy dữ liệu căn hộ và biểu phí
        const apartments = await Apartment.findAll();
        const activeFees = await FeeConfig.findAll({ where: { is_active: true } });

        const invoicesData = [];

        // 2. Tính toán cho từng căn hộ
        for (const apt of apartments) {
            let total = 0;
            const items = [];

            activeFees.forEach(fee => {
                let amount = 0;
                // Logic tính tiền tùy theo loại phí
                if (fee.calc_method === 'PER_M2') {
                    amount = fee.unit_price * apt.area;
                } else if (fee.calc_method === 'FLAT') {
                    amount = fee.unit_price;
                } else if (fee.calc_method === 'PER_UNIT') {
                      // Giả lập chỉ số tiêu thụ (điện/nước) ngẫu nhiên từ 10-60
                      const mockUsage = Math.floor(Math.random() * 50) + 10;
                      amount = fee.unit_price * mockUsage;
                }
                
                // Thêm vào chi tiết hóa đơn
                items.push({ fee_name: fee.name, amount, description: fee.calc_method });
                total += amount;
            });

            // Đẩy vào danh sách chuẩn bị lưu
            invoicesData.push({
                apartment_code: apt.code,
                billing_cycle,
                items: items,
                total_amount: total,
                status: 'DRAFT'
            });
        }

        // 3. Lưu tất cả vào DB một lần (Bulk Insert)
        await Invoice.bulkCreate(invoicesData);
        
        // Đã sửa lỗi cú pháp tại dòng này (chỉ dùng 1 cặp dấu ${})
        res.json({ message: `Đã tạo hóa đơn nháp cho ${invoicesData.length} căn hộ` }); 
        
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};

exports.searchInvoices = async (req, res) => {
    const { code, cycle } = req.query;
    const whereClause = {};
    if (code) whereClause.apartment_code = code;
    if (cycle) whereClause.billing_cycle = cycle;
    
    try {
        const result = await Invoice.findAll({ where: whereClause });
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.publishInvoices = async (req, res) => {
    const { cycle } = req.body;
    try {
        await Invoice.update({ status: 'PENDING' }, {
            where: { billing_cycle: cycle, status: 'DRAFT' }
        });
        res.json({ message: 'Phát hành thành công' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.payInvoice = async (req, res) => {
    const { id } = req.params;
    const { method } = req.body;
    try {
        const inv = await Invoice.findByPk(id);
        if (!inv) return res.status(404).json({error: 'Not found'});
        
        inv.status = 'PAID';
        inv.payment_method = method;
        await inv.save();
        res.json(inv);
    } catch (err) { res.status(500).json({ error: err.message }); }
};