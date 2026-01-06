const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvoiceItem = sequelize.define('InvoiceItem', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  invoice_id: { type: DataTypes.INTEGER, allowNull: false },
  fee_type_id: { type: DataTypes.INTEGER },
  
  fee_name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING },
  
  // Quan trọng: Numeric cho tiền nong
  quantity: { type: DataTypes.DECIMAL(10, 2), defaultValue: 1 },
  unit_price: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  
  details: { type: DataTypes.JSONB }
}, {
  tableName: 'invoice_items',
  underscored: true, // Để map invoiceId (JS) -> invoice_id (DB) nếu cần, nhưng ta đã khai báo rõ ở trên
  timestamps: false
});

module.exports = InvoiceItem;