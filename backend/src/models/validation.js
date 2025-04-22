module.exports = (sequelize, DataTypes) => {
  const Validation = sequelize.define('Validation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    contribution_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'contributions',
        key: 'id',
      },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    validation_type: {
      type: DataTypes.ENUM('valid', 'report'),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'validations',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      {
        name: 'validations_contribution_idx',
        fields: ['contribution_id'],
      },
      {
        name: 'validations_user_idx',
        fields: ['user_id'],
      },
      {
        name: 'validations_unique_idx',
        unique: true,
        fields: ['contribution_id', 'user_id'],
      },
    ],
  });

  Validation.associate = (models) => {
    Validation.belongsTo(models.Contribution, {
      foreignKey: 'contribution_id',
      as: 'contribution',
    });
    
    Validation.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return Validation;
}; 