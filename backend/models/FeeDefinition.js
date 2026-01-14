module.exports = (sequelize, DataTypes) => {
  const FeeDefinition = sequelize.define('FeeDefinition', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    category: {
      type: DataTypes.STRING, // Ví dụ: SERVICE, UTILITY, PARKING...
      allowNull: false
    },
    calc_method: {
      type: DataTypes.ENUM('FIXED', 'BY_AREA', 'BY_METER', 'TIERED'),
      allowNull: false
    },
    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    tier_config: {
      type: DataTypes.JSONB, // Lưu cấu hình bậc thang
      allowNull: true
    },
    unit: DataTypes.STRING, // Đơn vị tính (kWh, m3, slot...)
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'fee_definitions',
    underscored: true,
    timestamps: true
  });

  return FeeDefinition;
};