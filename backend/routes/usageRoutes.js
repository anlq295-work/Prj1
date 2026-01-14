const express = require('express');
const router = express.Router();
const usageController = require('../controllers/usageController');
const multer = require('multer');

// --- CẤU HÌNH MULTER ---
// Sử dụng memoryStorage để lưu file vào RAM, giúp thư viện xlsx đọc trực tiếp từ buffer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- ĐỊNH NGHĨA ROUTE ---
// GET lấy danh sách
router.get('/', usageController.getUsages);

// POST lưu chỉ số
router.post('/', usageController.saveUsages);

// POST import excel
// QUAN TRỌNG: 'file' trong upload.single('file') phải KHỚP với formData.append('file', ...) ở Frontend
router.post('/import', upload.single('file'), usageController.importUsages);

module.exports = router;