import { describe, it, expect, vi } from 'vitest';
import { forwardToGhl, ForwardError } from '../src/forwarder.js';

const URL = 'https://hooks.example.test/webhook';
const noSleep = () => Promise.resolve();
const ok = (status = 200) => ({ ok: true, status });
const fail = (status) => ({ ok: false, status });

describe('forwardToGhl', () => {
  it('posts JSON and succeeds on first try', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const result = await forwardToGhl(URL, { email: 'a@example.com' }, { fetchImpl, sleep: noSleep });

    expect(result).toEqual({ ok: true, status: 200, attempts: 1 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@example.com' });
  });

  it('retries 5xx and network errors, then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fail(503))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(ok());
    const sleep = vi.fn(noSleep);

    const result = await forwardToGhl(URL, {}, { fetchImpl, sleep, maxRetries: 3 });
    expect(result.attempts).toBe(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 500);
    expect(sleep).toHaveBeenNthCalledWith(2, 1000);
  });

  it('does not retry 4xx errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(400));
    await expect(forwardToGhl(URL, {}, { fetchImpl, sleep: noSleep })).rejects.toMatchObject({ status: 400 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after max retries', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(500));
    await expect(forwardToGhl(URL, {}, { fetchImpl, sleep: noSleep, maxRetries: 2 })).rejects.toBeInstanceOf(ForwardError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('aborts slow requests with a timeout', async () => {
    const fetchImpl = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    await expect(
      forwardToGhl(URL, {}, { fetchImpl, sleep: noSleep, timeoutMs: 20, maxRetries: 0 }),
    ).rejects.toThrow(/Timed out after 20 ms/);
  });

  it('fails fast when no URL is configured', async () => {
    await expect(forwardToGhl('', {})).rejects.toThrow(/not configured/);
  });
});
