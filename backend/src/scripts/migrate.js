const { sequelize } = require('../models');
const logger = require('../utils/logger');

async function migrate() {
  try {
    // Conectar ao banco de dados
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
    
    // Cria a tabela users manualmente com SQL
    logger.info('Creating users table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" UUID PRIMARY KEY,
        "google_id" VARCHAR(255) NOT NULL UNIQUE,
        "name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "profile_picture" VARCHAR(255),
        "is_banned" BOOLEAN DEFAULT FALSE,
        "ban_reason" VARCHAR(255),
        "ban_expiry" TIMESTAMP WITH TIME ZONE,
        "warning_count" INTEGER DEFAULT 0 NOT NULL,
        "bonus_points" INTEGER DEFAULT 0 NOT NULL,
        "bonus_contribution_threshold" INTEGER,
        "last_threshold_update" TIMESTAMP WITH TIME ZONE,
        "last_bonus_award_date" TIMESTAMP WITH TIME ZONE,
        "has_active_subscription" BOOLEAN DEFAULT FALSE NOT NULL,
        "current_subscription_end" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    logger.info('Users table created successfully!');
    
    // Criar a tabela payments manualmente
    logger.info('Creating payments table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" SERIAL PRIMARY KEY,
        "user_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE CASCADE,
        "reference" VARCHAR(255) NOT NULL UNIQUE,
        "amount" DECIMAL(10,2) NOT NULL,
        "currency" VARCHAR(255) NOT NULL DEFAULT 'NGN',
        "description" VARCHAR(255) NOT NULL,
        "method" VARCHAR(50) NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
        "provider" VARCHAR(255) NOT NULL,
        "type" VARCHAR(255) NOT NULL DEFAULT 'standard',
        "payment_url" VARCHAR(255),
        "metadata" JSON DEFAULT '{}',
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE,
        "updated_at" TIMESTAMP WITH TIME ZONE
      );
      
      -- Criar os tipos enum para payments
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_payments_method') THEN
          CREATE TYPE "public"."enum_payments_method" AS ENUM('card', 'bank', 'crypto', 'wallet');
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_payments_status') THEN
          CREATE TYPE "public"."enum_payments_status" AS ENUM('pending', 'successful', 'failed');
        END IF;
      END$$;
    `);
    logger.info('Payments table created successfully!');
    
    // Sincronizar os demais modelos
    logger.info('Synchronizing remaining models...');
    const models = Object.keys(sequelize.models)
      .filter(model => model.toLowerCase() !== 'user' && model.toLowerCase() !== 'payment');
    
    for (const modelName of models) {
      const model = sequelize.models[modelName];
      await model.sync({ force: true });
      logger.info(`Model ${modelName} synchronized.`);
    }
    
    logger.info('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Executar o script de migração
migrate(); 