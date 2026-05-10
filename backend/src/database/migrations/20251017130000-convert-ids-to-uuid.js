"use strict";

/**
 * Migration to convert integer primary keys to UUIDs for existing tables:
 * - settings
 * - validations
 * - user_location_history
 * - payments
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ensure uuid extension exists
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    const convertPkToUuid = async (tableName) => {
      // Add temporary UUID column with default
      await queryInterface.addColumn(tableName, 'id_uuid', {
        type: Sequelize.UUID,
        allowNull: false,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
      });

      // Populate UUIDs (default already fills for new rows; ensure all rows have value)
      await queryInterface.sequelize.query(`UPDATE "${tableName}" SET id_uuid = uuid_generate_v4() WHERE id_uuid IS NULL;`);

      // Drop existing primary key constraint
      await queryInterface.sequelize.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${tableName}_pkey";`);

      // Drop old id column
      await queryInterface.removeColumn(tableName, 'id');

      // Rename id_uuid to id
      await queryInterface.renameColumn(tableName, 'id_uuid', 'id');

      // Add new primary key
      await queryInterface.sequelize.query(`ALTER TABLE "${tableName}" ADD PRIMARY KEY (id);`);
    };

    // Run conversion for each table
    await convertPkToUuid('settings');
    await convertPkToUuid('validations');
    await convertPkToUuid('user_location_history');
    await convertPkToUuid('payments');
  },

  async down(queryInterface, Sequelize) {
    // Best-effort rollback: convert UUID back to integer autoincrement (loses original id values)
    const convertPkToInteger = async (tableName) => {
      // Add temporary integer column
      await queryInterface.addColumn(tableName, 'id_int', {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: false,
      });

      // Fill with row_number()
      await queryInterface.sequelize.query(`
        WITH ordered AS (
          SELECT id, ROW_NUMBER() OVER () AS rn FROM "${tableName}"
        )
        UPDATE "${tableName}" t
        SET id_int = o.rn
        FROM ordered o
        WHERE t.id = o.id;
      `);

      // Drop existing PK
      await queryInterface.sequelize.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${tableName}_pkey";`);

      // Drop uuid id column
      await queryInterface.removeColumn(tableName, 'id');

      // Rename id_int to id
      await queryInterface.renameColumn(tableName, 'id_int', 'id');

      // Add new primary key
      await queryInterface.sequelize.query(`ALTER TABLE "${tableName}" ADD PRIMARY KEY (id);`);
    };

    await convertPkToInteger('payments');
    await convertPkToInteger('user_location_history');
    await convertPkToInteger('validations');
    await convertPkToInteger('settings');
  },
};
