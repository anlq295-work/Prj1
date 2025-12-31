const sequelize = require('../config/database');

// 1. Import Models
const Apartment = require('./Apartment');
const FeeConfig = require('./FeeConfig');
const Invoice = require('./Invoice');
const InvoiceItem = require('./InvoiceItem');
const User = require('./User');
const UserProfile = require('./UserProfile');
const Usage = require('./Usage');

// 2. Thiết lập Quan hệ (Associations)
User.hasOne(UserProfile, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserProfile.belongsTo(User, { foreignKey: 'userId' });

Apartment.hasMany(Invoice, { foreignKey: 'apartment_code', sourceKey: 'code' });
Invoice.belongsTo(Apartment, { foreignKey: 'apartment_code', targetKey: 'code' });

Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'InvoiceItems', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });

// 3. Hàm Kết nối Database (KHÔNG TẠO BẢNG)
const syncDB = async () => {
    try {
        // Thay đổi quan trọng ở đây:
        // Dùng authenticate() để test kết nối thay vì sync()
        await sequelize.authenticate();
        
        console.log('✅ Kết nối Database thành công! (Sử dụng bảng có sẵn)');
        
    } catch (error) {
        console.error('❌ Không thể kết nối đến Database:', error);
    }
};

module.exports = { 
    sequelize, 
    Apartment, 
    FeeConfig, 
    Invoice, 
    InvoiceItem, 
    User, 
    UserProfile, 
    Usage,  
    syncDB 
};