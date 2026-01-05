const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FeeConfig = sequelize.define('FeeConfig', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  fee_type_id: { 
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'fee_types', key: 'id' }
  },
  unit_price: { type: DataTypes.FLOAT, defaultValue: 0 },
  // Giữ lại cấu hình tính toán đặc thù
  calc_method: { type: DataTypes.STRING, defaultValue: 'FLAT' }, 
  tier_config: { type: DataTypes.JSONB }, 
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'FeeConfigs',
  timestamps: true
});

module.exports = FeeConfig;