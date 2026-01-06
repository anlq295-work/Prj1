const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FeeConfig = sequelize.define('FeeConfig', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  fee_type_id: { 
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: { type: DataTypes.STRING, allowNull: false },
  // Enum khai báo trong code để validate, dưới DB vẫn lưu string
  calc_method: { 
      type: DataTypes.ENUM('FIXED', 'TIERED'), 
      allowNull: false 
  }, 
  tier_config: { type: DataTypes.JSONB }, // Quan trọng: JSONB
  unit_price: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 }, // Tiền là Decimal
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'fee_configs',
  underscored: true,
  timestamps: true
});

module.exports = FeeConfig;