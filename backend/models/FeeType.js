const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FeeType = sequelize.define('FeeType', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true }, // Tiền điện, Phí QL
  category: { type: DataTypes.STRING, allowNull: false }, // METER, FIXED, VOLUNTARY
  unit: { type: DataTypes.STRING }, // kWh, m3, tháng
  description: { type: DataTypes.TEXT }
}, {
  tableName: 'fee_types',
  timestamps: false
});

module.exports = FeeType;