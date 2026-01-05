const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  household_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false 
  },
  billing_period_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false 
  },
  total_amount: { type: DataTypes.FLOAT, defaultValue: 0 },
  paid_amount: { type: DataTypes.FLOAT, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'DRAFT' }, // DRAFT, PENDING, PAID, PARTIAL
  payment_method: { type: DataTypes.STRING } // Lưu phương thức thanh toán cuối cùng
}, {
  tableName: 'Invoices',
  timestamps: true
});

module.exports = Invoice;