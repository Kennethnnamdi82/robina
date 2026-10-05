import { env } from '../config/env.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
}

export function errorHandler(err, req, res, _next) {
  console.error('[error]', err);
  const status = err.status || 500;
  const payload = { error: err.code || 'server_error' };
  if (status < 500 && err.expose) payload.message = err.message;
  if (env.nodeEnv !== 'production' && status >= 500) payload.message = 'server_error';
  res.status(status).json(payload);
}
