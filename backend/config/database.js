const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        // 1. Thêm cấu hình Port ở đây (lấy từ file .env hoặc mặc định 5432)
        port: process.env.DB_PORT || 5432, 
        
        dialect: process.env.DB_DIALECT,
        logging: false,

        // 2. QUAN TRỌNG: Thêm cấu hình SSL để kết nối được với Supabase/Cloud DB
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false // Bỏ qua lỗi chứng chỉ tự ký (cần thiết cho Supabase)
            }
        }
    }
);

module.exports = sequelize;