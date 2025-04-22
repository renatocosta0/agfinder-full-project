'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('points_of_interest', 'google_data', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'longitude'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('points_of_interest', 'google_data');
  }
}; 