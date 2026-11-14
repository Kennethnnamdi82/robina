import { createHash, randomUUID } from 'node:crypto';
import { Router, raw } from 'express';
import { webhooks, BachsWebhookError } from '@bachs/sdk';
import { env } from '../config/env.js';
import { BachsWebhookEvent } from './models.js';

const outcomes = new Map([
  ['collection.succeeded', 'payment_succeeded'],
  ['collection.failed', 'payment_failed'],
  ['checkout.expired', 'checkout_expired'],
]);
const signatureNames = new Set(['x-bachs-signature-v2', 'x-bachs-timestamp', 'x-bachs-signature']);
const hash = value => createHash('sha256').update(value).digest('hex');
const defaultLogger = entry => console.info('[bachs-webhook]', JSON.stringify(entry));
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function signatureHeaders(req) {
  // Node joins duplicate headers; detect multiplicity before invoking the SDK.
  const headers = {};
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    const key = req.rawHeaders[i].toLowerCase();
    if (!signatureNames.has(key)) continue;
    const value = req.rawHeaders[i + 1];
    if (headers[key] !== undefined) throw new BachsWebhookError('Duplicate webhook signature header.');
    headers[key] = value;
  }
  return headers;
}

export function createBachsWebhookRoutes({ isReady, logger = defaultLogger }) {
  const router = Router();
  router.post('/webhook', (req, res, next) => {
    const started = Date.now();
    res.set('Cache-Control', 'no-store');
    res.locals.bachsDelivery = { deliveryRef: randomUUID(), outcome: 'rejected' };
    res.once('finish', () => {
      // Never log the body, URLs/query strings, headers, secrets, PII or errors.
      const entry = { provider: 'bachs', ...res.locals.bachsDelivery,
        status: res.statusCode, durationMs: Date.now() - started };
      try { logger(entry); } catch { console.error('[bachs-webhook] delivery_log_failed'); }
    });
    if (!env.bachsWebhookSecret) {
      res.locals.bachsDelivery.outcome = 'not_configured';
      return res.status(503).json({ error: 'webhook_unavailable' });
    }
    if (!req.is('application/json')) return res.status(415).json({ error: 'unsupported_media_type' });
    next();
  }, raw({ type: 'application/json', limit: '64kb', inflate: false }), asyncRoute(async (req, res) => {
    let event;
    try {
      if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'invalid_webhook' });
      // The official SDK verifies exact bytes and timestamp before parsing JSON.
      // Do not JSON.stringify(req.body), mutate it or pass it through a JSON parser.
      event = webhooks.constructEvent(req.body, signatureHeaders(req), env.bachsWebhookSecret);
    } catch (error) {
      res.locals.bachsDelivery.outcome = error instanceof BachsWebhookError ? 'invalid_webhook' : 'verification_error';
      return res.status(error instanceof BachsWebhookError ? 400 : 500).json({
        error: error instanceof BachsWebhookError ? 'invalid_webhook' : 'webhook_verification_failed',
      });
    }
    if (event.id.length > 256 || event.type.length > 128 || event.organization_id.length > 256) {
      return res.status(400).json({ error: 'invalid_webhook' });
    }
    const outcome = outcomes.get(event.type) ?? 'ignored';
    Object.assign(res.locals.bachsDelivery, { eventRef: hash(event.id).slice(0, 16),
      eventType: outcomes.has(event.type) ? event.type : 'unsupported' });
    if (!isReady()) {
      res.locals.bachsDelivery.outcome = 'database_unavailable';
      return res.status(503).json({ error: 'webhook_unavailable' });
    }
    try {
      await BachsWebhookEvent.create({ _id: event.id, type: event.type,
        organizationId: event.organization_id, outcome, payloadSha256: hash(req.body) });
      res.locals.bachsDelivery.outcome = outcome;
      return res.status(200).json({ received: true, ignored: outcome === 'ignored' });
    } catch (error) {
      if (error?.code === 11000) {
        try {
          // An earlier write may have timed out before majority acknowledgement.
          // Never acknowledge a duplicate based only on an uncommitted local read.
          const previous = await BachsWebhookEvent.findById(event.id)
            .select('type organizationId').readConcern('majority').lean();
          if (previous) {
            if (previous.type !== event.type || previous.organizationId !== event.organization_id) {
              res.locals.bachsDelivery.outcome = 'event_conflict';
              return res.status(409).json({ error: 'webhook_event_conflict' });
            }
            // A redelivery never changes the first receipt or executes effects.
            res.locals.bachsDelivery.outcome = 'duplicate';
            return res.status(200).json({ received: true, duplicate: true });
          }
        } catch { /* No successful acknowledgement if durable deduplication fails. */ }
      }
      res.locals.bachsDelivery.outcome = 'database_error';
      return res.status(503).json({ error: 'webhook_unavailable' });
    }
  }));
  router.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    // Body-parser errors can contain raw bytes; never pass them to the generic logger.
    const status = [400, 413, 415].includes(error.status) ? error.status : 500;
    if (res.locals.bachsDelivery) res.locals.bachsDelivery.outcome = status === 500 ? 'handler_error' : 'body_rejected';
    res.status(status).json({ error: status === 413 ? 'payload_too_large'
      : status === 415 ? 'unsupported_media_type' : status === 500 ? 'webhook_failed' : 'invalid_webhook' });
  });
  return router;
}
