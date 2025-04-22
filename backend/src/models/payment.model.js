module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define(
    'Payment',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      reference: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: process.env.PAYMENT_DEFAULT_CURRENCY || 'NGN',
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      method: {
        type: DataTypes.ENUM('card', 'bank', 'crypto', 'wallet'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'successful', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'standard',
      },
      paymentUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
      },
      verifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'payments',
    }
  );

  Payment.associate = (models) => {
    Payment.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  };

  /**
   * Paginate payments
   * @param {Object} filter - Sequelize filter
   * @param {Object} options - Query options
   * @param {number} [options.limit] - Maximum number of results per page
   * @param {number} [options.page] - Current page
   * @returns {Promise<Object>} Paginated result
   */
  Payment.paginate = async function (filter, options) {
    const limit = options.limit || parseInt(process.env.PAYMENT_DEFAULT_LIMIT, 10) || 10;
    const page = options.page || parseInt(process.env.PAYMENT_DEFAULT_PAGE, 10) || 1;
    const offset = (page - 1) * limit;

    let order = [];
    if (options.sortBy) {
      const [field, direction] = options.sortBy.split(':');
      order = [[field, direction === 'desc' ? 'DESC' : 'ASC']];
    } else {
      order = [['createdAt', 'DESC']];
    }

    const { count, rows } = await this.findAndCountAll({
      where: filter,
      limit,
      offset,
      order,
    });

    return {
      results: rows,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      totalResults: count,
    };
  };

  return Payment;
}; 