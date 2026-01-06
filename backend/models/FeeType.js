const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FeeType = sequelize.define('FeeType', {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  name: { 
    type: DataTypes.STRING, 
    allowNull: false, 
    unique: true 
  },
  category: { 
    type: DataTypes.STRING, 
    allowNull: false 
  }, // UTILITY, SERVICE, OTHER...
  unit: { 
    type: DataTypes.STRING 
  }, 
  description: { 
    type: DataTypes.TEXT 
  }
}, {
  // Ép Sequelize dùng đúng tên bảng này trong PostgreSQL
  tableName: 'fee_types',
  
  // Không cho phép Sequelize tự ý thêm 's' vào cuối tên model
  freezeTableName: true,
  
  // Tắt timestamps (created_at/updated_at) theo yêu cầu của bạn
  timestamps: false 
});

module.exports = FeeType;