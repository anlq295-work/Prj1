const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvoiceItem = sequelize.define('InvoiceItem', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  invoice_id: { type: DataTypes.INTEGER, allowNull: false },
  fee_type_id: { type: DataTypes.INTEGER }, // Link về loại phí gốc
  
  // Snapshot Data (Lưu cứng)
  fee_name: { type: DataTypes.STRING, allowNull: false },
  unit_price: { type: DataTypes.FLOAT, defaultValue: 0 },
  
  quantity: { type: DataTypes.FLOAT, defaultValue: 0 },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  
  details: { type: DataTypes.JSONB }, // Bậc thang
  description: { type: DataTypes.TEXT }
}, {
  tableName: 'InvoiceItems',
  timestamps: false
});

module.exports = InvoiceItem;