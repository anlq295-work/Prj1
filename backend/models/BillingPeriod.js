const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BillingPeriod = sequelize.define('BillingPeriod', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  month: { type: DataTypes.INTEGER, allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: false },
  start_date: { type: DataTypes.DATEONLY },
  end_date: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.STRING, defaultValue: 'OPEN' } // OPEN, CLOSED
}, {
  tableName: 'billing_periods',
  timestamps: false,
  indexes: [{ unique: true, fields: ['month', 'year'] }]
});

module.exports = BillingPeriod;