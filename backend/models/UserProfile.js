const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserProfile = sequelize.define('UserProfile', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    // userId tự động qua quan hệ
    full_name: { type: DataTypes.STRING },     // Sửa từ fullName
    phone_number: { type: DataTypes.STRING },  // Sửa từ phoneNumber
    email: { type: DataTypes.STRING },
    identity_card: { type: DataTypes.STRING }, // Sửa từ identityCard
    avatar_url: { type: DataTypes.STRING }     // Sửa từ avatarUrl
}, {
    tableName: 'user_profiles',
    underscored: true,
    timestamps: true
});

module.exports = UserProfile;