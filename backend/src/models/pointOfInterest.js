module.exports = (sequelize, DataTypes) => {
  const PointOfInterest = sequelize.define('PointOfInterest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    poi_type: {
      type: DataTypes.ENUM('atm', 'gasstation'),
      allowNull: false,
    },
    google_place_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
      validate: {
        min: -90,
        max: 90,
      },
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false,
      validate: {
        min: -180,
        max: 180,
      },
    },
    google_data: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('google_data');
        return value ? JSON.parse(value) : {};
      },
      set(value) {
        this.setDataValue('google_data', JSON.stringify(value));
      },
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'points_of_interest',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'points_of_interest_location_idx',
        using: 'GIST',
        fields: [
          sequelize.literal('ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)'),
        ],
      },
      {
        name: 'points_of_interest_poi_type_idx',
        fields: ['poi_type'],
      },
    ],
  });

  PointOfInterest.associate = (models) => {
    PointOfInterest.hasMany(models.Contribution, {
      foreignKey: 'poi_id',
      as: 'contributions',
    });
  };

  // Instance methods
  PointOfInterest.prototype.getCurrentStatus = async function() {
    const models = sequelize.models;
    const currentContribution = await models.Contribution.findOne({
      where: {
        poi_id: this.id,
        is_current: true,
      },
      include: [
        {
          model: models.User,
          as: 'user',
          attributes: ['id', 'name', 'profile_picture'],
        },
        {
          model: models.Validation,
          as: 'validations',
          attributes: ['id', 'validation_type', 'created_at'],
        },
      ],
    });

    return currentContribution;
  };

  return PointOfInterest;
}; 