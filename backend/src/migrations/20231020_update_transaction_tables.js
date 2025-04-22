'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if bonus_transactions table exists
    const bonusTransactionsTableExists = await queryInterface.sequelize
      .query(`SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'bonus_transactions'
      );`)
      .then(([results]) => results[0].exists);
      
    if (bonusTransactionsTableExists) {
      // Check if columns exist before adding them
      const bonusColumns = await queryInterface.sequelize
        .query(`SELECT column_name FROM information_schema.columns
                WHERE table_name = 'bonus_transactions'`);
      const existingBonusColumns = bonusColumns[0].map(col => col.column_name);
      
      // Add is_used column if it doesn't exist
      if (!existingBonusColumns.includes('is_used')) {
        await queryInterface.addColumn('bonus_transactions', 'is_used', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        });
      }
      
      // Add used_at column if it doesn't exist
      if (!existingBonusColumns.includes('used_at')) {
        await queryInterface.addColumn('bonus_transactions', 'used_at', {
          type: Sequelize.DATE,
          allowNull: true,
        });
      }
      
      // Add applied_subscription_id column if it doesn't exist
      if (!existingBonusColumns.includes('applied_subscription_id')) {
        await queryInterface.addColumn('bonus_transactions', 'applied_subscription_id', {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'subscription_transactions',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        });
      }
      
      // Add indexes if they don't exist
      const indexesBonus = await queryInterface.sequelize
        .query(`SELECT indexname FROM pg_indexes WHERE tablename = 'bonus_transactions'`);
      const existingBonusIndexes = indexesBonus[0].map(idx => idx.indexname);
      
      if (!existingBonusIndexes.includes('bonus_transactions_used_idx')) {
        await queryInterface.addIndex('bonus_transactions', {
          fields: ['is_used'],
          name: 'bonus_transactions_used_idx',
        });
      }
      
      if (!existingBonusIndexes.includes('bonus_transactions_expiry_idx')) {
        await queryInterface.addIndex('bonus_transactions', {
          fields: ['expiry_date'],
          name: 'bonus_transactions_expiry_idx',
        });
      }
    }
    
    // Check if subscription_transactions table exists
    const subscriptionTransactionsTableExists = await queryInterface.sequelize
      .query(`SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'subscription_transactions'
      );`)
      .then(([results]) => results[0].exists);
      
    if (subscriptionTransactionsTableExists) {
      // Check if columns exist before adding them
      const subColumns = await queryInterface.sequelize
        .query(`SELECT column_name FROM information_schema.columns
                WHERE table_name = 'subscription_transactions'`);
      const existingSubColumns = subColumns[0].map(col => col.column_name);
      
      // Add is_active column if it doesn't exist
      if (!existingSubColumns.includes('is_active')) {
        await queryInterface.addColumn('subscription_transactions', 'is_active', {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: false,
        });
      }
      
      // Add payment_amount column if it doesn't exist
      if (!existingSubColumns.includes('payment_amount')) {
        await queryInterface.addColumn('subscription_transactions', 'payment_amount', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        });
      }
      
      // Add payment_currency column if it doesn't exist
      if (!existingSubColumns.includes('payment_currency')) {
        await queryInterface.addColumn('subscription_transactions', 'payment_currency', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }
      
      // Add indexes if they don't exist
      const indexesSub = await queryInterface.sequelize
        .query(`SELECT indexname FROM pg_indexes WHERE tablename = 'subscription_transactions'`);
      const existingSubIndexes = indexesSub[0].map(idx => idx.indexname);
      
      if (!existingSubIndexes.includes('subscription_transactions_active_idx')) {
        await queryInterface.addIndex('subscription_transactions', {
          fields: ['is_active'],
          name: 'subscription_transactions_active_idx',
        });
      }
      
      if (!existingSubIndexes.includes('subscription_transactions_expiry_idx')) {
        await queryInterface.addIndex('subscription_transactions', {
          fields: ['expires_at'],
          name: 'subscription_transactions_expiry_idx',
        });
      }
      
      // Update subscription_type ENUM to include 'bonus' if needed
      try {
        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_subscription_transactions_subscription_type" ADD VALUE IF NOT EXISTS 'bonus' AFTER 'monthly'`
        );
      } catch (error) {
        console.log('Could not add ENUM value, it may already exist or require a different approach');
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Note: This down migration is complex because we need to check if indexes and columns exist
    // before trying to remove them. For brevity, we're omitting the detailed checks.
    try {
      // Remove indexes
      await queryInterface.removeIndex('subscription_transactions', 'subscription_transactions_expiry_idx').catch(() => {});
      await queryInterface.removeIndex('subscription_transactions', 'subscription_transactions_active_idx').catch(() => {});
      await queryInterface.removeIndex('bonus_transactions', 'bonus_transactions_expiry_idx').catch(() => {});
      await queryInterface.removeIndex('bonus_transactions', 'bonus_transactions_used_idx').catch(() => {});

      // Remove fields from subscription_transactions table
      await queryInterface.removeColumn('subscription_transactions', 'payment_currency').catch(() => {});
      await queryInterface.removeColumn('subscription_transactions', 'payment_amount').catch(() => {});
      await queryInterface.removeColumn('subscription_transactions', 'is_active').catch(() => {});

      // Remove fields from bonus_transactions table
      await queryInterface.removeColumn('bonus_transactions', 'applied_subscription_id').catch(() => {});
      await queryInterface.removeColumn('bonus_transactions', 'used_at').catch(() => {});
      await queryInterface.removeColumn('bonus_transactions', 'is_used').catch(() => {});
      
      // Note: PostgreSQL doesn't support removing ENUM values, so we can't revert the ENUM change
    } catch (error) {
      console.error('Down migration error:', error);
    }
  },
}; 