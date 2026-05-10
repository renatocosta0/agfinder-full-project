const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
// Optional Redis store for rate limiting in production
const Redis = require('ioredis');
const RedisStore = require('rate-limit-redis');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const openApiComponents = require('./docs/components');
const dotenv = require('dotenv');
const { sequelize } = require('./models');
const logger = require('./utils/logger');
// Lazy-initialized job modules
let cron;
let scheduler;

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
app.set('trust proxy', 1); // Required for correct IP behind Render proxy
const PORT = process.env.PORT || 3000;

// Funções para a configuração de segurança
const getCSPDirectives = (isDevelopment = false) => {
  // Configuração base CSP que é comum a todos os ambientes
  const baseDirectives = {
    defaultSrc: ["'self'"],
    connectSrc: [
      "'self'",
      'https://*.google-analytics.com',
      'https://www.google-analytics.com',
      'https://analytics.google.com',
      'https://www.googletagmanager.com',
      'https://stats.g.doubleclick.net',
      'https://auth.expo.io',
      'https://accounts.google.com',
      'https://www.googleapis.com'
    ],
    scriptSrc: [
      "'self'",
      'https://www.googletagmanager.com',
      'https://googletagmanager.com',
      'https://tagmanager.google.com',
      'https://www.google-analytics.com',
      'https://ssl.google-analytics.com',
      'https://www.googleanalytics.com',
      'https://analytics.google.com',
      'https://accounts.google.com',
      'https://apis.google.com'
    ],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      'https://www.google-analytics.com',
      'https://ssl.gstatic.com',
      'https://www.gstatic.com',
      'https://www.googletagmanager.com',
      'https://ssl.google-analytics.com',
      'https://stats.g.doubleclick.net',
      'https://*.googleusercontent.com'
    ],
    mediaSrc: ["'self'", 'data:', 'blob:'],
    fontSrc: ["'self'", 'data:'],
    frameSrc: [
      "'self'",
      'https://accounts.google.com',
      'https://auth.expo.io'
    ],
    workerSrc: ["'self'", 'blob:'],
    objectSrc: ["'none'"]
  };

  // Adicionar configurações específicas para desenvolvimento
  if (isDevelopment) {
    baseDirectives.scriptSrc.push("'unsafe-inline'", "'unsafe-eval'");
    baseDirectives.connectSrc.push('http://localhost:*', 'ws://localhost:*', 'http://127.0.0.1:*', 'ws://127.0.0.1:*');
  }

  return baseDirectives;
};

// Configuração CORS - mais permissiva em desenvolvimento, restritiva em produção
const getCorsOptions = (isDevelopment = false) => {
  if (isDevelopment) {
    return {
      origin: '*', // Permissivo para desenvolvimento
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    };
  } else {
    const extraOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      origin: [
        'https://agfinder.app',
        'https://www.agfinder.app',
        'https://app.agfinder.app',
        /\.agfinder\.app$/,
        ...extraOrigins,
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    };
  }
};

// Determinar o ambiente
const nodeEnv = process.env.NODE_ENV || 'development';
const isDevelopment = nodeEnv === 'development';

// Aplicar configurações de segurança
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: getCSPDirectives(isDevelopment)
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Aplicar configurações CORS
app.use(cors(getCorsOptions(isDevelopment)));

// Parser de JSON
app.use(express.json());

// Logging
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting
const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 10);
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10);
const windowMs = Number.isFinite(windowMinutes) ? windowMinutes * 60 * 1000 : 15 * 60 * 1000;
const max = Number.isFinite(maxRequests) ? maxRequests : 100;

let limiterOptions = {
  windowMs,
  max,
  message: 'Too many requests from this IP, please try again after a while',
};

if (process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
  try {
    const parsed = new URL(process.env.REDIS_URL);
    if (!parsed.port) parsed.port = '6379';
    const redisClient = new Redis(process.env.REDIS_URL);
    limiterOptions.store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    });
    logger.info('Rate limiting configured with Redis store');
  } catch (e) {
    logger.warn('Failed to connect to Redis for rate limiting, using in-memory store:', e.message || e);
    logger.info('Rate limiting configured with in-memory store');
  }
} else {
  logger.info('Rate limiting configured with in-memory store');
}

const limiter = rateLimit(limiterOptions);
app.use('/api', limiter);

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AGFINDER API',
      version: '1.0.0',
      description: 'API for the AGFINDER application',
    },
    servers: [
      {
        url: process.env.API_BASE_URL || `http://localhost:${PORT}`,
        description: process.env.API_BASE_URL ? 'Configured server' : 'Development server',
      },
    ],
    components: openApiComponents,
  },
  // Include nested route files (e.g., routes/v1/*.js)
  apis: ['./src/routes/*.js', './src/routes/**/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Expose raw OpenAPI JSON
app.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs);
});

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/pois', require('./routes/pois.routes'));
app.use('/api/contributions', require('./routes/contributions.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/subscriptions', require('./routes/subscriptions.routes'));
app.use('/api/webhooks', require('./routes/webhooks.routes'));
app.use('/api/warnings', require('./routes/v1/warnings.route'));
app.use('/api/bonus', require('./routes/v1/bonus.route'));
app.use('/api/payments', require('./routes/v1/payment.route'));
app.use('/api/system', require('./routes/system.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`${err.statusCode || err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  let statusCode = 500;
  if (typeof err.statusCode === 'number') statusCode = err.statusCode;
  else if (typeof err.status === 'number') statusCode = err.status;

  const statusText = typeof err.status === 'string'
    ? err.status
    : (String(statusCode).startsWith('4') ? 'fail' : 'error');

  res.status(statusCode).json({
    status: statusText,
    message: err.message || 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Start the server
let server;
async function startServer() {
  try {
    // Firebase Admin SDK initialization removed for this phase (no Google/Firebase OAuth)

    // Verificar conexão com o banco de dados
    try {
      await sequelize.authenticate();
      logger.info('Database connection has been established successfully.');

      // Optional: auto-sync DB schema from models (development only)
      if (process.env.DB_AUTO_SYNC === 'true') {
        const force = process.env.DB_SYNC_FORCE === 'true';
        const alter = process.env.DB_SYNC_ALTER === 'true';
        logger.warn(`DB auto sync enabled (force=${force}, alter=${alter})`);
        await sequelize.sync({ force, alter });
        logger.info('Sequelize sync completed');
      }
    } catch (dbError) {
      logger.warn('Unable to connect to the database, continuing with limited functionality:', dbError);
      // Continuar mesmo com erro de banco de dados para permitir testes do Firebase
    }

    // Start cron jobs
    if (process.env.ENABLE_CRON === 'true') {
      cron = require('./jobs/cron');
      cron.initJobs();
      logger.info('Cron jobs initialized');

      // Initialize unified daily reset purge at 23:59
      const dailyResetJob = require('./jobs/dailyReset.job');
      dailyResetJob.initDailyResetJob();
      logger.info('Daily reset purge job initialized');
    } else {
      logger.info('Cron jobs disabled');
    }

    // Start server
    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);

      if (isDevelopment) {
        console.log(`Server running on port ${PORT}`);
        console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
      }
    });

    // Removed Bull scheduler integration; node-cron is the single orchestrator now

    return server;
  } catch (error) {
    logger.error('Unable to start server:', error);

    if (isDevelopment) {
      console.error('Unable to start server:', error);
    }

    process.exit(1);
  }
}

// Configurar graceful shutdown
process.on('SIGTERM', async () => {
  await shutdown('SIGTERM');
});

process.on('SIGINT', async () => {
  await shutdown('SIGINT');
});

async function shutdown(signal) {
  logger.info(`Recebido sinal ${signal}, encerrando servidor...`);

  const finalize = async () => {
    try {
      if (process.env.RUN_SCHEDULER_WITH_SERVER === 'true' && scheduler) {
        logger.info('Desligando scheduler de jobs...');
        await scheduler.shutdown(signal);
      }
      logger.info('Aplicação encerrada com sucesso');
      process.exit(0);
    } catch (error) {
      logger.error('Erro ao desligar aplicação:', error);
      process.exit(1);
    }
  };

  if (server && server.close) {
    server.close(async () => {
      logger.info('Servidor HTTP fechado');
      await finalize();
    });

    // Se demorar muito para fechar, forçar saída após timeout
    setTimeout(() => {
      logger.error('Não foi possível encerrar o servidor graciosamente, forçando saída');
      process.exit(1);
    }, 10000);
  } else {
    logger.warn('Servidor HTTP não inicializado; encerrando processo diretamente');
    await finalize();
  }
}

if (require.main === module) {
  startServer();
}

// Exportar para testes e execução programática
module.exports = { app, startServer };