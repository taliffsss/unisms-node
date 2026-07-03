# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-03

### Added

- Initial release of `@taliffsss/unisms`, a Node.js/TypeScript SDK for the UniSMS API.
- `UniSmsClient` with `send()` and `getMessage()` methods.
- Pluggable `Transport` interface with a default `FetchTransport` implementation
  backed by Node's built-in `fetch`.
- Configurable timeout, retry count, and retry backoff delay.
- Automatic retry on network errors, timeouts, HTTP 429, and HTTP 5xx responses,
  with exponential backoff (capped at 5000ms).
- Environment variable support: `UNISMS_SECRET_KEY`, `UNISMS_BASE_URL`, `UNISMS_TIMEOUT`.
- Error hierarchy: `UniSmsError`, `TransportError`, `ApiError`.
- Full TypeScript type definitions.
- Unit test suite (vitest) covering send/getMessage, validation errors, API errors,
  transport errors, and retry behavior.
- ESLint + Prettier configuration.
- GitHub Actions CI workflow (lint, typecheck, test, build across Node 18/20/22).
- Husky + lint-staged pre-commit hook.
