const logger = require('../utils/logger');

// Middleware para validar requests com Joi
const validate = (schema) => {
  return (req, res, next) => {
    const validationObjects = {};
    
    // Verificar cada parte do request que deve ser validada
    ['params', 'query', 'body'].forEach((key) => {
      if (schema[key]) {
        const { value, error } = schema[key].validate(req[key], { 
          abortEarly: false,
          stripUnknown: true,
          allowUnknown: true
        });
        
        if (error) {
          // Se houver erro, adiciona ao objeto de erros
          validationObjects[key] = { error };
        } else {
          // Se não houver erro, substitui os valores validados
          req[key] = value;
        }
      }
    });
    
    // Verificar se houve algum erro
    const hasError = Object.values(validationObjects).some(obj => obj.error);
    
    if (hasError) {
      // Preparar mensagens de erro
      const errors = Object.keys(validationObjects)
        .filter(key => validationObjects[key].error)
        .map(key => ({
          source: key,
          errors: validationObjects[key].error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }))
        .flat();
      
      logger.debug('Validation errors:', errors);
      
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors
      });
    }
    
    next();
  };
};

module.exports = validate; 