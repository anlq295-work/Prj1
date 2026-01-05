const { Usage, Apartment, BillingPeriod, FeeType } = require('../models');

// API: Lấy danh sách chỉ số (Pivot dữ liệu để hiển thị ngang trên UI)
exports.getUsages = async (req, res) => {
    const { month, year } = req.query;
    try {
        // 1. Lấy tất cả căn hộ
        const apartments = await Apartment.findAll({ order: [['code', 'ASC']] });
        
        // 2. Tìm kỳ thu (nếu chưa có thì thôi)
        const period = await BillingPeriod.findOne({ where: { month, year } });
        
        // 3. Lấy tất cả Usage của kỳ này (nếu có)
        let usages = [];
        if (period) {
            usages = await Usage.findAll({ 
                where: { billing_period_id: period.id },
                include: [{ model: FeeType }]
            });
        }

        // 4. Biến đổi dữ liệu (Pivot) để trả về Frontend
        // Frontend cần: { apartment_code, old_electric, new_electric, old_water, new_water }
        const result = apartments.map(apt => {
            // Tìm usage của căn này
            const aptUsages = usages.filter(u => u.apartment_id === apt.id);
            
            // Tìm cụ thể điện và nước
            const electric = aptUsages.find(u => u.FeeType.name.toLowerCase().includes('điện'));
            const water = aptUsages.find(u => u.FeeType.name.toLowerCase().includes('nước'));

            return {
                apartment_code: apt.code,
                apartment_id: apt.id,
                // Điện
                old_electric: electric ? electric.old_value : 0,
                new_electric: electric ? electric.new_value : 0,
                // Nước
                old_water: water ? water.old_value : 0,
                new_water: water ? water.new_value : 0,
                
                saved: aptUsages.length > 0
            };
        });

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// API: Lưu chỉ số
exports.saveUsages = async (req, res) => {
    const { month, year, data } = req.body; // data là mảng từ frontend
    try {
        // 1. Tìm hoặc tạo Kỳ Thu
        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { month, year, status: 'OPEN' }
        });

        // 2. Lấy ID của loại phí Điện và Nước
        const electricType = await FeeType.findOne({ where: { name: 'Tiền điện' } }); // Đảm bảo tên đúng trong DB
        const waterType = await FeeType.findOne({ where: { name: 'Tiền nước' } });

        if (!electricType || !waterType) {
            return res.status(400).json({ message: "Chưa cấu hình loại phí 'Tiền điện' hoặc 'Tiền nước' trong hệ thống." });
        }

        // 3. Lưu từng dòng
        for (const item of data) {
            // Lưu Điện
            await Usage.upsert({
                apartment_id: item.apartment_id, // Frontend cần gửi kèm ID này, hoặc query từ code
                fee_type_id: electricType.id,
                billing_period_id: period.id,
                old_value: item.old_electric,
                new_value: item.new_electric
            }); // Note: upsert của Postgres cần unique constraint (đã tạo ở bước SQL)

            // Lưu Nước
            await Usage.upsert({
                apartment_id: item.apartment_id,
                fee_type_id: waterType.id,
                billing_period_id: period.id,
                old_value: item.old_water,
                new_value: item.new_water
            });
        }

        res.json({ message: "Đã lưu chỉ số thành công!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};