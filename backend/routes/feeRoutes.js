const express = require('express');
const router = express.Router();
const controller = require('../controllers/feeController');
router.post('/', controller.createFee);
router.get('/', controller.getFees);
router.put('/:id', controller.updateFee);
router.delete('/:id', controller.deleteFee);
router.put('/:id/toggle', controller.toggleFeeStatus);
module.exports = router;