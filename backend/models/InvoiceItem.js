module.exports = (sequelize, DataTypes) => {
  const InvoiceItem = sequelize.define('InvoiceItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    invoice_id: {
      type: DataTypes.INTEGER,
      references: { model: 'invoices', key: 'id' }
    },
    fee_definition_id: {
      type: DataTypes.INTEGER,
      references: { model: 'fee_definitions', key: 'id' }
    },
    description: DataTypes.STRING,
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1
    },
    unit_price: DataTypes.DECIMAL(15, 2),
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    metadata: DataTypes.JSONB // Lưu chi tiết tính toán (ví dụ các bậc thang)
  }, {
    tableName: 'invoice_items',
    timestamps: false
  });

  return InvoiceItem;
};