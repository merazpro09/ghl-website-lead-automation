/**
 * Reads configuration from environment variables.
 * Kept as a function so tests can pass their own env object.
 */
export function loadConfig(env = process.env) {
  let fieldMap = {};
  if (env.FIELD_MAP) {
    try {
      fieldMap = JSON.parse(env.FIELD_MAP);
    } catch {
      throw new Error('FIELD_MAP must be valid JSON, e.g. {"No label field abc1234":"wants_short_call"}');
    }
  }

  return {
    port: Number(env.PORT) || 3000,
    ghlWebhookUrl: env.GHL_WEBHOOK_URL || '',
    webhookSecret: env.WEBHOOK_SECRET || '',
    fieldMap,
    booleanFields: (env.BOOLEAN_FIELDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    timeoutMs: Number(env.FORWARD_TIMEOUT_MS) || 8000,
    maxRetries: env.FORWARD_MAX_RETRIES !== undefined ? Number(env.FORWARD_MAX_RETRIES) : 3,
  };
}
