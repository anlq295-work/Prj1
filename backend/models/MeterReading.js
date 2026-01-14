module.exports = (sequelize, DataTypes) => {
  const MeterReading = sequelize.define('MeterReading', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    apartment_id: {
      type: DataTypes.INTEGER,
      references: { model: 'apartments', key: 'id' }
    },
    fee_definition_id: {
      type: DataTypes.INTEGER,
      references: { model: 'fee_definitions', key: 'id' }
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    old_value: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    new_value: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    reading_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'meter_readings',
    timestamps: false
  });

  return MeterReading;
};