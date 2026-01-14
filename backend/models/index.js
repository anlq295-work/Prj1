const { Sequelize, DataTypes } = require('sequelize');

// Đảm bảo đường dẫn này trỏ đúng tới file database.js bạn vừa gửi
// Nếu database.js nằm cùng thư mục models, hãy sửa thành: require('./database');
const sequelize = require('../config/database'); 

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// ====================================================
// 1. IMPORT MODELS (Gọi hàm để khởi tạo Model)
// ====================================================

// Auth & User
db.User = require('./User')(sequelize, DataTypes);
db.UserProfile = require('./UserProfile')(sequelize, DataTypes);

// Core Entities
db.Apartment = require('./Apartment')(sequelize, DataTypes);
db.Household = require('./Household')(sequelize, DataTypes);

// Fee & Meter (Cấu trúc mới: FeeDefinition thay thế FeeType/Config)
db.FeeDefinition = require('./FeeDefinition')(sequelize, DataTypes); 
db.MeterReading = require('./MeterReading')(sequelize, DataTypes);

// Invoice & Payment (Cấu trúc mới: Bỏ BillingPeriod)
db.Invoice = require('./Invoice')(sequelize, DataTypes);
db.InvoiceItem = require('./InvoiceItem')(sequelize, DataTypes);
// Nếu bạn chưa tạo file Payment.js theo chuẩn mới, hãy comment dòng dưới lại
// db.Payment = require('./Payment')(sequelize, DataTypes); 

// ====================================================
// 2. THIẾT LẬP QUAN HỆ (ASSOCIATIONS)
// ====================================================

// --- User & Profile ---
db.User.hasOne(db.UserProfile, { foreignKey: 'user_id', as: 'Profile' });
db.UserProfile.belongsTo(db.User, { foreignKey: 'user_id', as: 'User' });

// --- Apartment & Household ---
db.Apartment.hasMany(db.Household, { foreignKey: 'apartment_id', as: 'Households' });
db.Household.belongsTo(db.Apartment, { foreignKey: 'apartment_id', as: 'Apartment' });

// --- User & Household ---
db.User.hasMany(db.Household, { foreignKey: 'user_id', as: 'Households' });
db.Household.belongsTo(db.User, { foreignKey: 'user_id', as: 'Representative' });

// --- Household & Invoice ---
db.Household.hasMany(db.Invoice, { foreignKey: 'household_id', as: 'Invoices' });
db.Invoice.belongsTo(db.Household, { foreignKey: 'household_id', as: 'Household' });

// --- Invoice & InvoiceItem ---
db.Invoice.hasMany(db.InvoiceItem, { foreignKey: 'invoice_id', as: 'Items', onDelete: 'CASCADE' });
db.InvoiceItem.belongsTo(db.Invoice, { foreignKey: 'invoice_id', as: 'Invoice' });

// --- FeeDefinition & InvoiceItem ---
db.FeeDefinition.hasMany(db.InvoiceItem, { foreignKey: 'fee_definition_id', as: 'InvoiceItems' });
db.InvoiceItem.belongsTo(db.FeeDefinition, { foreignKey: 'fee_definition_id', as: 'FeeDefinition' });

// --- FeeDefinition & MeterReading ---
db.FeeDefinition.hasMany(db.MeterReading, { foreignKey: 'fee_definition_id', as: 'Readings' });
db.MeterReading.belongsTo(db.FeeDefinition, { foreignKey: 'fee_definition_id', as: 'FeeDefinition' });

// --- Apartment & MeterReading ---
db.Apartment.hasMany(db.MeterReading, { foreignKey: 'apartment_id', as: 'MeterReadings' });
db.MeterReading.belongsTo(db.Apartment, { foreignKey: 'apartment_id', as: 'Apartment' });

// --- Invoice & Payment ---
// Cần model Payment để lưu lịch sử trả tiền vì cột paid_amount ở Invoice đã mất
if (db.Payment) {
    db.Invoice.hasMany(db.Payment, { foreignKey: 'invoice_id', as: 'Payments' });
    db.Payment.belongsTo(db.Invoice, { foreignKey: 'invoice_id', as: 'Invoice' });
}

// ====================================================
// 3. HÀM ĐỒNG BỘ CSDL (SYNC)
// ====================================================
db.syncDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Kết nối CSDL thành công.');
        
        // Dùng alter: true để tự động sửa bảng nếu có thay đổi cột (DEV MODE)
        // await sequelize.sync({ alter: true }); 
        // console.log('✅ Đã đồng bộ Model với Database.');
    } catch (error) {
        console.error('❌ Kết nối thất bại:', error);
    }
};

module.exports = db;