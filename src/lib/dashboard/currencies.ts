import { getConfig, setConfig } from '@/lib/config/get-config';
import { prisma } from '@/lib/db';
import { ROUNDING_RULES, type CurrencyRate } from '@/lib/pricing/auto-price';
import { syncAutoPrices } from '@/lib/pricing/auto-price-sync';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';

const SYNC_TRANSACTION_TIMEOUT_MS = 60_000;

export interface CurrencyConfig {
  list: string[];
  default: string;
  rates: Record<string, CurrencyRate>;
}

export const CATALOG_CURRENCIES_KEY = 'catalog.currencies';

export async function getCurrencyConfig(): Promise<CurrencyConfig> {
  const raw = await getConfig<CurrencyConfig>(CATALOG_CURRENCIES_KEY);
  if (!raw || !Array.isArray(raw.list) || raw.list.length === 0) {
    return { list: ['USD'], default: 'USD', rates: {} };
  }
  const def = typeof raw.default === 'string' && raw.list.includes(raw.default)
    ? raw.default
    : raw.list[0];
  return { list: raw.list, default: def, rates: sanitizeRates(raw.rates, raw.list, def) };
}

function sanitizeRates(raw: unknown, list: string[], def: string): Record<string, CurrencyRate> {
  const rates: Record<string, CurrencyRate> = {};
  if (!raw || typeof raw !== 'object') return rates;
  for (const [code, entry] of Object.entries(raw as Record<string, Partial<CurrencyRate>>)) {
    if (code === def || !list.includes(code) || !entry) continue;
    if (typeof entry.rate !== 'number' || !Number.isFinite(entry.rate) || entry.rate <= 0) continue;
    if (!ROUNDING_RULES.includes(entry.rounding as CurrencyRate['rounding'])) continue;
    rates[code] = { rate: entry.rate, rounding: entry.rounding as CurrencyRate['rounding'] };
  }
  return rates;
}

export async function setCurrencyConfig(config: CurrencyConfig): Promise<void> {
  await setConfig(CATALOG_CURRENCIES_KEY, config);
}

export async function saveCurrencyConfig(next: CurrencyConfig): Promise<CurrencyConfig> {
  const previous = await getCurrencyConfig();
  const defaultChanged = next.default !== previous.default;
  const sanitized: CurrencyConfig = {
    list: next.list,
    default: next.default,
    rates: defaultChanged ? {} : sanitizeRates(next.rates, next.list, next.default),
  };
  const changed = Object.entries(sanitized.rates)
    .filter(([code, rate]) => {
      const old = previous.rates[code];
      return !old || old.rate !== rate.rate || old.rounding !== rate.rounding;
    })
    .map(([code]) => code);

  const unrated = Object.keys(previous.rates).filter((code) => !Object.hasOwn(sanitized.rates, code));

  await setCurrencyConfig(sanitized);
  if (changed.length > 0 || unrated.length > 0) {
    try {
      await prisma.$transaction(
        async (tx) => {
          // Without a rate nothing regenerates these rows, so they are kept and locked as manual.
          if (unrated.length > 0) {
            await tx.variantPrice.updateMany({
              where: { currencyCode: { in: unrated }, isManual: false, variant: { product: withTenantWhere({}) } },
              data: { isManual: true },
            });
          }
          if (changed.length > 0) await syncAutoPrices(tx, { currencies: changed });
        },
        { timeout: SYNC_TRANSACTION_TIMEOUT_MS },
      );
    } catch (error) {
      await setCurrencyConfig(previous);
      throw error;
    }
  }
  return sanitized;
}

export const KNOWN_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY'] as const;
