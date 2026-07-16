/**
 * asyncHandler
 * Wraps an async Express route handler so any thrown error is forwarded
 * to next(err) automatically instead of crashing the process.
 *
 * Usage:
 *   router.get('/path', asyncHandler(myAsyncController))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
