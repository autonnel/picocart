/**
 * Generate wrangler.toml from wrangler.toml.template.
 * Replaces ${VAR_NAME} placeholders with values from environment variables or .env file.
 *
 * Required env vars:
 *   CF_WORKER_NAME              - Cloudflare Worker name
 *   CF_KV_NAMESPACE_ID          - Cloudflare KV namespace ID
 *   CF_HYPERDRIVE_CONFIG_ID     - Cloudflare Hyperdrive config ID
 *
 * Optional env vars:
 *   CF_KV_PREVIEW_NAMESPACE_ID            - KV preview namespace ID (for local dev)
 *   CF_HYPERDRIVE_LOCAL_CONNECTION_STRING - Local Postgres URL for Hyperdrive emulation
 *                                           (defaults to DATABASE_URL if not set)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

dotenv.config({ path: resolve(root, '.env') });

if (!process.env.CF_HYPERDRIVE_LOCAL_CONNECTION_STRING && process.env.DATABASE_URL) {
  process.env.CF_HYPERDRIVE_LOCAL_CONNECTION_STRING = process.env.DATABASE_URL;
}

const templatePath = resolve(root, 'wrangler.toml.template');
let content = readFileSync(templatePath, 'utf-8');

const REQUIRED = ['CF_WORKER_NAME', 'CF_KV_NAMESPACE_ID', 'CF_HYPERDRIVE_CONFIG_ID'];

const missing = [];
content = content.replace(/\$\{(\w+)\}/g, (match, varName) => {
  const value = process.env[varName];
  if (value === undefined || value === '') {
    missing.push(varName);
    return match;
  }
  return value;
});

const missingRequired = missing.filter(v => REQUIRED.includes(v));
const missingOptional = missing.filter(v => !REQUIRED.includes(v));

if (missingRequired.length > 0) {
  console.error(`Error: Required env vars are not set: ${missingRequired.join(', ')}`);
  console.error('Set them in .env or as environment variables.');
  process.exit(1);
}

if (missingOptional.length > 0) {
  console.warn(`Warning: Optional env vars not set: ${missingOptional.join(', ')}`);
}

const outputPath = resolve(root, 'wrangler.toml');
writeFileSync(outputPath, content, 'utf-8');
console.log('Generated wrangler.toml from template');
