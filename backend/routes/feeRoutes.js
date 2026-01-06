const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');

// 1. Lấy danh sách Loại phí (VD: Điện, Nước) - Dùng cho Dropdown tạo mới
// Route này phải đặt TRƯỚC route '/:id' để tránh bị hiểu nhầm 'types' là một 'id'
router.get('/types', feeController.getFeeTypes); 

// 2. Các route CRUD cấu hình phí
router.get('/', feeController.getAllFees);      // Lấy danh sách bảng giá
router.post('/', feeController.createFee);      // Tạo bảng giá mới
router.put('/:id', feeController.updateFee);    // Sửa bảng giá
router.delete('/:id', feeController.deleteFee); // Xóa bảng giá

module.exports = router;