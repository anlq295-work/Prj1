const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

// 1. Tìm kiếm hóa đơn (Dùng cho trang BillingManager và ResidentPortal)
// GET /api/invoices/search?month=10&year=2025&code=P101
router.get('/search', invoiceController.searchInvoices);

// 2. Chốt sổ & Tạo hóa đơn nháp (Generate DRAFT)
// POST /api/invoices/generate
router.post('/generate', invoiceController.generateInvoices);

// 3. Phát hành hóa đơn (Chuyển DRAFT -> PENDING)
// POST /api/invoices/publish
router.post('/publish', invoiceController.publishInvoices);

// 4. Thêm phí lẻ (Ad-hoc)
// POST /api/invoices/add-item
// Lưu ý: Hàm này phải có trong controller, nếu chưa làm logic thì để hàm rỗng trả về message
router.post('/add-item', invoiceController.addAdHocItem);

module.exports = router;