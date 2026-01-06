const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Route lấy thông tin (Public cho cả Admin và Cư dân)
router.get('/', paymentController.getConfig);

// Route cập nhật (Dành cho Admin)
router.post('/', paymentController.updateConfig);

module.exports = router;