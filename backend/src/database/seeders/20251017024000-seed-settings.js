"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert(
      "settings",
      [
        { key: "app.name", value: "AGFinder", description: "Application name", created_at: now, updated_at: now },
        { key: "app.version", value: "1.0.0", description: "Application version", created_at: now, updated_at: now },
        { key: "rate_limit.windowMs", value: "60000", description: "Rate limit window in ms", created_at: now, updated_at: now },
        { key: "rate_limit.max", value: "100", description: "Max requests per window per IP", created_at: now, updated_at: now },
        { key: "rate_limit.trust_proxy", value: "true", description: "Trust proxy for rate limit", created_at: now, updated_at: now },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "settings",
      {
        key: [
          "app.name",
          "app.version",
          "rate_limit.windowMs",
          "rate_limit.max",
          "rate_limit.trust_proxy",
        ],
      },
      {}
    );
  },
};
