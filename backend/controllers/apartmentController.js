const { Apartment, Household } = require('../models');

exports.getAllApartments = async (req, res) => {
    try {
        const apartments = await Apartment.findAll({
            include: [{
                model: Household,
                as: 'Households', // Khớp với models/index.js
                where: { status: 'ACTIVE' }, 
                required: false, // Left Join (lấy cả căn trống)
                limit: 1 // Chỉ lấy 1 chủ hộ đại diện
            }],
            order: [['code', 'ASC']]
        });

        // Flatten data
        const result = apartments.map(apt => ({
            id: apt.id,
            code: apt.code,
            area: apt.area,
            status: apt.status,
            owner_name: apt.Households && apt.Households[0] ? apt.Households[0].owner_name : '(Trống)'
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};