module.exports = (sequelize, DataTypes) => {
  const DailyReset = sequelize.define('DailyReset', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reset_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('success', 'failed'),
      allowNull: false,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'daily_resets',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  return DailyReset;
}; 