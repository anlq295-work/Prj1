const sequelize = require('../config/database');
const bcrypt = require('bcrypt'); // Nhớ npm install bcrypt

// 1. Import Models
const Apartment = require('./Apartment');
const FeeConfig = require('./FeeConfig');
const Invoice = require('./Invoice');
const InvoiceItem = require('./InvoiceItem'); // Model mới
const User = require('./User');
const UserProfile = require('./UserProfile');

// 2. Thiết lập Quan hệ (Associations)

// User <-> UserProfile (1-1)
User.hasOne(UserProfile, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserProfile.belongsTo(User, { foreignKey: 'userId' });

// Apartment <-> Invoice (1-N)
// Liên kết bằng 'code' của căn hộ thay vì ID
Apartment.hasMany(Invoice, { foreignKey: 'apartment_code', sourceKey: 'code' });
Invoice.belongsTo(Apartment, { foreignKey: 'apartment_code', targetKey: 'code' });

// Invoice <-> InvoiceItem (1-N) (QUAN TRỌNG)
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });

// 3. Hàm Đồng bộ & Tạo dữ liệu mẫu
const syncDB = async () => {
    try {
        // force: true => Xóa hết bảng cũ tạo lại (Dùng cho lần chạy đầu tiên cấu trúc mới này)
        // Sau khi chạy ổn định, hãy đổi thành alter: true
        await sequelize.sync({ force: true });
        console.log('✅ Database Synced & Optimized Tables Created!');

        // --- Seed Admin ---
        const userCount = await User.count();
        if (userCount === 0) {
            const hashedPassword = await bcrypt.hash('123', 10);
            const admin = await User.create({
                username: 'admin',
                password: hashedPassword,
                role: 'ADMIN'
            });
            await UserProfile.create({
                userId: admin.id,
                fullName: 'Quản Trị Viên Hệ Thống',
                email: 'admin@chungcu.com'
            });
            console.log('   -> Seeded Admin User');
        }

        // --- Seed Căn hộ ---
        const aptCount = await Apartment.count();
        if (aptCount === 0) {
            await Apartment.bulkCreate([
                { code: 'P101', owner_name: 'Nguyen Van A', area: 80.5 },
                { code: 'P102', owner_name: 'Tran Thi B', area: 100 },
                { code: 'P201', owner_name: 'Le Van C', area: 75 }
            ]);
            console.log('   -> Seeded Apartments');
        }

        // --- Seed Phí mẫu ---
        const feeCount = await FeeConfig.count();
        if (feeCount === 0) {
            await FeeConfig.bulkCreate([
                { name: 'Phí Quản Lý', calc_method: 'PER_M2', unit_price: 7000 },
                { name: 'Tiền Điện', calc_method: 'PER_UNIT', unit_price: 3500 },
                { name: 'Tiền Nước', calc_method: 'PER_UNIT', unit_price: 15000 },
                { name: 'Gửi Xe Máy', calc_method: 'FLAT', unit_price: 120000 },
            ]);
            console.log('   -> Seeded Fees');
        }

    } catch (error) {
        console.error('❌ Sync Error:', error);
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
    syncDB 
};