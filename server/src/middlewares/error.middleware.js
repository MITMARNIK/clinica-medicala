class AppError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Ruta solicitată (${req.method} ${req.originalUrl}) nu există.`
  });
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {})
    });
  }

  // Handle MySQL duplicate key errors (e.g., unique email or unique active appointment slot)
  if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
    const sqlMsg = err.sqlMessage || '';
    if (sqlMsg.includes('uq_appointments_active_slot')) {
      return res.status(409).json({
        error: 'Acest interval orar este deja rezervat. Vă rugăm să alegeți o altă oră.'
      });
    }
    if (sqlMsg.includes('uq_users_email')) {
      return res.status(409).json({
        error: 'Există deja un cont înregistrat cu această adresă de email.'
      });
    }
    if (sqlMsg.includes('uq_specializations_name')) {
      return res.status(409).json({
        error: 'Această specializare medicală există deja.'
      });
    }
    return res.status(409).json({
      error: 'Conflict de date: înregistrarea există deja.'
    });
  }

  // Handle MySQL foreign key errors
  if (err && (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452)) {
    return res.status(400).json({
      error: 'Referință invalidă către o înregistrare inexistentă.'
    });
  }

  if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451)) {
    return res.status(409).json({
      error: 'Înregistrarea nu poate fi ștearsă deoarece are date asociate.'
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('[Server Error]', err);
  }

  return res.status(500).json({
    error: 'A apărut o eroare internă a serverului. Vă rugăm să încercați din nou.'
  });
}

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler
};
