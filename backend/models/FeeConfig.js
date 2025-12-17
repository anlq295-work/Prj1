const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FeeConfig = sequelize.define('FeeConfig', {
    id: { 
        type: DataTypes.INTEGER, 
        autoIncrement: true, 
        primaryKey: true 
    },
    name: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    type: { 
        type: DataTypes.ENUM('FIXED', 'VOLUNTARY'), 
        defaultValue: 'FIXED' 
    },
    
    // CẬP NHẬT 1: Thêm 'TIERED' vào danh sách các phương thức tính
    calc_method: { 
        type: DataTypes.ENUM('PER_M2', 'PER_UNIT', 'FLAT', 'TIERED'), 
        allowNull: false 
    },

    // CẬP NHẬT 2: Thêm cột lưu cấu hình bậc thang
    // Dùng DataTypes.JSONB nếu bạn dùng PostgreSQL (hiệu năng cao hơn)
    // Dùng DataTypes.JSON nếu bạn dùng MySQL
    tier_config: {
        type: DataTypes.JSONB, 
        allowNull: true, // Cho phép null vì các loại phí thường không cần cái này
        defaultValue: null
    },

    // CẬP NHẬT 3: Cho phép null hoặc mặc định 0
    // Vì phí lũy tiến sẽ lấy giá từ tier_config chứ không phải cột này
    unit_price: { 
        type: DataTypes.FLOAT, 
        allowNull: true, 
        defaultValue: 0 
    },

    is_active: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true 
    }
}, {
    tableName: 'FeeConfigs', // Đảm bảo tên bảng khớp với DB
    timestamps: true,
    indexes: [
        {
            name: 'idx_fee_active',
            fields: ['is_active']
        }
    ]
});

module.exports = FeeConfig;