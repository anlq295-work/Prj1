const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

// Tìm kiếm hóa đơn
router.get('/search', invoiceController.searchInvoices);

// Tính toán & Tạo hóa đơn nháp (Chốt sổ)
router.post('/generate', invoiceController.generateInvoices);

// Phát hành hóa đơn (Chuyển trạng thái)
router.post('/publish', invoiceController.publishInvoices);

// Thêm phí phát sinh thủ công
router.post('/add-item', invoiceController.addAdHocItem);

module.exports = router;