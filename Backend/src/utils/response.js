/**
 * Standard JSON response helpers.
 * Usage:
 *   res.json(success(data, 'Created'))
 *   res.status(404).json(notFound('Employee not found'))
 */

const success = (data = null, message = 'OK', meta = null) => ({
  success: true,
  message,
  data,
  ...(meta ? { meta } : {}),
});

const created = (data = null, message = 'Created successfully') =>
  success(data, message);

const paginated = (rows, total, page, limit, extra = {}) =>
  success(rows, 'OK', { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit), ...extra });

const fail = (message = 'Something went wrong', errors = null) => ({
  success: false,
  message,
  ...(errors ? { errors } : {}),
});

const notFound = (message = 'Resource not found') => fail(message);

module.exports = { success, created, paginated, fail, notFound };
