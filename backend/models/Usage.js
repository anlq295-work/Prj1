// G:\Prj1\backend\models\Usage.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usage = sequelize.define('Usage', {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  apartment_code: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  month: { 
    type: DataTypes.INTEGER, 
    allowNull: false 
  },
  year: { 
    type: DataTypes.INTEGER, 
    allowNull: false 
  },
  old_electric: { type: DataTypes.FLOAT, defaultValue: 0 },
  new_electric: { type: DataTypes.FLOAT, defaultValue: 0 },
  old_water: { type: DataTypes.FLOAT, defaultValue: 0 },
  new_water: { type: DataTypes.FLOAT, defaultValue: 0 },
  reading_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'Usages',
  timestamps: true
});

module.exports = Usage;