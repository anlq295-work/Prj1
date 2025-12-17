const express = require('express');
const router = express.Router();
const controller = require('../controllers/invoiceController');
router.post('/generate', controller.generateInvoices);
router.get('/search', controller.searchInvoices);
router.post('/publish', controller.publishInvoices);
router.post('/:id/pay', controller.payInvoice);
router.post('/invoices/add-item', controller.addAdHocItem);
module.exports = router;