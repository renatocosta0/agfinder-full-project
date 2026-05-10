const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Verificar se existe DATABASE_URL
if (process.env.DATABASE_URL) {
  // Usar DATABASE_URL diretamente
  module.exports = {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development',
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false,
      } : undefined,
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  };
} else {
  // Fallback para configuração individual de parâmetros
  const dialect = process.env.DB_DIALECT || 'postgres';
  const config = {
    dialect,
    logging: process.env.NODE_ENV === 'development',
  };

  // Configuração específica para SQLite
  if (dialect === 'sqlite') {
    config.storage = process.env.DB_STORAGE || ':memory:';
  } else {
    // Configuração para PostgreSQL ou outro banco de dados SQL
    config.host = process.env.DB_HOST || 'localhost';
    config.port = parseInt(process.env.DB_PORT, 10) || 5432;
    config.database = process.env.DB_NAME || 'agfinder';
    config.username = process.env.DB_USER || 'postgres';
    config.password = process.env.DB_PASSWORD || '';
    
    // Configurações adicionais para PostgreSQL
    config.dialectOptions = {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false,
      } : undefined,
    };
    
    // Pool de conexões
    config.pool = {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    };
  }

  module.exports = config;
} 