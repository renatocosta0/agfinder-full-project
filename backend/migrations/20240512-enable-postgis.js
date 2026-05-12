'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Habilitar extensão PostGIS no PostgreSQL
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('PostGIS extension enabled successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Desabilitar extensão PostGIS (cuidado: pode quebrar dependências)
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS postgis;');
    console.log('PostGIS extension disabled');
  }
};
