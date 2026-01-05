const { Apartment, Household } = require('../models');

exports.getAllApartments = async (req, res) => {
    try {
        const apartments = await Apartment.findAll({
            include: [{
                model: Household,
                as: 'Households',
                where: { status: 'ACTIVE' }, // Chỉ lấy hộ đang ở
                required: false, // Left join (để vẫn hiện căn trống)
                limit: 1 // Lấy 1 chủ hộ đại diện
            }],
            order: [['code', 'ASC']]
        });

        // Flatten data cho dễ dùng
        const result = apartments.map(apt => ({
            id: apt.id,
            code: apt.code,
            area: apt.area,
            owner_name: apt.Households[0] ? apt.Households[0].owner_name : '(Trống)'
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};