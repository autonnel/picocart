import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { getCurrencyConfig, setCurrencyConfig } from '@/lib/dashboard/currencies';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:SettingsCurrencies');

const Schema = z.object({
  list: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1).max(20),
  default: z.string().regex(/^[A-Z]{3}$/),
});

export const GET: APIRoute = withAuth(FEATURES.SETTINGS_CURRENCIES, async () => {
  return jsonResponse({ currencies: await getCurrencyConfig() });
});

export const PUT: APIRoute = withAuth(FEATURES.SETTINGS_CURRENCIES, async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'VALIDATION', issues: parsed.error.issues }, 400);
  }
  if (!parsed.data.list.includes(parsed.data.default)) {
    return jsonResponse({ error: 'Default currency must be in the list' }, 400);
  }
  try {
    const dedup = Array.from(new Set(parsed.data.list));
    await setCurrencyConfig({ list: dedup, default: parsed.data.default });
    return jsonResponse({ currencies: { list: dedup, default: parsed.data.default } });
  } catch (error) {
    logger.error('Update currencies failed', { error });
    return jsonResponse({ error: 'Failed to update currencies' }, 500);
  }
});
