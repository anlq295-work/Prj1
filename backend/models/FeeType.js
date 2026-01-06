const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FeeType = sequelize.define('FeeType', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  category: { type: DataTypes.STRING, allowNull: false }, // UTILITY, SERVICE...
  unit: { type: DataTypes.STRING }, 
  description: { type: DataTypes.TEXT }
}, {
  tableName: 'fee_types',
  timestamps: false // Bảng này không cần created_at
});

module.exports = FeeType;