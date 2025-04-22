'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add warning_count to users table
    await queryInterface.addColumn('users', 'warning_count', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });

    // Create user_warnings table
    await queryInterface.createTable('user_warnings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      warning_type: {
        type: Sequelize.ENUM('bad_contribution', 'system', 'admin'),
        allowNull: false,
        defaultValue: 'bad_contribution',
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      read: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      warning_level: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add index on user_id and read status for faster lookups
    await queryInterface.addIndex('user_warnings', ['user_id', 'read']);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the user_warnings table
    await queryInterface.dropTable('user_warnings');
    
    // Remove the warning_count column from users table
    await queryInterface.removeColumn('users', 'warning_count');
  },
}; 