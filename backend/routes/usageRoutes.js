const express = require('express');
const router = express.Router();
const usageController = require('../controllers/usageController');

router.get('/', usageController.getUsages);
router.post('/', usageController.saveUsages);

module.exports = router;