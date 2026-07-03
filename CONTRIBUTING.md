# Contributing to @taliffsss/unisms

Thanks for your interest in contributing! This document covers how to get set up
and the conventions used in this repository.

## Getting started

```bash
git clone https://github.com/taliffsss/unisms-node.git
cd unisms-node
npm install
```

`npm install` also sets up the Husky pre-commit hook via the `prepare` script.

## Development workflow

| Command                | Description                                   |
| ----------------------- | ---------------------------------------------- |
| `npm run build`         | Build the package with `tsup` (ESM + CJS + `.d.ts`) |
| `npm run dev`           | Build in watch mode                            |
| `npm run lint`          | Lint the codebase with ESLint                  |
| `npm run lint:fix`      | Lint and auto-fix                              |
| `npm run format`        | Format source with Prettier                    |
| `npm run format:check`  | Check formatting without writing               |
| `npm run typecheck`     | Type-check without emitting output             |
| `npm test`              | Run the unit test suite once (vitest)          |
| `npm run test:watch`    | Run tests in watch mode                        |
| `npm run test:coverage` | Run tests with coverage report                 |

## Project structure

```
src/
  errors/        Custom error classes (UniSmsError, TransportError, ApiError)
  transport/     Transport interface implementation + retry policy
  types.ts       Shared request/response types
  UniSmsClient.ts  Main client class
  index.ts       Public entry point (tree-shakeable named exports)
tests/           Vitest unit tests (transport layer is mocked, no real network calls)
```

## Scope

This SDK intentionally implements **only** the two operations exposed by the
UniSMS reference API: sending an SMS and fetching a message's delivery status.
Please do not add speculative endpoints (bulk SMS, balance inquiry, message
history, webhook verification, etc.) unless the upstream API and the PHP
reference implementation (`taliffsss/unisms-php`) actually support them — open
an issue to discuss scope changes first.

## Making changes

1. Fork the repository and create a feature branch.
2. Make your changes, following the existing code style (enforced by ESLint/Prettier).
3. Add or update unit tests for any behavior change. Mock the `Transport`
   interface rather than making real network calls (see `tests/UniSmsClient.test.ts`
   for examples).
4. Run `npm run lint`, `npm run typecheck`, and `npm test` locally — all must pass.
5. Update `CHANGELOG.md` under an `[Unreleased]` heading.
6. Open a pull request describing the change and why it's needed.

## Commit messages

Use clear, imperative commit messages (e.g. "Add retry jitter option", not
"added retry jitter option"). Reference related issues where relevant.

## Code of conduct

Be respectful and constructive. This is a small utility library — most
discussions should be quick and focused.

## License

By contributing, you agree that your contributions will be licensed under the
MIT License (see [LICENSE](LICENSE)).
