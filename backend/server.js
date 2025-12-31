const express = require('express');
const cors = require('cors');
const { syncDB } = require('./models');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const feeRoutes = require('./routes/feeRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const authRoutes = require('./routes/authRoutes');
const apartmentRoutes = require('./routes/apartmentRoutes');
const usageRoutes = require('./routes/usageRoutes');

app.use('/api/fees', feeRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/apartments', apartmentRoutes);
app.use('/api/usage', usageRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await syncDB();
});