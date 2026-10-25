import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/config/get-config', () => ({
  getConfig: async () => ({
    list: ['USD', 'EUR'],
    default: 'USD',
    rates: { EUR: { rate: 0.9, rounding: '99' } },
  }),
}));
import { executeGraphql } from '@/lib/shopify/graphql/handler';

const CURRENCY_RATES = `query CurrencyRates { currencyRates { baseCurrency rates { currencyCode rate rounding } } }`;

describe('CurrencyRates operation', () => {
  it('currencyRates returns config', async () => {
    const res = await executeGraphql({ query: CURRENCY_RATES, variables: {} }, { writeAccess: false });
    expect(res.status).toBe(200);
    expect((res.body.data as any).currencyRates).toEqual({
      baseCurrency: 'USD',
      rates: [{ currencyCode: 'EUR', rate: 0.9, rounding: '99' }],
      currencies: ['USD', 'EUR'],
    });
  });
});
