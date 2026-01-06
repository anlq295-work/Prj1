const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { 
        type: DataTypes.ENUM('ADMIN', 'RESIDENT'), 
        defaultValue: 'RESIDENT' 
    },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
    tableName: 'users',
    underscored: true,
    timestamps: true
});

module.exports = User;