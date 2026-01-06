const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  apartment_id: { type: DataTypes.INTEGER }, // Mới thêm để truy vấn nhanh
  household_id: { type: DataTypes.INTEGER },
  billing_period_id: { type: DataTypes.INTEGER, allowNull: false },
  
  total_amount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  paid_amount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  
  status: { type: DataTypes.STRING, defaultValue: 'DRAFT' },
  payment_method: { type: DataTypes.STRING }
}, {
  tableName: 'invoices',
  underscored: true,
  timestamps: true
});

module.exports = Invoice;