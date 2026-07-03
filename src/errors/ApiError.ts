import { UniSmsError } from './UniSmsError.js';

/**
 * Thrown when the UniSMS API responds with a non-2xx HTTP status code.
 *
 * Exposes both the HTTP {@link ApiError.statusCode} and the raw
 * {@link ApiError.responseBody} text (not JSON-decoded) so callers can
 * inspect the failure even when the response body is not valid JSON.
 */
export class ApiError extends UniSmsError {
  /** The HTTP status code returned by the UniSMS API. */
  public readonly statusCode: number;

  /** The raw, undecoded response body text returned by the UniSMS API. */
  public readonly responseBody: string;

  public constructor(
    message: string,
    statusCode: number,
    responseBody: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
