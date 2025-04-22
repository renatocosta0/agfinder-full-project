const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const dotenv = require('dotenv');
const { sequelize } = require('./models');
const logger = require('./utils/logger');
const cron = require('./jobs/cron');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 10) * 60 * 1000 || 15 * 60 * 1000, // Default: 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100, // Default: limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
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
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

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

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start the server
async function startServer() {
  try {
    // Sync Sequelize models with database
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
    
    // Apenas verificar a conexão, sem sincronizar (isso será feito pelo script de migração)
    
    // Start cron jobs
    cron.initJobs();
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`Server running on port ${PORT}`);
      console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error('Unable to start server:', error);
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer(); 