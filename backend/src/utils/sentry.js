const Sentry = require('@sentry/node');
const logger = require('./logger');

// Inicializar Sentry apenas em produção e se SENTRY_DSN estiver configurado
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE 
      ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) 
      : 0.1, // 10% das transações rastreadas
    beforeSend(event, hint) {
      // Adicionar informações customizadas ao evento
      if (hint && hint.originalException) {
        event.extra = {
          ...event.extra,
          errorMessage: hint.originalException.message,
          errorStack: hint.originalException.stack,
        };
      }
      return event;
    },
  });
  logger.info('Sentry initialized successfully');
} else {
  logger.info('Sentry not initialized (missing SENTRY_DSN or not in production)');
}

// Middleware para capturar erros do Express
const sentryErrorHandler = Sentry.Handlers.errorHandler();

// Middleware para capturar requisições
const sentryRequestHandler = Sentry.Handlers.requestHandler();

module.exports = {
  Sentry,
  sentryErrorHandler,
  sentryRequestHandler,
};
