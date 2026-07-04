# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Product catalog: variants, options, images, per-currency prices, optional
  inventory tracking
- Orders: line items, financial / fulfillment status, addresses, refunds,
  tracking numbers
- Customers with automatic order-count and total-spent stats
- Admin UI: Overview, Products, Orders, Customers, Settings
- Feature-based roles & permissions with built-in `admin` and `viewer` roles
- API keys for machine-to-machine access
- Shopify-compatible Admin GraphQL API (products, variants, orders, refunds)
- S3-compatible storage for product images
- Node and Cloudflare Workers runtimes
