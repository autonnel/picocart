# Picocart

Open-source, self-hostable headless commerce backend. Picocart gives you a
product catalog, orders, and customers behind a clean admin UI, plus a
Shopify-Admin-compatible GraphQL API so existing Shopify client code can talk
to it with minimal changes.

Built with Astro, React, Prisma, and PostgreSQL. Runs on Node and Cloudflare
Workers.

## Features

- **Products** : variants, options, images, per-currency prices
  (compare-at supported), and optional inventory tracking per product
- **Orders** : line items, financial / fulfillment status, shipping and
  billing addresses, refunds, tracking numbers
- **Customers** : automatically created and updated from orders, with order
  count and total-spent stats
- **Admin UI** : Overview, Products, Orders, Customers, and Settings pages
  with server-side rendering, filtering, and pagination
- **Roles & permissions** : feature-based access control with built-in
  `admin` and `viewer` roles, plus custom roles
- **API keys** : token authentication for machine-to-machine access
- **Shopify-compatible Admin GraphQL API** : a practical subset covering
  products, variants, and orders
- **Storage** : S3-compatible object storage for product images
- **Two runtimes** : Node (standalone server or Docker) and Cloudflare Workers

## Quick start

Requirements: Node.js >= 20 and a PostgreSQL database.

```bash
git clone https://github.com/autonnel/picocart.git
cd picocart
npm install
cp .env.example .env   # then edit DATABASE_URL
npm run db:push        # create tables
npm run dev
```

Open `http://localhost:4322` and go to `/register` — on a fresh install the
first registered user becomes the administrator.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — (required) |
| `PORT` | HTTP port | `4322` |

Everything else — currencies, API keys, users, roles, and S3 storage — is
configured in the admin UI under **Settings**.

## Shopify-compatible API

Endpoint:

```
POST /admin/api/2024-01/graphql.json
```

Authenticate with an API key created under **Settings → API Keys**, sent as
either header:

```
X-Shopify-Access-Token: <token>
Authorization: Bearer <token>
```

The API implements the subset of the Shopify Admin GraphQL API needed for
catalog and order integration: product / variant queries (including
`contextualPricing` for multi-currency), order creation and lookup, and
refunds. It is not a complete Shopify implementation.

## Deployment

### Node / Docker

```bash
npm run build
npm start
```

A production `Dockerfile` is included; the container listens on port `4322`.

### Cloudflare Workers

```bash
npm run deploy:cf
```

This generates `wrangler.toml` from `wrangler.toml.template` (see
`scripts/generate-wrangler.mjs` for the required `CF_*` environment
variables), builds with the Cloudflare adapter, and deploys with Wrangler.

Alternatively, use Cloudflare's Git integration (Workers Builds) instead of
deploying from your machine: run `npm run generate:wrangler` once, commit the
resulting `wrangler.toml` to your own repository (it is listed in
`.gitignore` here, so remove that entry or `git add -f wrangler.toml`), then
connect the repository in the Cloudflare dashboard with build command
`npm run build:cf` and deploy command `npx wrangler deploy`. Every push to
your deploy branch then goes live automatically.

## Development

```bash
npm run dev            # dev server on :4322
npm test               # vitest (database-backed tests skip when no PostgreSQL is reachable)
npm run verify         # schema + types + tests + reference checks
npm run db:studio      # browse the database
```

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).
Please report security issues privately as described in
[SECURITY.md](./SECURITY.md).

## License

[Apache-2.0](./LICENSE)
