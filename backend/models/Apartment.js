module.exports = (sequelize, DataTypes) => {
  const Apartment = sequelize.define('Apartment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    area: {
      type: DataTypes.DECIMAL(10, 2), // Numeric
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'ACTIVE'
    }
  }, {
    tableName: 'apartments',
    underscored: true,
    timestamps: true
  });

  return Apartment;
};