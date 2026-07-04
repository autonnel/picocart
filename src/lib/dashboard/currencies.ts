import { getConfig, setConfig } from '@/lib/config/get-config';

export interface CurrencyConfig {
  list: string[];
  default: string;
}

export const CATALOG_CURRENCIES_KEY = 'catalog.currencies';

const DEFAULT_CONFIG: CurrencyConfig = { list: ['USD'], default: 'USD' };

export async function getCurrencyConfig(): Promise<CurrencyConfig> {
  const raw = await getConfig<CurrencyConfig>(CATALOG_CURRENCIES_KEY);
  if (!raw || !Array.isArray(raw.list) || raw.list.length === 0) {
    return DEFAULT_CONFIG;
  }
  const def = typeof raw.default === 'string' && raw.list.includes(raw.default)
    ? raw.default
    : raw.list[0];
  return { list: raw.list, default: def };
}

export async function setCurrencyConfig(config: CurrencyConfig): Promise<void> {
  await setConfig(CATALOG_CURRENCIES_KEY, config);
}

export const KNOWN_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY'] as const;
