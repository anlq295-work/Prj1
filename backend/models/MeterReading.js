const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MeterReading = sequelize.define('MeterReading', {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  
  apartment_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: { model: 'apartments', key: 'id' }
  },
  fee_type_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: { model: 'fee_types', key: 'id' }
  },
  billing_period_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: { model: 'billing_periods', key: 'id' }
  },

  // [SỬA ĐỔI] Chuyển sang INTEGER (Số nguyên)
  old_value: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  new_value: { 
    type: DataTypes.INTEGER, 
    allowNull: false 
  },
  
  reading_date: { 
    type: DataTypes.DATE, 
    defaultValue: DataTypes.NOW 
  }
}, {
  tableName: 'meter_readings',
  freezeTableName: true,
  underscored: true,
  timestamps: true
});

module.exports = MeterReading;