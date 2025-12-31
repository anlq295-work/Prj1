// routes/apartmentRoutes.js
const express = require('express');
const router = express.Router();
const apartmentController = require('../controllers/apartmentController');

// Route này sẽ map với /api/apartments
router.get('/', apartmentController.getAllApartments);

module.exports = router;