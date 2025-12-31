// controllers/apartmentController.js
const { Apartment } = require('../models');

exports.getAllApartments = async (req, res) => {
    try {
        const apartments = await Apartment.findAll({
            order: [['code', 'ASC']] // Sắp xếp theo mã căn (A101, A102...)
        });
        res.json(apartments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi server khi lấy danh sách căn hộ" });
    }
};