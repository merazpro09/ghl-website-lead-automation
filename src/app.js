import express from 'express';
import crypto from 'node:crypto';
import { normalizePayload } from './normalize.js';
import { validateLead } from './validate.js';
import { forwardToGhl } from './forwarder.js';

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Builds the Express app. Dependencies are injectable for tests.
 */
export function createApp(config, { forward = forwardToGhl, logger = console } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.post('/webhooks/elementor', async (req, res) => {
    // Elementor can't set custom headers, so the secret travels as ?token=
    if (config.webhookSecret) {
      const token = req.query.token || req.get('x-webhook-token') || '';
      if (!safeEqual(token, config.webhookSecret)) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
    }

    const { lead, meta } = normalizePayload(req.body, config);
    const errors = validateLead(lead);
    if (errors.length) {
      return res.status(422).json({ ok: false, errors });
    }

    try {
      const result = await forward(config.ghlWebhookUrl, { ...lead, ...meta, source: 'website-form' }, {
        timeoutMs: config.timeoutMs,
        maxRetries: config.maxRetries,
      });
      logger.info?.(`Lead forwarded to GHL (attempts: ${result.attempts})`);
      return res.json({ ok: true });
    } catch (err) {
      // Never log the full lead or the webhook URL
      logger.error?.(`Failed to forward lead: ${err.message}`);
      return res.status(502).json({ ok: false, error: 'Could not deliver lead. Please try again.' });
    }
  });

  return app;
}
