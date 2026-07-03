/**
 * Request payload for {@link UniSmsClient.send}.
 */
export interface SendSmsRequest {
  /** The recipient's mobile number (required, non-empty). */
  recipient: string;

  /** The SMS message body (required, non-empty). */
  content: string;

  /**
   * The sender ID shown to the recipient.
   *
   * @defaultValue `"UniSMS"`
   */
  senderId?: string;

  /**
   * Arbitrary key/value metadata attached to the message, echoed back by
   * the API (useful for correlating messages with your own records).
   *
   * When omitted, no `metadata` key is sent in the request body at all.
   */
  metadata?: Record<string, unknown>;
}

/**
 * The decoded JSON response body returned by the UniSMS API.
 *
 * The UniSMS API does not publish a fixed, guaranteed response schema, so
 * this is intentionally a flexible key/value map rather than a rigid
 * interface with invented fields. Use {@link UniSmsResponse.get} for
 * convenient, type-safe-ish access to individual fields.
 */
export class UniSmsResponse {
  /** The raw decoded JSON object returned by the API. */
  public readonly raw: Record<string, unknown>;

  public constructor(raw: Record<string, unknown>) {
    this.raw = raw;
  }

  /**
   * Get a value from the decoded response by key.
   *
   * @param key - The top-level key to read from the response object.
   * @returns The value at `key`, or `undefined` if not present.
   */
  public get<T = unknown>(key: string): T | undefined {
    return this.raw[key] as T | undefined;
  }

  /**
   * Convenience accessor mirroring {@link JSON.stringify} support — allows
   * `JSON.stringify(response)` to serialize the underlying raw object.
   */
  public toJSON(): Record<string, unknown> {
    return this.raw;
  }
}

/**
 * HTTP methods used by the UniSMS transport layer.
 */
export type HttpMethod = 'GET' | 'POST';

/**
 * A single HTTP request to be performed by a {@link Transport}.
 */
export interface TransportRequest {
  /** HTTP method, e.g. `"GET"` or `"POST"`. */
  method: HttpMethod;

  /** Fully qualified request URL. */
  url: string;

  /** Secret key sent as the HTTP Basic Auth username (password is empty). */
  authKey: string;

  /** JSON-serializable request body. Omitted entirely for GET requests. */
  jsonBody?: Record<string, unknown>;

  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
}

/**
 * The raw result of a completed HTTP request (i.e. a response actually
 * came back from the server, even if it's a non-2xx status).
 */
export interface TransportResponse {
  /** HTTP status code, e.g. `200`, `404`, `500`. */
  statusCode: number;

  /** Raw, undecoded response body text. */
  body: string;
}

/**
 * Abstraction over the HTTP layer so {@link UniSmsClient} can be tested
 * without making real network calls, and so the transport can be swapped
 * out (e.g. for a custom HTTP client, mock, or instrumentation wrapper).
 *
 * This mirrors the PHP reference implementation's `TransportInterface` /
 * `CurlTransport` split.
 */
export interface Transport {
  /**
   * Perform a single HTTP request and resolve with the raw response.
   *
   * Implementations should NOT throw for non-2xx HTTP responses — simply
   * resolve with the {@link TransportResponse} and let the caller (the
   * retry policy / client) decide how to interpret the status code.
   *
   * Implementations SHOULD throw a {@link TransportError} (or something
   * that can be wrapped into one) when the request cannot be completed at
   * all, e.g. network failure, DNS error, or timeout.
   */
  request(request: TransportRequest): Promise<TransportResponse>;
}
