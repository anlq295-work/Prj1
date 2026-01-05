const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// 1. Import Models
const Apartment = require('./Apartment');
const Household = require('./Household');
const FeeType = require('./FeeType');
const FeeConfig = require('./FeeConfig');
const BillingPeriod = require('./BillingPeriod');
const Usage = require('./Usage');
const Invoice = require('./Invoice');
const InvoiceItem = require('./InvoiceItem');
const Payment = require('./Payment');
const User = require('./User'); // Giữ nguyên User cũ

// 2. Thiết lập Quan hệ (Associations)

// --- Căn hộ & Hộ dân ---
Apartment.hasMany(Household, { foreignKey: 'apartment_id', as: 'Households' });
Household.belongsTo(Apartment, { foreignKey: 'apartment_id', as: 'Apartment' });

// --- Phí ---
FeeType.hasMany(FeeConfig, { foreignKey: 'fee_type_id' });
FeeConfig.belongsTo(FeeType, { foreignKey: 'fee_type_id' });

// --- Chỉ số (Usage) ---
// Usage liên quan đến Căn hộ (vật lý) và Kỳ thu
Apartment.hasMany(Usage, { foreignKey: 'apartment_id' });
Usage.belongsTo(Apartment, { foreignKey: 'apartment_id' });

BillingPeriod.hasMany(Usage, { foreignKey: 'billing_period_id' });
Usage.belongsTo(BillingPeriod, { foreignKey: 'billing_period_id' });

FeeType.hasMany(Usage, { foreignKey: 'fee_type_id' });
Usage.belongsTo(FeeType, { foreignKey: 'fee_type_id' });

// --- Hóa đơn (Invoice) ---
// Invoice gắn với Hộ dân (người trả tiền) và Kỳ thu
Household.hasMany(Invoice, { foreignKey: 'household_id', as: 'Invoices' });
Invoice.belongsTo(Household, { foreignKey: 'household_id', as: 'Household' });

BillingPeriod.hasMany(Invoice, { foreignKey: 'billing_period_id', as: 'Invoices' });
Invoice.belongsTo(BillingPeriod, { foreignKey: 'billing_period_id', as: 'BillingPeriod' });

// Invoice Items
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoice_id', as: 'InvoiceItems', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoice_id' });

FeeType.hasMany(InvoiceItem, { foreignKey: 'fee_type_id' });
InvoiceItem.belongsTo(FeeType, { foreignKey: 'fee_type_id' });

// --- Thanh toán (Payment) ---
Invoice.hasMany(Payment, { foreignKey: 'invoice_id', as: 'Payments' });
Payment.belongsTo(Invoice, { foreignKey: 'invoice_id' });

// 3. Export
module.exports = {
  sequelize,
  Apartment,
  Household,
  FeeType,
  FeeConfig,
  BillingPeriod,
  Usage,
  Invoice,
  InvoiceItem,
  Payment,
  User,
  
  // Hàm sync database (Cẩn thận khi dùng force: true sẽ mất dữ liệu)
  syncDB: async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ Connection has been established successfully.');
      // await sequelize.sync({ alter: true }); // Chỉ bật khi cần update cấu trúc
    } catch (error) {
      console.error('❌ Unable to connect to the database:', error);
    }
  }
};