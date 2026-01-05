const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usage = sequelize.define('Usage', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  apartment_id: { type: DataTypes.INTEGER, allowNull: false },
  fee_type_id: { type: DataTypes.INTEGER, allowNull: false }, // Loại phí (Điện/Nước)
  billing_period_id: { type: DataTypes.INTEGER }, // Gắn với kỳ thu nào
  
  old_value: { type: DataTypes.FLOAT, defaultValue: 0 },
  new_value: { type: DataTypes.FLOAT, defaultValue: 0 },
  reading_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'usages_new', // Tạm thời map vào bảng mới
  timestamps: false
});

module.exports = Usage;