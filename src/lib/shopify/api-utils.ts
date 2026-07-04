// Shared helpers for the Shopify-compat GraphQL endpoint.

import { getConfig } from '@/lib/config/get-config';

export async function getDefaultCurrencyCode(): Promise<string> {
  const cfg = await getConfig<{ default?: string; list?: string[] }>('catalog.currencies');
  if (cfg && typeof cfg === 'object' && typeof cfg.default === 'string' && cfg.default.length > 0) {
    return cfg.default.toUpperCase();
  }
  return 'USD';
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
