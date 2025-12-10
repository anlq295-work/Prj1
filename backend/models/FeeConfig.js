const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FeeConfig = sequelize.define('FeeConfig', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM('FIXED', 'VOLUNTARY'), defaultValue: 'FIXED' },
    calc_method: { type: DataTypes.ENUM('PER_M2', 'PER_UNIT', 'FLAT'), allowNull: false },
    unit_price: { type: DataTypes.FLOAT, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
    timestamps: true,
    indexes: [
        // Index giúp lọc nhanh các loại phí đang kích hoạt khi tính toán
        {
            name: 'idx_fee_active',
            fields: ['is_active']
        }
    ]
});

module.exports = FeeConfig;