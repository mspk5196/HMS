const { fail } = require('../utils/response');
const { AppError } = require('../utils/errors');

/**
 * Global error handler — must be registered LAST in app.js.
 * Handles AppError (expected) and any unhandled error (unexpected).
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(fail(err.message));
  }

  // MySQL / DB errors — give useful messages without leaking internals
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json(fail('Duplicate entry — this record already exists.'));
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json(fail('Reference not found — a linked record does not exist.'));
  }

  console.error(`[UNHANDLED ERROR] [${req.method}] ${req.originalUrl || req.url}:`, err);
  return res.status(500).json(fail(`Internal server error: ${err.message}`));
};

module.exports = errorHandler;
