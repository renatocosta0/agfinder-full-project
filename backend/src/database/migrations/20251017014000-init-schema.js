"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // users (UUID PK)
    await queryInterface.createTable("users", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal("uuid_generate_v4()") },
      google_id: { type: Sequelize.STRING, allowNull: true, unique: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING, allowNull: true },
      salt: { type: Sequelize.STRING, allowNull: true },
      profile_picture: { type: Sequelize.STRING, allowNull: true },
      is_banned: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ban_reason: { type: Sequelize.STRING, allowNull: true },
      ban_expiry: { type: Sequelize.DATE, allowNull: true },
      warning_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      bonus_points: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      bonus_contribution_threshold: { type: Sequelize.INTEGER, allowNull: true },
      last_threshold_update: { type: Sequelize.DATE, allowNull: true },
      last_bonus_award_date: { type: Sequelize.DATE, allowNull: true },
      has_active_subscription: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      current_subscription_end: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    // settings
    await queryInterface.createTable("settings", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal("uuid_generate_v4()") },
      key: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      value: { type: Sequelize.TEXT, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    // daily_resets
    await queryInterface.createTable("daily_resets", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal("uuid_generate_v4()") },
      reset_date: { type: Sequelize.DATEONLY, allowNull: false, unique: true },
      status: { type: Sequelize.ENUM("success", "failed"), allowNull: false },
      details: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    // points_of_interest (UUID PK)
    await queryInterface.createTable("points_of_interest", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal("uuid_generate_v4()") },
      poi_type: { type: Sequelize.ENUM("atm", "gasstation"), allowNull: false },
      google_place_id: { type: Sequelize.STRING, allowNull: false, unique: true },
      name: { type: Sequelize.STRING, allowNull: false },
      address: { type: Sequelize.STRING, allowNull: false },
      latitude: { type: Sequelize.DECIMAL(10, 8), allowNull: false },
      longitude: { type: Sequelize.DECIMAL(11, 8), allowNull: false },
      google_data: { type: Sequelize.TEXT, allowNull: true },
      sync_source: { type: Sequelize.ENUM("google", "user", "admin", "api"), allowNull: false, defaultValue: "google" },
      last_sync_at: { type: Sequelize.DATE, allowNull: true },
      reliability_score: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 5.0 },
      data_expiration: { type: Sequelize.DATE, allowNull: true },
      status: { type: Sequelize.ENUM("active", "inactive", "pending", "deleted"), allowNull: false, defaultValue: "active" },
      status_reason: { type: Sequelize.STRING, allowNull: true },
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      change_history: { type: Sequelize.TEXT, allowNull: true },
      contributions: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      validations: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      reports: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_interactions: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    await queryInterface.addIndex("points_of_interest", ["latitude", "longitude", "status", "reliability_score"], { name: "idx_poi_location_status_reliability" });
    await queryInterface.addIndex("points_of_interest", ["poi_type"], { name: "points_of_interest_poi_type_idx" });
    await queryInterface.addIndex("points_of_interest", ["status"], { name: "idx_poi_status" });
    await queryInterface.addIndex("points_of_interest", ["reliability_score"], { name: "idx_poi_reliability" });
    await queryInterface.addIndex("points_of_interest", ["data_expiration"], { name: "idx_poi_expiration" });
    await queryInterface.addIndex("points_of_interest", ["total_interactions"], { name: "idx_poi_interactions" });

    // contributions (UUID PK) with FKs to users and points_of_interest
    await queryInterface.createTable("contributions", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal("uuid_generate_v4()") },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      poi_id: { type: Sequelize.UUID, allowNull: false, references: { model: "points_of_interest", key: "id" }, onDelete: "CASCADE" },
      contribution_type: { type: Sequelize.STRING(50), allowNull: false },
      details: { type: Sequelize.TEXT, allowNull: true },
      is_current: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      expires_at: { type: Sequelize.DATE, allowNull: true },
      verification_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      dispute_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      reliability_score: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 5.0 },
      processing_status: { type: Sequelize.ENUM("pending", "verified", "disputed", "expired", "rejected"), allowNull: false, defaultValue: "pending" },
      verified_at: { type: Sequelize.DATE, allowNull: true },
      rejection_reason: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    await queryInterface.addIndex("contributions", ["poi_id"], { name: "idx_contributions_poi" });
    await queryInterface.addIndex("contributions", ["user_id"], { name: "idx_contributions_user" });
    await queryInterface.addIndex("contributions", ["is_current"], { name: "idx_contributions_current" });
    await queryInterface.addIndex("contributions", ["expires_at"], { name: "idx_contributions_expiration" });
    await queryInterface.addIndex("contributions", ["processing_status"], { name: "idx_contributions_status" });
    await queryInterface.addIndex("contributions", ["reliability_score"], { name: "idx_contributions_reliability" });
    await queryInterface.addIndex("contributions", ["verification_count"], { name: "idx_contributions_verification" });

    // validations (FKs to contributions and users)
    await queryInterface.createTable("validations", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal("uuid_generate_v4()") },
      contribution_id: { type: Sequelize.UUID, allowNull: false, references: { model: "contributions", key: "id" }, onDelete: "CASCADE" },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      validation_type: { type: Sequelize.ENUM("valid", "report"), allowNull: false },
      comment: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    await queryInterface.addIndex("validations", ["contribution_id"], { name: "idx_validations_contribution" });
    await queryInterface.addIndex("validations", ["user_id"], { name: "idx_validations_user" });
    await queryInterface.addIndex("validations", ["contribution_id", "user_id"], { name: "idx_validations_unique_user_contribution", unique: true });

    // user_location_history (FK to users)
    await queryInterface.createTable("user_location_history", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal("uuid_generate_v4()") },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      latitude: { type: Sequelize.FLOAT, allowNull: false },
      longitude: { type: Sequelize.FLOAT, allowNull: false },
      accuracy: { type: Sequelize.FLOAT, allowNull: true },
      source: { type: Sequelize.STRING(50), allowNull: true },
      recorded_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addIndex("user_location_history", ["user_id", "recorded_at"], { name: "user_location_history_user_recorded_idx" });

    // subscription_transactions
    await queryInterface.createTable("subscription_transactions", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal("uuid_generate_v4()") },
      user_id: { type: Sequelize.UUID, allowNull: false },
      amount: { type: Sequelize.INTEGER, allowNull: false },
      subscription_type: { type: Sequelize.ENUM("daily", "weekly", "monthly", "bonus"), allowNull: false },
      payment_method: { type: Sequelize.ENUM("proxypay", "bonus"), allowNull: false },
      entity: { type: Sequelize.STRING, allowNull: true },
      reference: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.ENUM("pending", "completed", "failed"), allowNull: false, defaultValue: "pending" },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      payment_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      payment_currency: { type: Sequelize.STRING, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addIndex("subscription_transactions", ["user_id"], { name: "subscription_transactions_user_idx" });
    await queryInterface.addIndex("subscription_transactions", ["reference"], { name: "subscription_transactions_reference_idx" });
    await queryInterface.addIndex("subscription_transactions", ["status"], { name: "subscription_transactions_status_idx" });
    await queryInterface.addIndex("subscription_transactions", ["is_active"], { name: "subscription_transactions_active_idx" });
    await queryInterface.addIndex("subscription_transactions", ["expires_at"], { name: "subscription_transactions_expiry_idx" });

    // bonus_transactions
    await queryInterface.createTable("bonus_transactions", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal("uuid_generate_v4()") },
      user_id: { type: Sequelize.UUID, allowNull: false },
      amount: { type: Sequelize.INTEGER, allowNull: false },
      transaction_type: { type: Sequelize.ENUM("contribution", "referral", "welcome", "loyalty", "promotion", "validation", "subscription", "validation_bonus", "contribution_reward"), allowNull: false },
      related_contribution_id: { type: Sequelize.UUID, allowNull: true },
      description: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      expiry_date: { type: Sequelize.DATE, allowNull: true },
      is_used: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      used_at: { type: Sequelize.DATE, allowNull: true },
      applied_subscription_id: { type: Sequelize.UUID, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addIndex("bonus_transactions", ["user_id"], { name: "bonus_transactions_user_idx" });
    await queryInterface.addIndex("bonus_transactions", ["related_contribution_id"], { name: "bonus_transactions_contribution_idx" });
    await queryInterface.addIndex("bonus_transactions", ["is_used"], { name: "bonus_transactions_used_idx" });
    await queryInterface.addIndex("bonus_transactions", ["expiry_date"], { name: "bonus_transactions_expiry_idx" });

    // payments (per payment.model.js) with FK to users
    await queryInterface.createTable("payments", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal("uuid_generate_v4()") },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      reference: { type: Sequelize.STRING, allowNull: false, unique: true },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      currency: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.STRING, allowNull: false },
      method: { type: Sequelize.ENUM("card", "bank", "crypto", "wallet"), allowNull: false },
      status: { type: Sequelize.ENUM("pending", "successful", "failed"), allowNull: false, defaultValue: "pending" },
      provider: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false, defaultValue: "standard" },
      paymentUrl: { type: Sequelize.STRING, allowNull: true },
      metadata: { type: Sequelize.JSON, allowNull: true },
      verifiedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("payments");
    await queryInterface.dropTable("bonus_transactions");
    await queryInterface.dropTable("subscription_transactions");
    await queryInterface.dropTable("user_location_history");
    await queryInterface.dropTable("validations");
    await queryInterface.dropTable("contributions");
    await queryInterface.dropTable("points_of_interest");
    await queryInterface.dropTable("daily_resets");
    await queryInterface.dropTable("settings");
    await queryInterface.dropTable("users");

    // Drop ENUM types created by Sequelize (dialect: Postgres)
    const dropEnum = async (name) => {
      try { await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_${name}_status";`); } catch (_) {}
    };
    await dropEnum("daily_resets");
  },
};
