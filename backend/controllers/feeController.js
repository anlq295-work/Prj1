const { FeeConfig } = require('../models');

exports.createFee = async (req, res) => {
    try {
        const newFee = await FeeConfig.create(req.body);
        res.status(201).json(newFee);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getFees = async (req, res) => {
    try {
        const fees = await FeeConfig.findAll({ order: [['createdAt', 'DESC']] });
        res.json(fees);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.toggleFeeStatus = async (req, res) => {
    try {
        const fee = await FeeConfig.findByPk(req.params.id);
        if (!fee) return res.status(404).json({ error: 'Not found' });
        fee.is_active = !fee.is_active;
        await fee.save();
        res.json(fee);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// API Sửa phí
exports.updateFee = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await FeeConfig.update(req.body, { where: { id } });
        if (updated) {
            const updatedFee = await FeeConfig.findByPk(id);
            return res.json(updatedFee);
        }
        throw new Error('Fee not found');
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// API Xóa phí
exports.deleteFee = async (req, res) => {
    try {
        const { id } = req.params;
        await FeeConfig.destroy({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addAdHocItem = async (req, res) => {
    const { apartment_code, fee_name, amount, description, month, year } = req.body;

    try {
        // 1. Tìm hóa đơn NHÁP (DRAFT) của tháng này
        let invoice = await Invoice.findOne({
            where: { 
                apartment_code, 
                month, 
                year, 
                status: 'DRAFT' // Chỉ thêm được vào hóa đơn chưa chốt
            }
        });

        // 2. Nếu chưa có hóa đơn (ví dụ đầu tháng chưa chạy chốt sổ), thì tạo mới hóa đơn Nháp
        if (!invoice) {
            // Lấy thông tin chủ hộ để tạo hóa đơn
            const apartment = await Apartment.findOne({ where: { code: apartment_code } });
            if (!apartment) return res.status(404).json({ message: "Không tìm thấy căn hộ" });

            invoice = await Invoice.create({
                apartment_code,
                owner_name: apartment.owner_name, // Giả sử model Apartment có trường này
                month,
                year,
                total_amount: 0,
                status: 'DRAFT'
            });
        }

        // 3. Thêm dòng phí bất thường vào bảng InvoiceItems
        const newItem = await InvoiceItem.create({
            invoice_id: invoice.id,
            fee_name: fee_name,          // VD: "Phí sửa chữa", "Phạt vi phạm"
            description: description || 'Phí phát sinh',
            quantity: 1,
            unit_price: amount,
            amount: amount,
            details: null // Không cần breakdown vì là phí nhập tay
        });

        // 4. Cập nhật lại tổng tiền của hóa đơn (Cộng dồn)
        invoice.total_amount = parseFloat(invoice.total_amount) + parseFloat(amount);
        await invoice.save();

        res.json({ message: "Đã thêm phí phát sinh thành công!", data: newItem });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};