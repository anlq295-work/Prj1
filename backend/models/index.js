const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// 1. Import Models
const Apartment = require('./Apartment');
const Household = require('./Household');
const FeeType = require('./FeeType');
const FeeConfig = require('./FeeConfig');
const BillingPeriod = require('./BillingPeriod');
const MeterReading = require('./MeterReading'); // Đổi từ Usage -> MeterReading
const Invoice = require('./Invoice');
const InvoiceItem = require('./InvoiceItem');
const Payment = require('./Payment');
const User = require('./User');
const UserProfile = require('./UserProfile');

// 2. Thiết lập Quan hệ (Associations)

// --- User & Profile ---
User.hasOne(UserProfile, { foreignKey: 'user_id' });
UserProfile.belongsTo(User, { foreignKey: 'user_id' });

// --- Căn hộ & Hộ dân ---
Apartment.hasMany(Household, { foreignKey: 'apartment_id' });
Household.belongsTo(Apartment, { foreignKey: 'apartment_id' });

// --- Phí (Config & Type) ---
FeeType.hasMany(FeeConfig, { foreignKey: 'fee_type_id' });
FeeConfig.belongsTo(FeeType, { foreignKey: 'fee_type_id' });

// --- Chỉ số (MeterReading) ---
// Liên kết với Căn hộ
Apartment.hasMany(MeterReading, { foreignKey: 'apartment_id' });
MeterReading.belongsTo(Apartment, { foreignKey: 'apartment_id' });

// Liên kết với Kỳ thu
BillingPeriod.hasMany(MeterReading, { foreignKey: 'billing_period_id' });
MeterReading.belongsTo(BillingPeriod, { foreignKey: 'billing_period_id' });

// Liên kết với Loại phí
FeeType.hasMany(MeterReading, { foreignKey: 'fee_type_id' });
MeterReading.belongsTo(FeeType, { foreignKey: 'fee_type_id' });

// --- Hóa đơn (Invoice) ---
// Liên kết Hộ dân
Household.hasMany(Invoice, { foreignKey: 'household_id' });
Invoice.belongsTo(Household, { foreignKey: 'household_id' });

// Liên kết Căn hộ (Để query nhanh)
Apartment.hasMany(Invoice, { foreignKey: 'apartment_id' });
Invoice.belongsTo(Apartment, { foreignKey: 'apartment_id' });

// Liên kết Kỳ thu
BillingPeriod.hasMany(Invoice, { foreignKey: 'billing_period_id' });
Invoice.belongsTo(BillingPeriod, { foreignKey: 'billing_period_id' });

// --- Chi tiết Hóa đơn (Items) ---
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoice_id', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoice_id' });

FeeType.hasMany(InvoiceItem, { foreignKey: 'fee_type_id' });
InvoiceItem.belongsTo(FeeType, { foreignKey: 'fee_type_id' });

// --- Thanh toán ---
Invoice.hasMany(Payment, { foreignKey: 'invoice_id' });
Payment.belongsTo(Invoice, { foreignKey: 'invoice_id' });

// 3. Export
module.exports = {
  sequelize,
  Apartment,
  Household,
  FeeType,
  FeeConfig,
  BillingPeriod,
  MeterReading, // Export tên mới
  Invoice,
  InvoiceItem,
  Payment,
  User,
  UserProfile,
  
  syncDB: async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ Kết nối CSDL thành công.');
      // await sequelize.sync({ alter: true }); // Bật khi cần sửa cấu trúc tự động (thận trọng)
    } catch (error) {
      console.error('❌ Kết nối thất bại:', error);
    }
  }
};