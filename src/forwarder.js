const sleepDefault = (ms) => new Promise((r) => setTimeout(r, ms));

export class ForwardError extends Error {
  constructor(message, { status, attempts } = {}) {
    super(message);
    this.name = 'ForwardError';
    this.status = status;
    this.attempts = attempts;
  }
}

function isRetryable(status) {
  return status === 429 || status >= 500;
}

/**
 * POSTs JSON to the GHL inbound webhook with a per-attempt timeout and
 * exponential backoff. 4xx responses (except 429) are not retried.
 */
export async function forwardToGhl(
  url,
  payload,
  { timeoutMs = 8000, maxRetries = 3, fetchImpl = globalThis.fetch, sleep = sleepDefault, baseDelayMs = 500 } = {},
) {
  if (!url) throw new ForwardError('GHL_WEBHOOK_URL is not configured.', { attempts: 0 });

  let lastError;
  const totalAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) return { ok: true, status: res.status, attempts: attempt };

      lastError = new ForwardError(`GHL responded with HTTP ${res.status}`, { status: res.status, attempts: attempt });
      if (!isRetryable(res.status)) throw lastError;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ForwardError && !isRetryable(err.status)) throw err;
      lastError =
        err instanceof ForwardError
          ? err
          : new ForwardError(err.name === 'AbortError' ? `Timed out after ${timeoutMs} ms` : err.message, {
              attempts: attempt,
            });
    }

    if (attempt < totalAttempts) {
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  lastError.attempts = totalAttempts;
  throw lastError;
}
