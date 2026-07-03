/**
 * Base class for all errors raised by the UniSMS SDK.
 *
 * Thrown directly for client-side validation failures (e.g. a missing
 * secret key, recipient, content, or message id) and for JSON decode
 * failures when parsing an API response body.
 *
 * All other SDK-specific errors ({@link TransportError}, {@link ApiError})
 * extend this class, so callers can catch `UniSmsError` to handle any
 * error raised by this library.
 */
export class UniSmsError extends Error {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UniSmsError';

    // Maintain proper prototype chain when compiling down to older targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
