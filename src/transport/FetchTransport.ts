import { TransportError } from '../errors/index.js';
import type { Transport, TransportRequest, TransportResponse } from '../types.js';

/**
 * Default {@link Transport} implementation backed by Node's built-in
 * `fetch` (available globally since Node.js 18).
 *
 * This transport performs a single HTTP attempt per call — retry policy is
 * applied at a higher layer (see `src/transport/retry.ts` and
 * `UniSmsClient`), matching the PHP reference implementation's separation
 * between `CurlTransport` (single attempt) and any retry wrapper.
 */
export class FetchTransport implements Transport {
  public async request(req: TransportRequest): Promise<TransportResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs);

    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${req.authKey}:`).toString('base64')}`,
    };

    let body: string | undefined;
    if (req.jsonBody !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.jsonBody);
    }

    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers,
        body,
        signal: controller.signal,
      });

      const responseBody = await response.text();

      return {
        statusCode: response.status,
        body: responseBody,
      };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new TransportError(
          `UniSMS request to [${req.url}] timed out after ${req.timeoutMs}ms.`,
          { cause: error },
        );
      }

      throw new TransportError(
        `UniSMS request to [${req.url}] failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
