const express = require('express');
const cors = require('cors');
const { syncDB } = require('./models');
const feeRoutes = require('./routes/feeRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/fees', feeRoutes);
app.use('/api/invoices', invoiceRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await syncDB();
});