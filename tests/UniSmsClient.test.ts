import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { UniSmsClient, DEFAULT_BASE_URL } from '../src/UniSmsClient.js';
import { ApiError, TransportError, UniSmsError } from '../src/errors/index.js';
import type { Transport, TransportRequest, TransportResponse } from '../src/types.js';

/** A simple mock transport that records calls and returns/throws canned results. */
class MockTransport implements Transport {
  public calls: TransportRequest[] = [];

  private readonly responses: Array<TransportResponse | Error>;

  public constructor(responses: Array<TransportResponse | Error>) {
    this.responses = responses;
  }

  public request(req: TransportRequest): Promise<TransportResponse> {
    this.calls.push(req);
    const next = this.responses[this.calls.length - 1] ?? this.responses[this.responses.length - 1];
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    return Promise.resolve(next);
  }
}

function jsonResponse(statusCode: number, body: unknown): TransportResponse {
  return { statusCode, body: JSON.stringify(body) };
}

describe('UniSmsClient construction', () => {
  it('rejects an empty secret key', () => {
    expect(() => new UniSmsClient('')).toThrow(UniSmsError);
  });

  it('rejects a blank/whitespace-only secret key', () => {
    expect(() => new UniSmsClient('   ')).toThrow(UniSmsError);
  });

  it('falls back to UNISMS_SECRET_KEY env var when constructor arg is empty', () => {
    vi.stubEnv('UNISMS_SECRET_KEY', 'env-secret');
    expect(() => new UniSmsClient('')).not.toThrow();
    vi.unstubAllEnvs();
  });

  it('prefers explicit constructor secretKey over env var', async () => {
    vi.stubEnv('UNISMS_SECRET_KEY', 'env-secret');
    const transport = new MockTransport([jsonResponse(200, {})]);
    const client = new UniSmsClient('explicit-secret', { transport });

    await client.send({ recipient: '639171234567', content: 'hi' });

    expect(transport.calls[0]?.authKey).toBe('explicit-secret');
    vi.unstubAllEnvs();
  });

  it('uses UNISMS_BASE_URL env var when baseURL option is not provided', async () => {
    vi.stubEnv('UNISMS_BASE_URL', 'https://example.test/sms');
    const transport = new MockTransport([jsonResponse(200, {})]);
    const client = new UniSmsClient('secret-key', { transport });

    await client.send({ recipient: '639171234567', content: 'hi' });

    expect(transport.calls[0]?.url).toBe('https://example.test/sms');
    vi.unstubAllEnvs();
  });

  it('defaults to the UniSMS API base URL', async () => {
    const transport = new MockTransport([jsonResponse(200, {})]);
    const client = new UniSmsClient('secret-key', { transport });

    await client.send({ recipient: '639171234567', content: 'hi' });

    expect(transport.calls[0]?.url).toBe(DEFAULT_BASE_URL);
  });
});

describe('UniSmsClient#send', () => {
  it('sends an SMS with the expected payload', async () => {
    const transport = new MockTransport([jsonResponse(200, { id: 'abc123', status: 'queued' })]);
    const client = new UniSmsClient('secret-key', { transport });

    const response = await client.send({
      recipient: '639171234567',
      content: 'Hello world',
      senderId: 'MyBrand',
    });

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]).toMatchObject({
      method: 'POST',
      url: DEFAULT_BASE_URL,
      authKey: 'secret-key',
      jsonBody: {
        recipient: '639171234567',
        content: 'Hello world',
        sender_id: 'MyBrand',
      },
    });
    expect(response.raw).toEqual({ id: 'abc123', status: 'queued' });
    expect(response.get('id')).toBe('abc123');
  });

  it('defaults the sender_id to "UniSMS" when not provided', async () => {
    const transport = new MockTransport([jsonResponse(200, {})]);
    const client = new UniSmsClient('secret-key', { transport });

    await client.send({ recipient: '639171234567', content: 'Hello world' });

    expect(transport.calls[0]?.jsonBody?.sender_id).toBe('UniSMS');
  });

  it('includes metadata when provided', async () => {
    const transport = new MockTransport([jsonResponse(200, {})]);
    const client = new UniSmsClient('secret-key', { transport });

    await client.send({
      recipient: '639171234567',
      content: 'Hello world',
      metadata: { order_id: 12345 },
    });

    expect(transport.calls[0]?.jsonBody?.metadata).toEqual({ order_id: 12345 });
  });

  it('omits metadata entirely from the body when not provided', async () => {
    const transport = new MockTransport([jsonResponse(200, {})]);
    const client = new UniSmsClient('secret-key', { transport });

    await client.send({ recipient: '639171234567', content: 'Hello world' });

    expect(transport.calls[0]?.jsonBody).not.toHaveProperty('metadata');
  });

  it('throws UniSmsError when recipient is missing', async () => {
    const transport = new MockTransport([jsonResponse(200, {})]);
    const client = new UniSmsClient('secret-key', { transport });

    await expect(client.send({ recipient: '', content: 'Hello world' })).rejects.toThrow(
      UniSmsError,
    );
    expect(transport.calls).toHaveLength(0);
  });

  it('throws UniSmsError when content is missing', async () => {
    const transport = new MockTransport([jsonResponse(200, {})]);
    const client = new UniSmsClient('secret-key', { transport });

    await expect(client.send({ recipient: '639171234567', content: '   ' })).rejects.toThrow(
      UniSmsError,
    );
    expect(transport.calls).toHaveLength(0);
  });
});

describe('UniSmsClient#getMessage', () => {
  it('fetches a message by id', async () => {
    const transport = new MockTransport([jsonResponse(200, { id: 'abc123', status: 'delivered' })]);
    const client = new UniSmsClient('secret-key', { transport });

    const response = await client.getMessage('abc123');

    expect(transport.calls[0]).toMatchObject({
      method: 'GET',
      url: `${DEFAULT_BASE_URL}/abc123`,
      authKey: 'secret-key',
    });
    expect(response.raw).toEqual({ id: 'abc123', status: 'delivered' });
  });

  it('URL-encodes the message id', async () => {
    const transport = new MockTransport([jsonResponse(200, {})]);
    const client = new UniSmsClient('secret-key', { transport });

    await client.getMessage('abc/123 xyz');

    expect(transport.calls[0]?.url).toBe(
      `${DEFAULT_BASE_URL}/${encodeURIComponent('abc/123 xyz')}`,
    );
  });

  it('rejects an empty message id', async () => {
    const transport = new MockTransport([jsonResponse(200, {})]);
    const client = new UniSmsClient('secret-key', { transport });

    await expect(client.getMessage('')).rejects.toThrow(UniSmsError);
    expect(transport.calls).toHaveLength(0);
  });
});

describe('UniSmsClient error handling', () => {
  it('throws ApiError with statusCode and responseBody for a non-2xx, non-retryable response', async () => {
    const transport = new MockTransport([{ statusCode: 400, body: '{"error":"bad request"}' }]);
    const client = new UniSmsClient('secret-key', { transport, maxRetries: 0 });

    const error = await client
      .send({ recipient: '639171234567', content: 'hi' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(400);
    expect((error as ApiError).responseBody).toBe('{"error":"bad request"}');
  });

  it('throws TransportError when the transport rejects (network failure)', async () => {
    const transport = new MockTransport([new Error('ECONNRESET')]);
    const client = new UniSmsClient('secret-key', { transport, maxRetries: 0 });

    await expect(client.send({ recipient: '639171234567', content: 'hi' })).rejects.toThrow(
      TransportError,
    );
  });

  it('throws UniSmsError when the response body is not valid JSON', async () => {
    const transport = new MockTransport([{ statusCode: 200, body: 'not json' }]);
    const client = new UniSmsClient('secret-key', { transport });

    await expect(client.send({ recipient: '639171234567', content: 'hi' })).rejects.toThrow(
      UniSmsError,
    );
  });
});

describe('UniSmsClient retry behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries on HTTP 500 and eventually succeeds', async () => {
    const transport = new MockTransport([
      { statusCode: 500, body: 'server error' },
      { statusCode: 500, body: 'server error' },
      jsonResponse(200, { ok: true }),
    ]);
    const client = new UniSmsClient('secret-key', {
      transport,
      maxRetries: 2,
      retryDelay: 10,
    });

    const promise = client.send({ recipient: '639171234567', content: 'hi' });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(transport.calls).toHaveLength(3);
    expect(response.raw).toEqual({ ok: true });
  });

  it('retries on HTTP 429', async () => {
    const transport = new MockTransport([
      { statusCode: 429, body: 'rate limited' },
      jsonResponse(200, { ok: true }),
    ]);
    const client = new UniSmsClient('secret-key', {
      transport,
      maxRetries: 2,
      retryDelay: 10,
    });

    const promise = client.send({ recipient: '639171234567', content: 'hi' });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(transport.calls).toHaveLength(2);
    expect(response.raw).toEqual({ ok: true });
  });

  it('retries on transport/network errors', async () => {
    const transport = new MockTransport([new Error('timeout'), jsonResponse(200, { ok: true })]);
    const client = new UniSmsClient('secret-key', {
      transport,
      maxRetries: 2,
      retryDelay: 10,
    });

    const promise = client.send({ recipient: '639171234567', content: 'hi' });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(transport.calls).toHaveLength(2);
    expect(response.raw).toEqual({ ok: true });
  });

  it('does not retry on non-retryable 4xx status codes', async () => {
    const transport = new MockTransport([{ statusCode: 404, body: 'not found' }]);
    const client = new UniSmsClient('secret-key', {
      transport,
      maxRetries: 2,
      retryDelay: 10,
    });

    const promise = client
      .send({ recipient: '639171234567', content: 'hi' })
      .catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const error = await promise;

    expect(transport.calls).toHaveLength(1);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('gives up after maxRetries and throws the last error', async () => {
    const transport = new MockTransport([
      { statusCode: 500, body: 'e1' },
      { statusCode: 500, body: 'e2' },
      { statusCode: 500, body: 'e3' },
    ]);
    const client = new UniSmsClient('secret-key', {
      transport,
      maxRetries: 2,
      retryDelay: 10,
    });

    const promise = client
      .send({ recipient: '639171234567', content: 'hi' })
      .catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const error = await promise;

    expect(transport.calls).toHaveLength(3); // initial + 2 retries
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).responseBody).toBe('e3');
  });

  it('does not retry at all when maxRetries is 0', async () => {
    const transport = new MockTransport([{ statusCode: 500, body: 'e1' }]);
    const client = new UniSmsClient('secret-key', {
      transport,
      maxRetries: 0,
    });

    const promise = client
      .send({ recipient: '639171234567', content: 'hi' })
      .catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const error = await promise;

    expect(transport.calls).toHaveLength(1);
    expect(error).toBeInstanceOf(ApiError);
  });
});
