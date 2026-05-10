/**
 * Rotas para funcionalidades do sistema
 */

const express = require('express');
const systemController = require('../controllers/system.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');
let scheduler = null;
try {
  scheduler = require('../jobs/scheduler');
} catch (_) {
  scheduler = null;
}

const { SyncLog } = require('../models');

const router = express.Router();

/**
 * @api {get} /system/stats Obter estatísticas do sistema
 * @apiDescription Obter estatísticas do sistema, incluindo fila de requisições da API, sincronização de POIs, etc.
 * @apiName GetSystemStats
 * @apiGroup System
 * @apiPermission admin
 *
 * @apiSuccess {Object} stats Estatísticas do sistema
 */
router.get(
  '/stats',
  authenticate,
  systemController.getSystemStats
);

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Verificar saúde do servidor API
 *     description: Retorna status de saúde da API e timestamp
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API está operacional
 */
router.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'dev'
  });
});

// Public lightweight config for mobile app consumption
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      CONTRIBUTION_TTL_MINUTES: parseInt(process.env.CONTRIBUTION_TTL_MINUTES || '30', 10),
      CONTRIBUTION_EXPIRY_MINUTES: parseInt(process.env.CONTRIBUTION_EXPIRY_MINUTES || '60', 10)
    }
  });
});

/**
 * @swagger
 * /api/health/scheduler:
 *   get:
 *     summary: Verificar saúde do scheduler de jobs
 *     description: Retorna status de saúde do scheduler e estatísticas de filas
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Status do scheduler
 */
router.get('/api/health/scheduler', async (req, res) => {
  try {
    // Verificar se o módulo scheduler está disponível
    if (!scheduler || !scheduler.healthCheck) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'O scheduler não está configurado ou não possui função de healthcheck',
        timestamp: new Date().toISOString()
      });
    }
    
    // Obter status do scheduler
    const healthStatus = await scheduler.healthCheck();
    
    res.json({
      ...healthStatus,
      serverTimestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro ao verificar saúde do scheduler:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Erro ao verificar saúde do scheduler',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: Obter configurações públicas do sistema
 *     description: Retorna configurações não-sensíveis da aplicação
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações do sistema
 *       401:
 *         description: Não autenticado
 */
router.get('/api/config', authenticate, (req, res) => {
  // Retornar apenas configurações não-sensíveis
  res.json({
    api: {
      version: process.env.npm_package_version || 'dev',
      environment: process.env.NODE_ENV,
      timezone: 'Africa/Luanda'
    },
    features: {
      notifications: process.env.ENABLE_NOTIFICATIONS === 'true',
      caching: true,
      optimizationMobile: true
    },
    settings: {
      contributionExpiryMinutes: parseInt(process.env.CONTRIBUTION_EXPIRY_MINUTES || '60'),
      defaultRadius: 5
    }
  });
});

/**
 * @swagger
 * /api/diagnostics:
 *   get:
 *     summary: Diagnóstico do sistema (apenas admin)
 *     description: Retorna informações detalhadas de diagnóstico do sistema
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informações de diagnóstico
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Não autorizado (apenas admin)
 */
router.get('/api/diagnostics', authenticate, isAdmin, async (req, res) => {
  try {
    const { sequelize } = require('../models');
    const os = require('os');
    
    // Diagnóstico do banco de dados
    const dbStatus = await sequelize.authenticate()
      .then(() => 'connected')
      .catch(() => 'error');
    
    // Diagnóstico do sistema
    const diagnostics = {
      timestamp: new Date().toISOString(),
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpus: os.cpus().length,
        loadAvg: os.loadavg()
      },
      database: {
        status: dbStatus,
        dialect: sequelize.getDialect(),
        host: sequelize.config.host
      },
      scheduler: {
        enabled: process.env.RUN_SCHEDULER_WITH_SERVER === 'true',
        status: scheduler && scheduler.healthCheck ? 
                (await scheduler.healthCheck()).status : 'unknown'
      }
    };
    
    res.json({
      success: true,
      data: diagnostics
    });
  } catch (error) {
    logger.error('Erro ao gerar diagnóstico:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar diagnóstico do sistema'
    });
  }
});

/**
 * @swagger
 * /api/system/sync/angola:
 *   post:
 *     summary: Iniciar sincronização de Angola sob demanda
 *     description: Limpa o banco de dados e importa novos POIs de Angola. Requer autenticação de administrador.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sincronização agendada com sucesso
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro ao agendar sincronização
 */
router.post('/api/system/sync/angola', authenticate, isAdmin, async (req, res) => {
  try {
    if (!scheduler || !scheduler.queues || !scheduler.queues.weeklySyncAngola) {
      return res.status(503).json({
        success: false,
        error: 'Scheduler não configurado'
      });
    }
    
    // Agendar job de sincronização de Angola com alta prioridade
    const job = await scheduler.queues.weeklySyncAngola.add('manual-sync-angola', {
      requestedBy: req.user.id,
      requestedAt: new Date(),
      isManual: true
    }, {
      priority: 1 // Prioridade máxima
    });
    
    logger.info(`Sincronização manual de Angola agendada pelo usuário ${req.user.id}`, { jobId: job.id });
    
    return res.json({
      success: true,
      message: 'Sincronização de Angola agendada com sucesso',
      jobId: job.id
    });
  } catch (error) {
    logger.error('Erro ao agendar sincronização de Angola:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao agendar sincronização de Angola'
    });
  }
});

/**
 * @swagger
 * /api/system/sync/angola/status/{jobId}:
 *   get:
 *     summary: Verificar status da sincronização de Angola
 *     description: Retorna o status atual de um job de sincronização de Angola
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do job de sincronização
 *     responses:
 *       200:
 *         description: Status do job
 *       404:
 *         description: Job não encontrado
 *       500:
 *         description: Erro ao verificar status
 */
router.get('/api/system/sync/angola/status/:jobId', authenticate, isAdmin, async (req, res) => {
  try {
    if (!scheduler || !scheduler.queues || !scheduler.queues.weeklySyncAngola) {
      return res.status(503).json({
        success: false,
        error: 'Scheduler não configurado'
      });
    }
    
    const { jobId } = req.params;
    const job = await scheduler.queues.weeklySyncAngola.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job não encontrado'
      });
    }
    
    // Obter o estado do job
    const state = await job.getState();
    const progress = job._progress || 0;
    const result = job.returnvalue;
    const error = job.failedReason;
    const logs = await SyncLog.findOne({
      where: {
        details: {
          job_id: jobId
        }
      },
      order: [['created_at', 'DESC']]
    });
    
    return res.json({
      success: true,
      data: {
        jobId,
        state,
        progress,
        result,
        error,
        logs: logs ? logs.details : null,
        createdAt: job.timestamp,
        processedAt: job.processedOn,
        finishedAt: job.finishedOn
      }
    });
  } catch (error) {
    logger.error('Erro ao verificar status da sincronização:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar status da sincronização'
    });
  }
});

module.exports = router; 