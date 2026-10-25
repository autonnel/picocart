import { beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock('@/lib/config/get-config', () => ({ getConfig: async () => config.value }));

import { currencyForCountry } from '@/lib/shopify/graphql/country';

describe('currencyForCountry', () => {
  beforeEach(() => {
    config.value = undefined;
  });

  it('prices every country in the default currency when the store is unconfigured', async () => {
    expect(await currencyForCountry('CN')).toBe('USD');
    expect(await currencyForCountry('US')).toBe('USD');
  });

  it('uses the country currency only when the store sells in it', async () => {
    config.value = { list: ['USD', 'EUR'], default: 'USD' };
    expect(await currencyForCountry('DE')).toBe('EUR');
    expect(await currencyForCountry('CN')).toBe('USD');
    expect(await currencyForCountry(null)).toBe('USD');
  });

  it('keeps explicit country overrides', async () => {
    config.value = { list: ['USD'], default: 'USD', countries: { CN: 'CNY' } };
    expect(await currencyForCountry('CN')).toBe('CNY');
  });
});
