const sequelize = require('../config/database');
const bcrypt = require('bcrypt'); // Import thư viện mã hóa mật khẩu

// 1. Import tất cả các Models
const Apartment = require('./Apartment');
const FeeConfig = require('./FeeConfig');
const Invoice = require('./Invoice');
const User = require('./User');
const UserProfile = require('./UserProfile');

// 2. Thiết lập Mối quan hệ (Associations)

// --- Quan hệ 1-1: User và UserProfile ---
// Khi xóa User -> Xóa luôn Profile (CASCADE)
User.hasOne(UserProfile, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserProfile.belongsTo(User, { foreignKey: 'userId' });

// --- (Tùy chọn) Quan hệ Căn hộ và Hóa đơn ---
// Dùng apartment_code để liên kết thay vì ID (theo thiết kế cũ của bạn)
Apartment.hasMany(Invoice, { foreignKey: 'apartment_code', sourceKey: 'code' });
Invoice.belongsTo(Apartment, { foreignKey: 'apartment_code', targetKey: 'code' });

// 3. Hàm đồng bộ Database & Seed dữ liệu mẫu
const syncDB = async () => {
    try {
        // force: true -> DROP TABLE IF EXISTS (Xóa bảng cũ và tạo lại mới tinh)
        // CẢNH BÁO: Dữ liệu cũ sẽ bị mất sạch!
        await sequelize.sync({ force: true });
        console.log('✅ PostgreSQL Database Synced (Force Reset)!');
        
        // --- Seed dữ liệu Căn hộ ---
        // Vì đã force reset nên bảng chắc chắn trống, không cần check count cũng được, nhưng giữ lại cho chắc logic
        const aptCount = await Apartment.count();
        if (aptCount === 0) {
            await Apartment.bulkCreate([
                { code: 'P101', owner_name: 'Nguyen Van A', area: 80.5 },
                { code: 'P102', owner_name: 'Tran Thi B', area: 100 },
                { code: 'P201', owner_name: 'Le Van C', area: 75 }
            ]);
            console.log('   -> Đã tạo dữ liệu mẫu: Căn hộ');
        }

        // --- Seed dữ liệu Admin ---
        const userCount = await User.count();
        if (userCount === 0) {
            // Mã hóa mật khẩu '123' trước khi lưu vào DB
            const hashedPassword = await bcrypt.hash('123', 10);

            // Tạo 1 tài khoản Admin mẫu
            const admin = await User.create({
                username: 'admin',
                password: hashedPassword, // Lưu mật khẩu đã mã hóa
                role: 'ADMIN'
            });
            
            // Tạo profile đi kèm
            await UserProfile.create({
                userId: admin.id,
                fullName: 'Quản Trị Viên',
                email: 'admin@chungcu.com'
            });
            console.log('   -> Đã tạo dữ liệu mẫu: User (admin/123 - đã hash)');
        }

    } catch (error) {
        console.error('❌ Sync DB Error:', error);
    }
};

// 4. Xuất tất cả ra để dùng ở nơi khác
module.exports = { 
    sequelize, 
    Apartment, 
    FeeConfig, 
    Invoice, 
    User, 
    UserProfile, 
    syncDB 
};