const { Usage, Apartment } = require('../models');

// Lấy danh sách chỉ số (Kết hợp Apartment + Usage)
exports.getUsages = async (req, res) => {
    const { month, year } = req.query;
    try {
        const apartments = await Apartment.findAll({ order: [['code', 'ASC']] });
        const usages = await Usage.findAll({ where: { month, year } });

        // Merge dữ liệu: Căn nào chưa có usage thì tạo object rỗng để điền
        const result = apartments.map(apt => {
            const u = usages.find(x => x.apartment_code === apt.code);
            return {
                apartment_code: apt.code,
                owner_name: apt.owner_name,
                old_electric: u ? u.old_electric : 0,
                new_electric: u ? u.new_electric : 0,
                old_water: u ? u.old_water : 0,
                new_water: u ? u.new_water : 0,
                saved: !!u // Đánh dấu là đã lưu hay chưa
            };
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lưu chỉ số (Upsert - Có rồi thì sửa, chưa có thì tạo)
exports.saveUsages = async (req, res) => {
    const { month, year, data } = req.body; // data là mảng danh sách
    try {
        for (const item of data) {
            // Tìm bản ghi cũ
            const existing = await Usage.findOne({ 
                where: { apartment_code: item.apartment_code, month, year } 
            });

            if (existing) {
                // Update
                await existing.update({
                    old_electric: item.old_electric,
                    new_electric: item.new_electric,
                    old_water: item.old_water,
                    new_water: item.new_water
                });
            } else {
                // Create
                await Usage.create({
                    apartment_code: item.apartment_code,
                    month,
                    year,
                    old_electric: item.old_electric,
                    new_electric: item.new_electric,
                    old_water: item.old_water,
                    new_water: item.new_water
                });
            }
        }
        res.json({ message: "Đã lưu chỉ số thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};