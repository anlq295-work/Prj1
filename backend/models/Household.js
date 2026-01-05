const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Household = sequelize.define('Household', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  apartment_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: { model: 'Apartments', key: 'id' }
  },
  owner_name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  move_in_date: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' } // ACTIVE, MOVED_OUT
}, {
  tableName: 'households',
  timestamps: false
});

module.exports = Household;