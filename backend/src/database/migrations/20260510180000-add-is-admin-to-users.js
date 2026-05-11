"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.is_admin) {
      await queryInterface.addColumn('users', 'is_admin', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (table.is_admin) {
      await queryInterface.removeColumn('users', 'is_admin');
    }
  },
};
