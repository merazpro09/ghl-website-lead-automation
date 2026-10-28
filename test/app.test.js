import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig({
  GHL_WEBHOOK_URL: 'https://hooks.example.test/webhook',
  WEBHOOK_SECRET: 'test-secret',
  FIELD_MAP: '{"No label field abc1234":"wants_short_call"}',
  BOOLEAN_FIELDS: 'wants_short_call',
  FORWARD_MAX_RETRIES: '0',
});
const silent = { info: () => {}, error: () => {} };

describe('POST /webhooks/elementor', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('rejects requests without the shared token', async () => {
    const res = await request(createApp(config, { logger: silent })).post('/webhooks/elementor').send({ Email: 'a@example.com' });
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards a normalized lead from a form-encoded Elementor post', async () => {
    const res = await request(createApp(config, { logger: silent }))
      .post('/webhooks/elementor?token=test-secret')
      .type('form')
      .send({
        Name: 'Jane Example',
        Email: 'JANE@example.com',
        'Website URL': 'example.com',
        'No label field abc1234': 'on',
        form_name: 'Free Audit',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({
      first_name: 'Jane',
      last_name: 'Example',
      email: 'jane@example.com',
      website: 'example.com',
      wants_short_call: 'Yes',
      form_name: 'Free Audit',
      source: 'website-form',
    });
  });

  it('returns 422 for invalid input and does not forward', async () => {
    const res = await request(createApp(config, { logger: silent }))
      .post('/webhooks/elementor?token=test-secret')
      .send({ Name: 'No Contact' });
    expect(res.status).toBe(422);
    expect(res.body.errors).toContain('Either email or phone is required.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 when GHL is down', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const res = await request(createApp(config, { logger: silent }))
      .post('/webhooks/elementor?token=test-secret')
      .send({ Email: 'a@example.com' });
    expect(res.status).toBe(502);
  });

  it('exposes a health check', async () => {
    const res = await request(createApp(config)).get('/health');
    expect(res.body).toEqual({ ok: true });
  });
});
