module.exports = (sequelize, DataTypes) => {
  const UserProfile = sequelize.define('UserProfile', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      unique: true,
      references: { model: 'users', key: 'id' }
    },
    full_name: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    identity_card: DataTypes.STRING,
    avatar_url: DataTypes.TEXT
  }, {
    tableName: 'user_profiles',
    underscored: true,
    timestamps: true
  });

  return UserProfile;
};