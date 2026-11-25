const { validationResult } = require('express-validator');
const { AppError } = require('./error.middleware');

function validateRequest(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg
    }));
    return next(
      new AppError(400, formatted[0].message || 'Datele trimise nu sunt valide.', formatted)
    );
  }
  return next();
}

module.exports = {
  validateRequest
};
