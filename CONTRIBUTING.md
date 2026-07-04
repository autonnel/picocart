# Contributing to Picocart

Thanks for your interest in contributing!

## Development setup

Requirements: Node.js >= 20 and a PostgreSQL database.

```bash
git clone https://github.com/autonnel/picocart.git
cd picocart
npm install
cp .env.example .env   # then edit DATABASE_URL
npm run db:push
npm run dev            # http://localhost:4322
```

## Running tests

```bash
npm test               # vitest
npm run verify         # reference checks + schema + types + tests
```

Database-backed tests connect to `TEST_DATABASE_URL` (falling back to
`DATABASE_URL`) and skip automatically when no PostgreSQL is reachable, so the
suite always runs. Use a dedicated test database — the suite truncates tables
between tests.

`npm run verify` must pass before you open a pull request.

## Code style

- All code, UI text, tests, and comments are written in English.
- Keep comments to a minimum — prefer clear naming and structure; comment only
  hidden constraints, invariants, or non-obvious workarounds.
- Server-side code logs through `createLogger` (`src/lib/logger.ts`), never
  `console.*` (browser components are the exception).
- Split any file that grows beyond ~500 lines.
- List pages render server-side with server-driven filtering and pagination.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change, including tests where behavior changes.
3. Run `npm run verify` and make sure it passes.
4. Open a pull request describing the motivation and the change.

For larger features, please open an issue first to discuss the design.

## Reporting bugs

Use [GitHub Issues](https://github.com/autonnel/picocart/issues). For
security vulnerabilities, do **not** open a public issue — see
[SECURITY.md](./SECURITY.md).
