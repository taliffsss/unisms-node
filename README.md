# @taliffsss/unisms

Official Node.js/TypeScript SDK for the [UniSMS API](https://unismsapi.com) — a
powerful, reliable, developer-friendly SMS API for the Philippines, supporting
all major carriers (Globe, Smart, DITO, Sun, TNT).

This is the Node.js/TypeScript counterpart to the
[`taliffsss/unisms-php`](https://github.com/taliffsss/unisms-php) reference
implementation, and intentionally implements the same two API operations —
nothing more.

## Table of contents

- [Overview](#overview)
- [Installation](#installation)
- [Authentication / secret key setup](#authentication--secret-key-setup)
- [Quick start](#quick-start)
- [Sending an SMS](#sending-an-sms)
- [Checking a message's status](#checking-a-messages-status)
- [Error handling](#error-handling)
- [Configuration options](#configuration-options)
- [Retry policy caveats](#retry-policy-caveats)
- [Custom transport](#custom-transport)
- [API reference](#api-reference)
- [Testing](#testing)
- [Publishing](#publishing)
- [License](#license)

## Overview

- Written in TypeScript, ships with generated `.d.ts` type definitions.
- Promise-based `async`/`await` API — no callbacks.
- Zero heavy runtime dependencies — uses Node's built-in `fetch`.
- Configurable timeout and automatic retry with exponential backoff.
- Pluggable HTTP transport for testing or swapping in your own HTTP client.
- Tree-shakeable named exports.

## Installation

```bash
npm install @taliffsss/unisms
```

```bash
yarn add @taliffsss/unisms
```

```bash
pnpm add @taliffsss/unisms
```

Requires Node.js 18 or later (for built-in `fetch`).

## Authentication / secret key setup

Every request is authenticated with HTTP Basic Auth, using your UniSMS secret
key as the username and an empty password. You can obtain a secret key from
your [UniSMS dashboard](https://unismsapi.com).

You can provide the secret key in two ways:

```ts
// 1. Explicitly, in code
const client = new UniSmsClient('sk_your_secret_key');

// 2. Via the UNISMS_SECRET_KEY environment variable
// export UNISMS_SECRET_KEY=sk_your_secret_key
const client = new UniSmsClient('');
```

An explicit constructor argument always takes precedence over the environment
variable. Passing an empty/blank secret key with no `UNISMS_SECRET_KEY` set
throws a `UniSmsError` immediately, before any network call is made.

## Quick start

```ts
import { UniSmsClient } from '@taliffsss/unisms';

const client = new UniSmsClient('sk_your_secret_key');

const response = await client.send({
  recipient: '+639171234567',
  content: 'Hello world',
});

console.log(response.raw);
```

## Sending an SMS

```ts
import { UniSmsClient } from '@taliffsss/unisms';

const client = new UniSmsClient('sk_your_secret_key');

const response = await client.send({
  recipient: '+639171234567',
  content: 'Hello world',
  senderId: 'MyBrand', // optional, defaults to "UniSMS"
  metadata: { orderId: 12345 }, // optional, echoed back by the API; omitted from
                                 // the request body entirely when not provided
});

// response is a UniSmsResponse — a thin, flexible wrapper around the decoded
// JSON body (the API does not publish a fixed response schema)
console.log(response.raw); // the full decoded object
console.log(response.get('id')); // convenience accessor for a single field
```

`recipient` and `content` are required and validated client-side (non-empty)
before any network request is made — a `UniSmsError` is thrown immediately if
either is missing or blank.

## Checking a message's status

```ts
const status = await client.getMessage('msg_84e8b93b-6315-46af-a686');
console.log(status.raw);
```

`id` is required and validated client-side before any network request is made,
and is URL-encoded automatically.

## Error handling

```ts
import { UniSmsClient, ApiError, TransportError, UniSmsError } from '@taliffsss/unisms';

const client = new UniSmsClient('sk_your_secret_key');

try {
  await client.send({ recipient: '+639171234567', content: 'Hello world' });
} catch (error) {
  if (error instanceof ApiError) {
    // The API was reached but returned a non-2xx response.
    console.error('API error', error.statusCode, error.responseBody);
  } else if (error instanceof TransportError) {
    // The request could not be completed at all (network/timeout/DNS/etc.).
    console.error('Transport error', error.message, error.cause);
  } else if (error instanceof UniSmsError) {
    // Any other client-side error — e.g. missing recipient/content/id, or a
    // response body that could not be parsed as JSON.
    console.error('Validation/decode error', error.message);
  } else {
    throw error;
  }
}
```

`ApiError` and `TransportError` both extend `UniSmsError`, so you can also
catch just `UniSmsError` to handle any error raised by this SDK in one place.

## Configuration options

All options are optional and can be passed as the second constructor argument:

```ts
import { UniSmsClient } from '@taliffsss/unisms';

const client = new UniSmsClient('sk_your_secret_key', {
  baseURL: 'https://unismsapi.com/api/sms', // default
  timeout: 30_000, // default: 30 seconds, in milliseconds
  maxRetries: 2, // default: 2 (up to 3 total attempts); 0 disables retries
  retryDelay: 250, // default: 250ms base delay, doubles each retry, capped at 5000ms
  transport: new MyCustomTransport(), // default: FetchTransport (uses global fetch)
});
```

### Environment variables

| Variable             | Overrides             | Notes                                   |
| --------------------- | ---------------------- | ---------------------------------------- |
| `UNISMS_SECRET_KEY`   | `secretKey` constructor arg | Only used when the constructor arg is empty/blank |
| `UNISMS_BASE_URL`     | `baseURL` option        | Only used when `baseURL` option is not set |
| `UNISMS_TIMEOUT`      | `timeout` option        | Milliseconds; only used when `timeout` option is not set |

Explicit constructor/options values always take precedence over environment
variables, which take precedence over built-in defaults.

## Retry policy caveats

Retries are applied at the transport layer and only for:

- Network/connection errors and timeouts (no HTTP response was received at all)
- HTTP `429 Too Many Requests`
- HTTP `5xx` server errors

Other `4xx` responses (e.g. `400`, `401`, `404`) are **not** retried, since
they indicate a client-side/validation problem that retrying will not fix.

**⚠️ Duplicate delivery risk:** retrying `send()` carries a real risk of
sending the same SMS twice if an earlier attempt actually succeeded on the
server but its response was lost before your client received it (for example,
a request that times out client-side after the API already queued the
message). If your application cannot tolerate the possibility of duplicate
messages, set `maxRetries: 0` to disable retries entirely, or implement your
own idempotency handling (e.g. via `metadata`) on top of this SDK.

## Custom transport

The HTTP layer is fully pluggable via the `Transport` interface — this is the
same seam used by the unit tests to avoid real network calls, and it lets you
swap in your own HTTP client (e.g. `axios`, `undici`, an instrumented
wrapper, etc.):

```ts
import type { Transport, TransportRequest, TransportResponse } from '@taliffsss/unisms';

class MyCustomTransport implements Transport {
  async request(req: TransportRequest): Promise<TransportResponse> {
    // req.method, req.url, req.authKey, req.jsonBody, req.timeoutMs
    // Perform the HTTP call yourself and return the raw status + body.
    // Throw (or reject) for network-level failures; do NOT throw for
    // non-2xx HTTP responses — just resolve with the status code and body.
    return { statusCode: 200, body: '{}' };
  }
}

const client = new UniSmsClient('sk_your_secret_key', {
  transport: new MyCustomTransport(),
});
```

## API reference

### `new UniSmsClient(secretKey, options?)`

Creates a new client. Throws `UniSmsError` if no non-empty secret key can be
resolved (from the argument or `UNISMS_SECRET_KEY`).

### `client.send(request): Promise<UniSmsResponse>`

Sends an SMS. `request` fields:

| Field       | Type                      | Required | Notes                                  |
| ----------- | ------------------------- | -------- | --------------------------------------- |
| `recipient` | `string`                  | yes      | Must be non-empty                       |
| `content`   | `string`                  | yes      | Must be non-empty                       |
| `senderId`  | `string`                  | no       | Defaults to `"UniSMS"`                  |
| `metadata`  | `Record<string, unknown>` | no       | Omitted from the request body entirely when not set |

### `client.getMessage(id): Promise<UniSmsResponse>`

Fetches the delivery status of a previously sent message. `id` must be
non-empty and is URL-encoded automatically.

### `UniSmsResponse`

A thin wrapper around the decoded JSON response body:

- `.raw: Record<string, unknown>` — the full decoded object.
- `.get<T>(key: string): T | undefined` — convenience accessor for a single field.
- `.toJSON()` — returns `.raw` (supports `JSON.stringify(response)`).

### Errors

- `UniSmsError` — base class for all SDK errors.
- `TransportError extends UniSmsError` — network/timeout failure before any response was received.
- `ApiError extends UniSmsError` — non-2xx HTTP response; exposes `statusCode` and `responseBody`.

## Testing

```bash
npm install
npm test
```

Unit tests mock the `Transport` interface so no real network calls are made.

## Publishing

Maintainers: see [PUBLISHING.md](PUBLISHING.md) for the full release process
(versioning, tagging, npm credentials, and the automated GitHub Actions
publish workflow).

## License

The MIT License (MIT). See [LICENSE](LICENSE) for details.
