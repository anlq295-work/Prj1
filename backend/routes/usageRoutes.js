const express = require('express');
const router = express.Router();
const usageController = require('../controllers/usageController');

// API lấy chỉ số (đã pivot ngang)
router.get('/', usageController.getUsages);

// API lưu chỉ số (bulk update)
router.post('/', usageController.saveUsage);

module.exports = router;