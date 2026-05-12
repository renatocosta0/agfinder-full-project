'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Tentar habilitar PostGIS via query direta
      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      console.log('✅ PostGIS extension enabled successfully via direct query');
    } catch (error) {
      console.error('❌ Error enabling PostGIS:', error.message);
      // Não falhar a migration se PostGIS não estiver disponível
      console.log('⚠️  Continuing without PostGIS (geospatial queries will use fallback)');
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS postgis;');
      console.log('PostGIS extension disabled');
    } catch (error) {
      console.error('Error disabling PostGIS:', error.message);
    }
  }
};
