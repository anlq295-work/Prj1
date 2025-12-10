const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserProfile = sequelize.define('UserProfile', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    // userId sẽ được tạo tự động qua quan hệ trong index.js
    fullName: { type: DataTypes.STRING },
    phoneNumber: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    identityCard: { type: DataTypes.STRING }, // CCCD/CMND
    avatarUrl: { type: DataTypes.STRING }
}, {
    timestamps: true
});

module.exports = UserProfile;