const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserProfile = sequelize.define('UserProfile', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    // userId sẽ được tạo tự động nhờ quan hệ bên dưới
    fullName: { type: DataTypes.STRING },
    phoneNumber: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    identityCard: { type: DataTypes.STRING }, // CMND/CCCD
    avatarUrl: { type: DataTypes.STRING }
});

module.exports = UserProfile;