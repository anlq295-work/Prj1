const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    apartment_code: { type: DataTypes.STRING, allowNull: false },
    billing_cycle: { type: DataTypes.STRING, allowNull: false },
    items: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    total_amount: { type: DataTypes.FLOAT, allowNull: false },
    status: { type: DataTypes.ENUM('DRAFT', 'PENDING', 'PAID', 'OVERDUE'), defaultValue: 'DRAFT' },
    payment_method: { type: DataTypes.STRING, allowNull: true }
});

module.exports = Invoice;