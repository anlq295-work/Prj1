const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  invoice_id: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  method: { type: DataTypes.STRING, allowNull: false },
  transaction_code: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'SUCCESS' },
  paid_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'payments',
  timestamps: false
});

module.exports = Payment;