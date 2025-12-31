const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

// 1. Tạo hóa đơn hàng loạt (Chốt sổ)
// POST /api/invoices/generate
router.post('/generate', invoiceController.generateInvoices);

// 2. Tìm kiếm hóa đơn
// GET /api/invoices/search
router.get('/search', invoiceController.searchInvoices);

// 3. Phát hành hóa đơn (Draft -> Pending)
// POST /api/invoices/publish
router.post('/publish', invoiceController.publishInvoices);

// 4. Thanh toán hóa đơn
// POST /api/invoices/:id/pay
router.post('/:id/pay', invoiceController.payInvoice);

// 5. Thêm khoản thu lẻ/phát sinh (MỚI)
// POST /api/invoices/add-item
// LƯU Ý: Đảm bảo bên invoiceController có hàm exports.addAdHocItem
if (!invoiceController.addAdHocItem) {
    console.error("LỖI: Hàm addAdHocItem chưa được export trong invoiceController!");
}
router.post('/add-item', invoiceController.addAdHocItem);

module.exports = router;