module.exports = (sequelize, DataTypes) => {
  const Household = sequelize.define('Household', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    apartment_id: {
      type: DataTypes.INTEGER,
      references: { model: 'apartments', key: 'id' }
    },
    user_id: { // Tài khoản đại diện (nếu có)
      type: DataTypes.INTEGER,
      references: { model: 'users', key: 'id' }
    },
    owner_name: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    move_in_date: DataTypes.DATEONLY,
    move_out_date: DataTypes.DATEONLY,
    status: {
      type: DataTypes.STRING,
      defaultValue: 'ACTIVE'
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    }
  }, {
    tableName: 'households',
    timestamps: false // Bảng này trong schema không có created_at/updated_at
  });
  

  return Household;
};