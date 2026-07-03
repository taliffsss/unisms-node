import { UniSmsError } from './UniSmsError.js';

/**
 * Thrown when the underlying HTTP transport fails to reach the UniSMS API
 * before any HTTP response was received — for example a network failure,
 * DNS error, connection reset, or a request timeout.
 *
 * The original underlying error (if any) is available via the standard
 * `Error.cause` property (also re-exposed as {@link TransportError.cause}
 * for convenience/discoverability).
 */
export class TransportError extends UniSmsError {
  /** The underlying error that caused the transport failure, if available. */
  public override readonly cause?: unknown;

  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TransportError';
    this.cause = options?.cause;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
