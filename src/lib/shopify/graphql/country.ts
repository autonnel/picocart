import { getConfig } from '@/lib/config/get-config';
import { getDefaultCurrencyCode } from '@/lib/shopify/api-utils';
import type { VariantPrice } from '@prisma/client';

// Minimal static CountryCode -> currencyCode map for the common markets.
// A KV `catalog.currencies` override (`{ default, countries: { US: 'USD' } }`)
// takes precedence; absent a match we fall back to the catalog default.
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  AU: 'AUD',
  NZ: 'NZD',
  JP: 'JPY',
  CN: 'CNY',
  IN: 'INR',
  BR: 'BRL',
  MX: 'MXN',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  SG: 'SGD',
  HK: 'HKD',
  AT: 'EUR',
  BE: 'EUR',
  DE: 'EUR',
  ES: 'EUR',
  FI: 'EUR',
  FR: 'EUR',
  IE: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  PT: 'EUR',
};

interface CurrenciesConfig {
  default?: string;
  countries?: Record<string, string>;
}

export async function currencyForCountry(countryCode: string | null | undefined): Promise<string> {
  const code = (countryCode ?? '').toUpperCase();
  const cfg = await getConfig<CurrenciesConfig>('catalog.currencies');
  if (code && cfg?.countries && typeof cfg.countries[code] === 'string') {
    return cfg.countries[code].toUpperCase();
  }
  if (code && COUNTRY_CURRENCY[code]) {
    return COUNTRY_CURRENCY[code];
  }
  return getDefaultCurrencyCode();
}

// Non-throwing price lookup: contextualPricing must surface `null` (not error)
// when the variant carries no price in the resolved currency.
export function pickPriceOrNull(prices: VariantPrice[], currencyCode: string): VariantPrice | null {
  const target = currencyCode.toUpperCase();
  return prices.find((p) => p.currencyCode.toUpperCase() === target) ?? null;
}
