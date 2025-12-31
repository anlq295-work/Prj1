// models/Apartment.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Apartment = sequelize.define('Apartment', {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  code: { 
    type: DataTypes.STRING, 
    allowNull: false, 
    unique: true 
  },
  owner_name: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  area: { 
    type: DataTypes.FLOAT, 
    allowNull: false 
  },
  // Các trường createdAt, updatedAt Sequelize tự động xử lý
}, {
  tableName: 'Apartments', // Quan trọng: Phải khớp tên bảng trong DB ("Apartments")
  timestamps: true
});

module.exports = Apartment;