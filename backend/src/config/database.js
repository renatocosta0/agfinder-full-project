const dotenv = require('dotenv');

dotenv.config();

// Helper para verificar se o SSL deve ser habilitado
const shouldUseSSL = process.env.SSL_ENABLED === 'true';

module.exports = {
  development: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
    dialectOptions: {
      useUTC: false,
      // Adiciona SSL apenas se habilitado 
      ...(shouldUseSSL && {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        }
      })
    },
    timezone: 'Africa/Luanda', // Angola timezone
  },
  test: {
    url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
    dialectOptions: {
      useUTC: false,
      // Adiciona SSL apenas se habilitado
      ...(shouldUseSSL && {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        }
      })
    },
    timezone: 'Africa/Luanda',
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
    dialectOptions: {
      useUTC: false,
      // Adiciona SSL apenas se habilitado
      ...(shouldUseSSL && {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        }
      })
    },
    timezone: 'Africa/Luanda',
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
  },
}; 