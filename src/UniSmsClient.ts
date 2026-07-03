import { ApiError, TransportError, UniSmsError } from './errors/index.js';
import { FetchTransport } from './transport/FetchTransport.js';
import { isRetryableStatusCode, RetryableError, withRetry } from './transport/retry.js';
import type { SendSmsRequest, Transport } from './types.js';
import { UniSmsResponse } from './types.js';

/** The UniSMS API base URL. This is a constant; overriding it is only useful for testing. */
export const DEFAULT_BASE_URL = 'https://unismsapi.com/api/sms';

/** Default per-request timeout in milliseconds (matches the PHP reference's 30s cURL default). */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Default number of retries after the initial attempt (up to 3 total attempts). */
export const DEFAULT_MAX_RETRIES = 2;

/** Default base delay in milliseconds for exponential retry backoff. */
export const DEFAULT_RETRY_DELAY_MS = 250;

/** The sender ID used when {@link SendSmsRequest.senderId} is not provided. */
export const DEFAULT_SENDER_ID = 'UniSMS';

/**
 * Configuration options accepted by {@link UniSmsClient}.
 *
 * Every option can also be supplied via environment variable as a
 * convenience (`UNISMS_SECRET_KEY`, `UNISMS_BASE_URL`, `UNISMS_TIMEOUT`).
 * Explicit constructor arguments always take precedence over environment
 * variables, which in turn take precedence over the built-in defaults.
 */
export interface UniSmsClientOptions {
  /**
   * Override the API base URL. Defaults to `https://unismsapi.com/api/sms`,
   * or the `UNISMS_BASE_URL` environment variable if set.
   */
  baseURL?: string;

  /**
   * Per-request timeout in milliseconds. Defaults to `30000` (30s), or the
   * `UNISMS_TIMEOUT` environment variable if set.
   */
  timeout?: number;

  /**
   * Maximum number of retries after the initial attempt. Defaults to `2`
   * (i.e. up to 3 total attempts). Set to `0` to disable retries entirely.
   *
   * Retries only apply to network/connection errors, timeouts, HTTP 429,
   * and HTTP 5xx responses — other 4xx responses are not retried since
   * they indicate a client-side/validation problem that a retry won't fix.
   *
   * **Caution:** retrying `send()` carries a real risk of duplicate SMS
   * delivery if an earlier attempt actually succeeded server-side but its
   * response was lost (e.g. due to a timeout). If you cannot tolerate
   * possible duplicate messages, set `maxRetries: 0`.
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds used for exponential backoff between
   * retries (doubles each attempt, capped at 5000ms). Defaults to `250`.
   */
  retryDelay?: number;

  /**
   * A custom {@link Transport} implementation. Useful for unit testing
   * without real network calls, or for swapping in your own HTTP client.
   * Defaults to a {@link FetchTransport} backed by Node's built-in `fetch`.
   */
  transport?: Transport;
}

function nonEmpty(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function resolveBaseURL(options?: UniSmsClientOptions): string {
  if (nonEmpty(options?.baseURL)) {
    return options.baseURL;
  }
  if (nonEmpty(process.env.UNISMS_BASE_URL)) {
    return process.env.UNISMS_BASE_URL;
  }
  return DEFAULT_BASE_URL;
}

function resolveTimeout(options?: UniSmsClientOptions): number {
  if (typeof options?.timeout === 'number' && Number.isFinite(options.timeout)) {
    return options.timeout;
  }
  const envTimeout = process.env.UNISMS_TIMEOUT;
  if (nonEmpty(envTimeout)) {
    const parsed = Number(envTimeout);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return DEFAULT_TIMEOUT_MS;
}

function resolveSecretKey(secretKey: string): string {
  if (nonEmpty(secretKey)) {
    return secretKey;
  }
  if (nonEmpty(process.env.UNISMS_SECRET_KEY)) {
    return process.env.UNISMS_SECRET_KEY;
  }
  return secretKey;
}

/**
 * Client for the UniSMS API (https://unismsapi.com) — a developer-friendly
 * SMS API for the Philippines supporting all major carriers (Globe, Smart,
 * DITO, Sun, TNT).
 *
 * This client implements exactly the two operations exposed by the UniSMS
 * reference API: sending an SMS ({@link UniSmsClient.send}) and fetching a
 * previously sent message's delivery status ({@link UniSmsClient.getMessage}).
 *
 * @example
 * ```ts
 * import { UniSmsClient } from '@taliffsss/unisms';
 *
 * const client = new UniSmsClient('your-secret-key');
 *
 * const response = await client.send({
 *   recipient: '+639171234567',
 *   content: 'Hello world',
 * });
 * ```
 */
export class UniSmsClient {
  private readonly secretKey: string;

  private readonly baseURL: string;

  private readonly timeout: number;

  private readonly maxRetries: number;

  private readonly retryDelay: number;

  private readonly transport: Transport;

  /**
   * Create a new UniSMS API client.
   *
   * @param secretKey - Your UniSMS secret key, used as the HTTP Basic Auth
   *   username on every request. Falls back to the `UNISMS_SECRET_KEY`
   *   environment variable when an empty string is passed. Throws
   *   {@link UniSmsError} immediately if no non-empty key can be resolved.
   * @param options - Optional client configuration (see {@link UniSmsClientOptions}).
   */
  public constructor(secretKey: string, options?: UniSmsClientOptions) {
    const resolvedSecretKey = resolveSecretKey(secretKey);

    if (!nonEmpty(resolvedSecretKey)) {
      throw new UniSmsError('Secret key must not be empty.');
    }

    this.secretKey = resolvedSecretKey;
    this.baseURL = resolveBaseURL(options);
    this.timeout = resolveTimeout(options);
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelay = options?.retryDelay ?? DEFAULT_RETRY_DELAY_MS;
    this.transport = options?.transport ?? new FetchTransport();
  }

  /**
   * Send an SMS message.
   *
   * Validates `recipient` and `content` client-side before making any
   * network call — both are required and must be non-empty, or a
   * {@link UniSmsError} is thrown synchronously (well, from within the
   * returned rejected promise, since this method is `async`).
   *
   * @param request - The SMS to send. See {@link SendSmsRequest}.
   * @returns The decoded JSON response from the API.
   *
   * @throws {UniSmsError} if `recipient` or `content` is missing/empty, or
   *   if the response body cannot be parsed as JSON.
   * @throws {ApiError} if the API responds with a non-2xx status.
   * @throws {TransportError} if the request cannot be completed (network
   *   failure, timeout, etc.) after exhausting all retries.
   */
  public async send(request: SendSmsRequest): Promise<UniSmsResponse> {
    if (!nonEmpty(request.recipient)) {
      throw new UniSmsError('Recipient is required and must not be empty.');
    }

    if (!nonEmpty(request.content)) {
      throw new UniSmsError('SMS content is required and must not be empty.');
    }

    const jsonBody: Record<string, unknown> = {
      recipient: request.recipient,
      content: request.content,
      sender_id: nonEmpty(request.senderId) ? request.senderId : DEFAULT_SENDER_ID,
    };

    if (request.metadata !== undefined) {
      jsonBody.metadata = request.metadata;
    }

    const body = await this.performRequest({
      method: 'POST',
      url: this.baseURL,
      jsonBody,
    });

    return this.decode(body);
  }

  /**
   * Fetch the delivery status of a previously sent SMS.
   *
   * @param id - The message id returned by {@link UniSmsClient.send}. Must
   *   be non-empty. It is URL-encoded before being appended to the request path.
   * @returns The decoded JSON response from the API.
   *
   * @throws {UniSmsError} if `id` is missing/empty, or if the response body
   *   cannot be parsed as JSON.
   * @throws {ApiError} if the API responds with a non-2xx status.
   * @throws {TransportError} if the request cannot be completed (network
   *   failure, timeout, etc.) after exhausting all retries.
   */
  public async getMessage(id: string): Promise<UniSmsResponse> {
    if (!nonEmpty(id)) {
      throw new UniSmsError('Message id is required and must not be empty.');
    }

    const url = `${this.baseURL}/${encodeURIComponent(id)}`;

    const body = await this.performRequest({
      method: 'GET',
      url,
    });

    return this.decode(body);
  }

  private async performRequest(req: {
    method: 'GET' | 'POST';
    url: string;
    jsonBody?: Record<string, unknown>;
  }): Promise<string> {
    return withRetry(
      async () => {
        let response;
        try {
          response = await this.transport.request({
            method: req.method,
            url: req.url,
            authKey: this.secretKey,
            jsonBody: req.jsonBody,
            timeoutMs: this.timeout,
          });
        } catch (error) {
          // Network/timeout errors are always retryable. Custom Transport
          // implementations aren't required to throw TransportError
          // themselves, so normalize here to honor this method's contract.
          const transportError =
            error instanceof TransportError
              ? error
              : new TransportError(
                  `UniSMS request to [${req.url}] failed: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                  { cause: error },
                );
          throw new RetryableError(transportError);
        }

        if (response.statusCode >= 400) {
          const apiError = new ApiError(
            `UniSMS API responded with status ${response.statusCode}.`,
            response.statusCode,
            response.body,
          );

          if (isRetryableStatusCode(response.statusCode)) {
            throw new RetryableError(apiError);
          }

          throw apiError;
        }

        return response.body;
      },
      {
        maxRetries: this.maxRetries,
        retryDelayMs: this.retryDelay,
      },
    );
  }

  private decode(body: string): UniSmsResponse {
    try {
      const parsed: unknown = JSON.parse(body);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Expected a JSON object.');
      }
      return new UniSmsResponse(parsed as Record<string, unknown>);
    } catch (error) {
      throw new UniSmsError(
        `Failed to decode UniSMS API response: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
}
