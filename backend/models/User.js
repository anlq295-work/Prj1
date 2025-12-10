const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }, // Mật khẩu đã mã hóa
    role: { type: DataTypes.ENUM('ADMIN', 'RESIDENT'), defaultValue: 'RESIDENT' },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
    timestamps: true
});

module.exports = User;