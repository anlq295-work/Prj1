const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvoiceItem = sequelize.define('InvoiceItem', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    // invoiceId sẽ được tạo tự động
    fee_name: { type: DataTypes.STRING, allowNull: false }, // VD: Tiền điện, Phí quản lý
    description: { type: DataTypes.STRING }, // VD: PER_KWH (120 - 240)
    quantity: { type: DataTypes.FLOAT, defaultValue: 1 }, // Số lượng tiêu thụ
    unit_price: { type: DataTypes.FLOAT, defaultValue: 0 }, // Đơn giá lúc tính
    amount: { type: DataTypes.FLOAT, allowNull: false } // Thành tiền = SL * Đơn giá
}, {
    timestamps: false // Bảng chi tiết không cần track thời gian tạo
});

module.exports = InvoiceItem;