const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

// Tìm kiếm biên lai
router.get('/search', invoiceController.searchInvoices);

// Tính toán & Tạo biên lai nháp (Chốt sổ)
router.post('/generate', invoiceController.generateInvoices);

// Phát hành biên lai (Chuyển trạng thái)
router.post('/publish', invoiceController.publishInvoices);

// Thêm phí phát sinh thủ công
router.post('/add-item', invoiceController.addAdHocItem);

router.get('/public/search', invoiceController.getPublicInvoices);
router.post('/public/pay/:id', invoiceController.publicPayInvoice);

// Cập nhật chi tiết biên lai
router.put('/:id', invoiceController.updateInvoice);
router.post('/:id/pay', invoiceController.payInvoice);

router.delete('/:id', invoiceController.deleteInvoice);

module.exports = router;