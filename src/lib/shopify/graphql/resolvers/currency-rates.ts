import { getCurrencyConfig } from '@/lib/dashboard/currencies';

export async function resolveCurrencyRates(): Promise<Record<string, unknown>> {
  const config = await getCurrencyConfig();
  return {
    currencyRates: {
      baseCurrency: config.default,
      rates: Object.entries(config.rates).map(([currencyCode, entry]) => ({
        currencyCode,
        rate: entry.rate,
        rounding: entry.rounding,
      })),
      currencies: config.list,
    },
  };
}
