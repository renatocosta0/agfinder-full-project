/**
 * Wrapper para funções assíncronas que captura erros e os passa para o middleware de erro
 * @param {Function} fn - Função assíncrona a ser executada
 * @returns {Function} Express middleware function
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => next(err));
};

module.exports = catchAsync; 