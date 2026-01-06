const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Apartment = sequelize.define('Apartment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  code: { type: DataTypes.STRING, allowNull: false, unique: true }, 
  owner_name: { type: DataTypes.STRING, allowNull: false },
  area: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, // Dùng Decimal cho diện tích
}, {
  tableName: 'apartments', // Tên bảng chuẩn snake_case
  underscored: true,       // Tự động map createdAt -> created_at
  timestamps: true
});

module.exports = Apartment;