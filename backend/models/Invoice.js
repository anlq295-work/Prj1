const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    apartment_code: { type: DataTypes.STRING, allowNull: false },
    
    // Tách tháng/năm ra số nguyên để Index chạy nhanh hơn chuỗi
    month: { type: DataTypes.INTEGER, allowNull: false }, 
    year: { type: DataTypes.INTEGER, allowNull: false },
    
    total_amount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    status: { 
        type: DataTypes.ENUM('DRAFT', 'PENDING', 'PAID', 'OVERDUE'), 
        defaultValue: 'DRAFT' 
    },
    payment_method: { type: DataTypes.STRING, allowNull: true }
}, {
    timestamps: true,
    indexes: [
        // Index kép: Giúp tìm nhanh "Hóa đơn tháng 10 năm 2025 trạng thái DRAFT"
        {
            name: 'idx_invoice_period_status',
            fields: ['month', 'year', 'status']
        },
        // Index đơn: Giúp cư dân tra cứu nhanh theo mã căn hộ
        {
            name: 'idx_invoice_apt_code',
            fields: ['apartment_code']
        }
    ]
});

module.exports = Invoice;