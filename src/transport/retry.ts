/**
 * Configuration controlling how {@link withRetry} retries failed requests.
 */
export interface RetryOptions {
  /** Maximum number of retries after the initial attempt (0 disables retries). */
  maxRetries: number;

  /** Base delay in milliseconds for exponential backoff. */
  retryDelayMs: number;

  /** Upper bound (in milliseconds) that the backoff delay is capped at. */
  maxRetryDelayMs?: number;
}

/** HTTP status codes that are considered retryable. */
export function isRetryableStatusCode(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number, options: RetryOptions): number {
  const cap = options.maxRetryDelayMs ?? 5000;
  const delay = options.retryDelayMs * 2 ** attempt;
  return Math.min(delay, cap);
}

/**
 * Marker used by callers to indicate that a caught error/response is
 * retryable according to the UniSMS retry policy (network errors,
 * timeouts, HTTP 429, and HTTP 5xx).
 */
export class RetryableError extends Error {
  public constructor(public override readonly cause: unknown) {
    super('Retryable error');
    this.name = 'RetryableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Run `fn` and retry it according to `options` when it throws a
 * {@link RetryableError}. Any other thrown error propagates immediately
 * without retrying.
 *
 * @param fn - The operation to attempt. Should throw {@link RetryableError}
 *   (wrapping the real error) when the failure is retryable.
 * @param options - Retry policy configuration.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let attempt = 0;

  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof RetryableError) || attempt >= options.maxRetries) {
        throw error instanceof RetryableError ? error.cause : error;
      }

      await sleep(backoffDelay(attempt, options));
      attempt += 1;
    }
  }
}
