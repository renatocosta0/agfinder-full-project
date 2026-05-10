/**
 * Serviço de e-mail para o AGFINDER
 * Wrapper em torno do nodemailer para envio de notificações e relatórios
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

// Configurações de email baseadas em variáveis de ambiente
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || 'user@example.com',
    pass: process.env.EMAIL_PASSWORD || 'password'
  },
  from: process.env.EMAIL_FROM || 'AGFINDER <no-reply@agfinder.com>'
};

// Criar transportador
const transporter = nodemailer.createTransport({
  host: emailConfig.host,
  port: emailConfig.port,
  secure: emailConfig.secure,
  auth: emailConfig.auth,
  tls: {
    rejectUnauthorized: false // Aceitar certificados auto-assinados (pode ser necessário em ambientes de desenvolvimento)
  }
});

/**
 * Verifica se o transportador de email está funcionando
 * @returns {Promise<boolean>} Sucesso da verificação
 */
async function verifyConnection() {
  try {
    await transporter.verify();
    logger.info('Conexão SMTP verificada com sucesso');
    return true;
  } catch (error) {
    logger.error('Erro ao verificar conexão SMTP:', error);
    return false;
  }
}

/**
 * Envia um email
 * @param {Object} options - Opções do email
 * @param {string|string[]} options.to - Destinatário(s)
 * @param {string} options.subject - Assunto
 * @param {string} [options.text] - Conteúdo em texto puro
 * @param {string} [options.html] - Conteúdo em HTML
 * @param {Array} [options.attachments] - Anexos
 * @returns {Promise<Object>} Informações da mensagem enviada
 */
async function sendMail({ to, subject, text, html, attachments = [] }) {
  try {
    // Validar parâmetros
    if (!to || !subject || (!text && !html)) {
      throw new Error('Parâmetros insuficientes para envio de email');
    }
    
    // Definir dados do email
    const mailOptions = {
      from: emailConfig.from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text,
      html,
      attachments
    };
    
    // Enviar email
    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`Email enviado: ${info.messageId}`, {
      to,
      subject,
      messageId: info.messageId
    });
    
    return info;
  } catch (error) {
    logger.error('Erro ao enviar email:', error);
    throw error;
  }
}

/**
 * Envia uma notificação de alerta para administradores
 * @param {string} subject - Assunto do alerta
 * @param {string} message - Mensagem do alerta
 * @param {string} [level='warning'] - Nível do alerta (info, warning, error)
 * @returns {Promise<Object>} Informações do email enviado
 */
async function sendAlert(subject, message, level = 'warning') {
  const adminEmails = process.env.ADMIN_EMAILS ? 
    process.env.ADMIN_EMAILS.split(',') : 
    ['admin@agfinder.com'];
  
  let style = '';
  let icon = '';
  
  // Estilos para diferentes níveis de alerta
  switch(level) {
    case 'error':
      style = 'color: #721c24; background-color: #f8d7da; border-color: #f5c6cb;';
      icon = '⛔';
      break;
    case 'warning':
      style = 'color: #856404; background-color: #fff3cd; border-color: #ffeeba;';
      icon = '⚠️';
      break;
    case 'info':
    default:
      style = 'color: #0c5460; background-color: #d1ecf1; border-color: #bee5eb;';
      icon = 'ℹ️';
  }
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="padding: 15px; margin-bottom: 20px; border: 1px solid transparent; border-radius: 4px; ${style}">
        <h3>${icon} ${subject}</h3>
        <div>${message}</div>
      </div>
      <div style="margin-top: 20px; font-size: 12px; color: #666;">
        <p>Este é um email automático do sistema AGFINDER. Por favor, não responda.</p>
      </div>
    </div>
  `;
  
  return sendMail({
    to: adminEmails,
    subject: `[AGFINDER ${level.toUpperCase()}] ${subject}`,
    html
  });
}

/**
 * Envia um email com um relatório em anexo
 * @param {Object} options - Opções do email
 * @param {string|string[]} options.to - Destinatário(s)
 * @param {string} options.subject - Assunto
 * @param {string} options.content - Conteúdo do email
 * @param {string} options.reportPath - Caminho para o arquivo de relatório
 * @returns {Promise<Object>} Informações do email enviado
 */
async function sendReport({ to, subject, content, reportPath }) {
  return sendMail({
    to,
    subject,
    html: content,
    attachments: [
      {
        filename: reportPath.split('/').pop(),
        path: reportPath
      }
    ]
  });
}

module.exports = {
  verifyConnection,
  sendMail,
  sendAlert,
  sendReport
}; 