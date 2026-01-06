const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// 1. Import Models (SỬA LẠI: Bỏ gọi hàm)
const Apartment = require('./Apartment');
const Household = require('./Household');
const FeeType = require('./FeeType'); // Đã sửa theo mẫu bạn gửi
const FeeConfig = require('./FeeConfig');
const BillingPeriod = require('./BillingPeriod');
const MeterReading = require('./MeterReading'); // Đảm bảo file này cũng viết đúng chuẩn
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

// --- Phí ---
FeeType.hasMany(FeeConfig, { foreignKey: 'fee_type_id' });
FeeConfig.belongsTo(FeeType, { foreignKey: 'fee_type_id' });

// --- Chỉ số (MeterReading) ---
Apartment.hasMany(MeterReading, { foreignKey: 'apartment_id' });
MeterReading.belongsTo(Apartment, { foreignKey: 'apartment_id' });

BillingPeriod.hasMany(MeterReading, { foreignKey: 'billing_period_id' });
MeterReading.belongsTo(BillingPeriod, { foreignKey: 'billing_period_id' });

FeeType.hasMany(MeterReading, { foreignKey: 'fee_type_id' });
MeterReading.belongsTo(FeeType, { foreignKey: 'fee_type_id' });

// --- Biên lai (Invoice) ---
Household.hasMany(Invoice, { foreignKey: 'household_id' });
Invoice.belongsTo(Household, { foreignKey: 'household_id' });

Apartment.hasMany(Invoice, { foreignKey: 'apartment_id' });
Invoice.belongsTo(Apartment, { foreignKey: 'apartment_id' });

BillingPeriod.hasMany(Invoice, { foreignKey: 'billing_period_id' });
Invoice.belongsTo(BillingPeriod, { foreignKey: 'billing_period_id' });

// --- Chi tiết Biên lai ---
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoice_id', as: 'InvoiceItems', onDelete: 'CASCADE' });
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
  MeterReading,
  Invoice,
  InvoiceItem,
  Payment,
  User,
  UserProfile,
  
  syncDB: async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ Kết nối CSDL thành công.');
    } catch (error) {
      console.error('❌ Kết nối thất bại:', error);
    }
  }
};