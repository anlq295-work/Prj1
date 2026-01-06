const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MeterReading = sequelize.define('MeterReading', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  apartment_id: { type: DataTypes.INTEGER, allowNull: false },
  fee_type_id: { type: DataTypes.INTEGER, allowNull: false },
  billing_period_id: { type: DataTypes.INTEGER },
  
  old_value: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, // Số đo dùng Decimal
  new_value: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  reading_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'meter_readings', // Tên bảng mới
  underscored: true,
  timestamps: true // Bảng này giờ đã có created_at, updated_at
});

module.exports = MeterReading;