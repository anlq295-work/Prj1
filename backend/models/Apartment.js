const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Apartment = sequelize.define('Apartment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  code: { type: DataTypes.STRING, allowNull: false, unique: true }, // P101
  floor: { type: DataTypes.INTEGER },
  area: { type: DataTypes.FLOAT, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' }
}, {
  tableName: 'Apartments', // Tên bảng trong DB
  timestamps: true
});

module.exports = Apartment;