const express = require('express');
const router = express.Router();
const apartmentController = require('../controllers/apartmentController');

router.get('/', apartmentController.getAllApartments);

module.exports = router;