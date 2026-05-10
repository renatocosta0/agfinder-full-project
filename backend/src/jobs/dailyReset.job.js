/**
 * Job de Reset Diário de Status
 * Atualiza o status de POIs a cada dia à meia-noite
 */

const cron = require('node-cron');
const { PointOfInterest, Contribution, sequelize } = require('../models');
const logger = require('../utils/logger');
const enrichmentMiddleware = require('../middleware/enrichment.middleware');
const { Op } = require('sequelize');

// Configuração do scheduler
const SCHEDULE_EXPRESSION = process.env.DAILY_RESET_SCHEDULE || '59 23 * * *'; // 23:59 todos os dias
const MAX_BATCH_SIZE = 100; // Tamanho máximo de lotes para processamento
const NOTIFICATION_THRESHOLD = 100; // Threshold para notificação de alto impacto
const ENABLE_NOTIFICATIONS = process.env.ENABLE_NOTIFICATIONS === 'true';
const MAX_RETRY_ATTEMPTS = 3;

let isRunning = false;
let lastRunTimestamp = null;
let retryAttempts = 0;

/**
 * Inicia o job de reset diário
 */
function initDailyResetJob() {
  logger.info(`Inicializando job de reset diário com schedule: ${SCHEDULE_EXPRESSION}`);
  
  // Verificar se a expressão cron é válida
  if (!cron.validate(SCHEDULE_EXPRESSION)) {
    logger.error(`Expressão cron inválida: ${SCHEDULE_EXPRESSION}`);
    return;
  }
  
  // Agendar o job
  const job = cron.schedule(SCHEDULE_EXPRESSION, async () => {
    // Evitar execuções concorrentes
    if (isRunning) {
      logger.warn('Job de reset diário já está em execução. Ignorando nova execução.');
      return;
    }
    
    isRunning = true;
    logger.info('Iniciando job de reset diário de status');
    
    try {
      await performDailyReset();
      
      // Registrar execução bem-sucedida
      lastRunTimestamp = new Date();
      retryAttempts = 0;
      
      logger.info(`Job de reset diário concluído em ${new Date()}`);
    } catch (error) {
      logger.error('Erro durante execução do job de reset diário:', error);
      
      // Tentar novamente em caso de falha
      if (retryAttempts < MAX_RETRY_ATTEMPTS) {
        retryAttempts++;
        const delayMinutes = Math.pow(2, retryAttempts); // Backoff exponencial
        
        logger.info(`Tentando novamente em ${delayMinutes} minutos (tentativa ${retryAttempts} de ${MAX_RETRY_ATTEMPTS})`);
        
        // Agendar nova tentativa
        setTimeout(async () => {
          logger.info(`Iniciando nova tentativa de reset diário (${retryAttempts} de ${MAX_RETRY_ATTEMPTS})`);
          
          try {
            await performDailyReset();
            lastRunTimestamp = new Date();
            retryAttempts = 0;
            logger.info(`Job de reset diário concluído na tentativa ${retryAttempts}`);
          } catch (retryError) {
            logger.error(`Falha na tentativa ${retryAttempts} de reset diário:`, retryError);
            
            if (ENABLE_NOTIFICATIONS) {
              sendErrorNotification(`Falha em todas as ${retryAttempts} tentativas de reset diário`);
            }
          } finally {
            isRunning = false;
          }
        }, delayMinutes * 60 * 1000);
        
        return;
      } else if (ENABLE_NOTIFICATIONS) {
        sendErrorNotification(`Falha em todas as ${MAX_RETRY_ATTEMPTS} tentativas de reset diário`);
      }
    } finally {
      // Garantir que o flag de execução seja liberado mesmo em caso de erro
      isRunning = false;
    }
  });
  
  // Habilitar a execução automática do job
  job.start();
  
  logger.info('Job de reset diário agendado com sucesso');
  
  return job;
}

/**
 * Executa o processo de reset diário
 * @returns {Promise<void>}
 */
async function performDailyReset() {
  // Obter todos os POIs com contribuições
  const pois = await getActivePois();
  logger.info(`Processando reset diário para ${pois.length} POIs ativos`);
  
  let updatedCount = 0;
  let errorCount = 0;
  const impactedPois = [];
  
  // Processar em lotes para evitar sobrecarga de memória
  for (let i = 0; i < pois.length; i += MAX_BATCH_SIZE) {
    const batch = pois.slice(i, i + MAX_BATCH_SIZE);
    logger.debug(`Processando lote ${Math.floor(i / MAX_BATCH_SIZE) + 1} de ${Math.ceil(pois.length / MAX_BATCH_SIZE)}`);
    
    try {
      const result = await processPoiBatch(batch);
      updatedCount += result.updated;
      errorCount += result.errors;
      impactedPois.push(...result.impacted);
    } catch (error) {
      logger.error(`Erro ao processar lote de POIs (${i} - ${i + batch.length})`, error);
      errorCount += batch.length;
      throw error; // Propagar erro para que a função principal possa tratá-lo
    }
  }
  
  // Após atualizar status/caches, purgar contribuições anteriores ao dia corrente
  try {
    const purgeResult = await purgePriorDayContributions();
    logger.info(`Purge diário concluído: ${purgeResult.deletedValidations} validações e ${purgeResult.deletedContributions} contribuições removidas`);
  } catch (purgeError) {
    logger.error('Erro durante purge diário de contribuições:', purgeError);
  }

  // Registrar estatísticas
  logger.info(`Reset diário concluído: ${updatedCount} POIs atualizados, ${errorCount} erros`);
  
  // Se houver um número significativo de POIs impactados, enviar notificação
  if (impactedPois.length >= NOTIFICATION_THRESHOLD && ENABLE_NOTIFICATIONS) {
    sendImpactNotification(impactedPois);
  }
  
  return {
    updated: updatedCount,
    errors: errorCount,
    impacted: impactedPois
  };
}

/**
 * Purga contribuições do dia anterior (antes do início do dia corrente)
 * Deleta primeiro validations dependentes, depois contributions, em lotes
 */
async function purgePriorDayContributions() {
  const PURGE_ENABLED = process.env.PURGE_OLD_CONTRIBUTIONS === 'true';
  if (!PURGE_ENABLED) {
    return { deletedContributions: 0, deletedValidations: 0 };
  }

  const BATCH_SIZE = parseInt(process.env.PURGE_BATCH_SIZE, 10) || 1000;
  const keepDays = parseInt(process.env.PURGE_KEEP_DAYS, 10);
  const daysToKeep = Number.isFinite(keepDays) ? keepDays : 0; // 0 = apagar tudo anterior ao dia corrente

  // calcular o limite de data: início do dia corrente - daysToKeep
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff = new Date(startOfToday);
  if (daysToKeep > 0) {
    cutoff.setDate(cutoff.getDate() - daysToKeep);
  }

  let totalDeletedContrib = 0;
  let totalDeletedValid = 0;

  while (true) {
    // Buscar um lote de contributions antigas
    const oldContribs = await Contribution.findAll({
      where: { created_at: { [Op.lt]: cutoff } },
      attributes: ['id'],
      limit: BATCH_SIZE
    });

    if (!oldContribs.length) break;

    const ids = oldContribs.map(c => c.id);

    // Deletar validations dependentes (se não houver ON DELETE CASCADE)
    const deletedVal = await sequelize.models.Validation.destroy({
      where: { contribution_id: { [Op.in]: ids } }
    });
    totalDeletedValid += deletedVal;

    // Deletar contributions
    const deletedContrib = await Contribution.destroy({
      where: { id: { [Op.in]: ids } }
    });
    totalDeletedContrib += deletedContrib;
  }

  return { deletedContributions: totalDeletedContrib, deletedValidations: totalDeletedValid };
}

/**
 * Busca POIs com contribuições ativas
 * @returns {Promise<Array>} Lista de POIs
 */
async function getActivePois() {
  try {
    const result = await PointOfInterest.findAll({
      attributes: ['id', 'poi_type', 'name'],
      include: [
        {
          model: Contribution,
          as: 'contributions',
          required: true,
          limit: 1,
          order: [['created_at', 'DESC']],
          attributes: ['id', 'created_at', 'contribution_type']
        }
      ]
    });
    
    return result;
  } catch (error) {
    logger.error('Erro ao buscar POIs ativos:', error);
    throw error;
  }
}

/**
 * Processa um lote de POIs para atualização de status
 * @param {Array} pois - Lote de POIs para processar
 * @returns {Promise<Object>} Resultado do processamento
 */
async function processPoiBatch(pois) {
  let updated = 0;
  let errors = 0;
  const impacted = [];
  
  // Obter a data de 24 horas atrás para análise de impacto
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  
  // Verificar quais POIs precisam mudar de status
  for (const poi of pois) {
    try {
      const latestContribution = poi.contributions[0];
      
      if (!latestContribution) {
        continue; // Ignorar POIs sem contribuições
      }
      
      const contributionDate = new Date(latestContribution.created_at);
      const hoursSinceUpdate = (new Date() - contributionDate) / (1000 * 60 * 60);
      
      // Determinar se o status do POI será impactado pelo reset diário
      let statusImpacted = false;
      
      // Um POI é impactado quando cruza um limite de status
      // Por exemplo, passar de menos de 24h para mais de 24h
      if (hoursSinceUpdate <= 24 && hoursSinceUpdate + 24 > 24) {
        statusImpacted = true; // Vai cruzar de amarelo para vermelho
      } else if (hoursSinceUpdate <= 12 && hoursSinceUpdate + 24 > 12) {
        statusImpacted = true; // Vai cruzar de verde para amarelo
      }
      
      if (statusImpacted) {
        impacted.push({
          id: poi.id,
          name: poi.name,
          type: poi.poi_type,
          lastUpdate: contributionDate
        });
      }
      
      // Invalidar cache para forçar recálculo de status
      await enrichmentMiddleware.invalidateEnrichmentCache(poi.id);
      
      updated++;
    } catch (error) {
      logger.error(`Erro ao processar POI ${poi.id}:`, error);
      errors++;
    }
  }
  
  return { updated, errors, impacted };
}

/**
 * Envia notificação de erro para administradores
 * @param {string} message - Mensagem de erro
 */
function sendErrorNotification(message) {
  // Implementação depende do sistema de notificação escolhido
  // Exemplo: enviar e-mail, SMS, ou notificação para sistema de monitoramento
  logger.error(`NOTIFICAÇÃO DE ERRO: ${message}`);
  
  // Stub para integração futura
  // notificationService.sendAdminAlert({
  //   type: 'error',
  //   message: message,
  //   source: 'dailyReset.job',
  //   timestamp: new Date()
  // });
}

/**
 * Envia notificação de impacto significativo
 * @param {Array} impactedPois - Lista de POIs impactados
 */
function sendImpactNotification(impactedPois) {
  const message = `Reset diário impactou significativamente ${impactedPois.length} POIs`;
  logger.warn(message);
  
  // Stub para integração futura
  // notificationService.sendAdminAlert({
  //   type: 'warning',
  //   message: message,
  //   data: {
  //     count: impactedPois.length,
  //     sample: impactedPois.slice(0, 10) // Primeiros 10 como amostra
  //   },
  //   source: 'dailyReset.job',
  //   timestamp: new Date()
  // });
}

/**
 * Executa o reset manualmente (para uso em scripts ou testes)
 * @returns {Promise<Object>} Resultado do reset
 */
async function runManualReset() {
  if (isRunning) {
    throw new Error('Reset diário já está em execução');
  }
  
  isRunning = true;
  
  try {
    logger.info('Iniciando reset manual de status');
    const result = await performDailyReset();
    logger.info('Reset manual concluído');
    return result;
  } finally {
    isRunning = false;
  }
}

/**
 * Verifica se o reset diário foi executado hoje
 * @returns {boolean} Verdadeiro se foi executado hoje
 */
function wasRunToday() {
  if (!lastRunTimestamp) {
    return false;
  }
  
  const today = new Date();
  return lastRunTimestamp.getDate() === today.getDate() &&
         lastRunTimestamp.getMonth() === today.getMonth() &&
         lastRunTimestamp.getFullYear() === today.getFullYear();
}

module.exports = {
  initDailyResetJob,
  runManualReset,
  wasRunToday
}; 