/**
 * @taliffsss/unisms — Official Node.js/TypeScript SDK for the UniSMS API
 * (https://unismsapi.com).
 *
 * @packageDocumentation
 */

export {
  UniSmsClient,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_SENDER_ID,
} from './UniSmsClient.js';
export type { UniSmsClientOptions } from './UniSmsClient.js';

export { UniSmsError, TransportError, ApiError } from './errors/index.js';

export { UniSmsResponse } from './types.js';
export type {
  SendSmsRequest,
  Transport,
  TransportRequest,
  TransportResponse,
  HttpMethod,
} from './types.js';

export { FetchTransport } from './transport/FetchTransport.js';
