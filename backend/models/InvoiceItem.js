const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvoiceItem = sequelize.define('InvoiceItem', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    
    // KHAI BÁO RÕ RÀNG KHÓA NGOẠI (để khớp với "invoiceId" trong DB)
    invoiceId: { 
        type: DataTypes.INTEGER,
        field: 'invoiceId', // Quan trọng: Map đúng với tên cột "invoiceId" trong DB
        allowNull: false 
    },

    fee_name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING },
    quantity: { type: DataTypes.FLOAT, defaultValue: 1 },
    unit_price: { type: DataTypes.FLOAT, defaultValue: 0 },
    amount: { type: DataTypes.FLOAT, allowNull: false },

    // THÊM CỘT NÀY ĐỂ FRONTEND HIỆN CHI TIẾT BẬC THANG
    details: { 
        type: DataTypes.JSONB, // Dùng JSONB cho Postgres
        allowNull: true 
    }
}, {
    tableName: 'InvoiceItems', // Đảm bảo tên bảng chính xác (có s)
    timestamps: false 
});

module.exports = InvoiceItem;