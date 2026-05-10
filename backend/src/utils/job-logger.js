/**
 * Logger especializado para os jobs do AGFINDER
 * Implementa rotação de arquivos e múltiplos níveis de log
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Verificar e criar o diretório de logs, se necessário
const LOG_DIR = path.resolve(__dirname, '../../logs/jobs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Formatar a data para o nome do arquivo de log
const getFormattedDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Formatar a data e hora para o timestamp do log
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString();
};

// Configurar os formatos
const formats = {
  console: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: getTimestamp }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const metaStr = Object.keys(meta).length 
        ? `\n${JSON.stringify(meta, null, 2)}` 
        : '';
      return `${timestamp} ${level}: ${message}${metaStr}`;
    })
  ),
  file: winston.format.combine(
    winston.format.timestamp({ format: getTimestamp }),
    winston.format.json()
  )
};

// Criar o logger com múltiplos transportes
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'job-service' },
  transports: [
    // Log detalhado para console durante desenvolvimento
    new winston.transports.Console({
      format: formats.console
    }),
    
    // Log de erros em arquivo separado
    new winston.transports.File({
      filename: path.join(LOG_DIR, `error-${getFormattedDate()}.log`),
      level: 'error',
      format: formats.file,
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    
    // Log completo
    new winston.transports.File({
      filename: path.join(LOG_DIR, `combined-${getFormattedDate()}.log`),
      format: formats.file,
      maxsize: 10485760, // 10MB
      maxFiles: 30
    })
  ]
});

// Adicionar log separado para informações de coleta de POIs
logger.child({ service: 'pois-collector' });

// Adicionar funções auxiliares
logger.startJob = (jobName, params = {}) => {
  logger.info(`Job iniciado: ${jobName}`, { 
    job: jobName, 
    action: 'start',
    params
  });
};

logger.endJob = (jobName, stats = {}) => {
  logger.info(`Job finalizado: ${jobName}`, { 
    job: jobName, 
    action: 'end',
    duration: stats.duration,
    ...stats
  });
};

logger.updateProgress = (jobName, progress = {}) => {
  // Usando debug para não poluir demais os logs
  logger.debug(`Progresso do job: ${jobName}`, { 
    job: jobName, 
    action: 'progress',
    ...progress
  });
};

// Monitorar uso de memória periodicamente
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  logger.debug('Uso de memória dos jobs', {
    rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB', // Resident Set Size
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
    external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
  });
}, 60 * 60 * 1000); // A cada 1 hora

module.exports = logger; 