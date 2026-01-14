module.exports = (sequelize, DataTypes) => {
  const Invoice = sequelize.define('Invoice', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // Đã xóa apartment_id
    household_id: {
      type: DataTypes.INTEGER,
      references: { model: 'households', key: 'id' }
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    // Đã xóa paid_amount
    status: {
      type: DataTypes.ENUM('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'DRAFT'
    },
    // Đã xóa payment_method
    payment_ref: DataTypes.STRING,
    paid_at: DataTypes.DATE,
    issued_at: DataTypes.DATE
  }, {
    tableName: 'invoices',
    underscored: true,
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at'
  });

  return Invoice;
};