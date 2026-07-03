import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, RetryableError, isRetryableStatusCode } from '../src/transport/retry.js';

describe('isRetryableStatusCode', () => {
  it('treats 429 and 5xx as retryable', () => {
    expect(isRetryableStatusCode(429)).toBe(true);
    expect(isRetryableStatusCode(500)).toBe(true);
    expect(isRetryableStatusCode(503)).toBe(true);
  });

  it('treats other 4xx as non-retryable', () => {
    expect(isRetryableStatusCode(400)).toBe(false);
    expect(isRetryableStatusCode(401)).toBe(false);
    expect(isRetryableStatusCode(404)).toBe(false);
  });

  it('treats 2xx/3xx as non-retryable', () => {
    expect(isRetryableStatusCode(200)).toBe(false);
    expect(isRetryableStatusCode(301)).toBe(false);
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the result immediately on success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 2, retryDelayMs: 10 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('propagates non-retryable errors immediately', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(withRetry(fn, { maxRetries: 2, retryDelayMs: 10 })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('unwraps the cause of a RetryableError once retries are exhausted', async () => {
    const underlying = new Error('underlying failure');
    const fn = vi.fn().mockRejectedValue(new RetryableError(underlying));

    const promise = withRetry(fn, { maxRetries: 2, retryDelayMs: 10 }).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const error = await promise;

    expect(error).toBe(underlying);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('applies exponential backoff capped at maxRetryDelayMs', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableError(new Error('e1')))
      .mockRejectedValueOnce(new RetryableError(new Error('e2')))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, {
      maxRetries: 2,
      retryDelayMs: 1000,
      maxRetryDelayMs: 1500,
    });

    await vi.advanceTimersByTimeAsync(1000); // first retry delay
    await vi.advanceTimersByTimeAsync(1500); // second retry delay (capped)

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
