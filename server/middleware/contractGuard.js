/**
 * middleware/contractGuard.js — mount this globally, dev/staging only
 * Wraps every response so a malformed envelope fails loudly in dev/test/staging.
 */
function contractGuard(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof body !== 'object' || body === null || typeof body.success !== 'boolean') {
        throw new Error(`[CONTRACT VIOLATION] ${req.method} ${req.originalUrl} did not return {success, data|error} envelope`);
      }
      if (body.success && !('data' in body)) {
        throw new Error(`[CONTRACT VIOLATION] ${req.method} ${req.originalUrl} success:true missing "data"`);
      }
      if (!body.success && (!body.error || !body.error.code || !body.error.message)) {
        throw new Error(`[CONTRACT VIOLATION] ${req.method} ${req.originalUrl} error missing code/message`);
      }
    }
    return originalJson(body);
  };
  next();
}

module.exports = contractGuard;
