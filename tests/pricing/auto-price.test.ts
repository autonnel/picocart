import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config/get-config', () => ({
  getConfig: vi.fn(),
  setConfig: vi.fn(),
}));

import { getConfig } from '@/lib/config/get-config';
import { convertPrice, isZeroDecimal } from '@/lib/pricing/auto-price';
import { getCurrencyConfig } from '@/lib/dashboard/currencies';

describe('convertPrice', () => {
  it('converts without rounding rule', () => {
    expect(convertPrice('10.00', { rate: 0.92, rounding: 'none' }, 'EUR')).toBe('9.20');
  });
  it('ceils to the cent for none', () => {
    expect(convertPrice('10.00', { rate: 0.9234, rounding: 'none' }, 'EUR')).toBe('9.24');
  });
  it('rounds up to .99', () => {
    expect(convertPrice('10.00', { rate: 0.92, rounding: '99' }, 'EUR')).toBe('9.99');
    expect(convertPrice('10.00', { rate: 1.0, rounding: '99' }, 'EUR')).toBe('10.99');
  });
  it('rounds up to .95', () => {
    expect(convertPrice('9.50', { rate: 1.0, rounding: '95' }, 'EUR')).toBe('9.95');
    expect(convertPrice('9.96', { rate: 1, rounding: '95' }, 'EUR')).toBe('10.95');
  });
  it('rounds up to integer', () => {
    expect(convertPrice('10.00', { rate: 1.25, rounding: 'integer' }, 'EUR')).toBe('13.00');
  });
  it('forces integer for zero-decimal currencies', () => {
    expect(convertPrice('10.00', { rate: 150.3, rounding: '99' }, 'JPY')).toBe('1503.00');
    expect(convertPrice('10.00', { rate: 150.3, rounding: 'none' }, 'JPY')).toBe('1503.00');
  });
  it('keeps a free price free under every rounding rule', () => {
    expect(convertPrice('0.00', { rate: 0.9, rounding: '99' }, 'EUR')).toBe('0.00');
    expect(convertPrice('0.00', { rate: 0.9, rounding: '95' }, 'EUR')).toBe('0.00');
    expect(convertPrice('0.00', { rate: 0.9, rounding: 'integer' }, 'EUR')).toBe('0.00');
    expect(convertPrice('0.00', { rate: 0.9, rounding: 'none' }, 'EUR')).toBe('0.00');
  });
  it('keeps a free zero-decimal price free', () => {
    expect(convertPrice('0', { rate: 150, rounding: '99' }, 'JPY')).toBe('0.00');
  });
});

describe('isZeroDecimal', () => {
  it('detects zero-decimal currencies', () => {
    expect(isZeroDecimal('jpy')).toBe(true);
    expect(isZeroDecimal('EUR')).toBe(false);
  });
});

describe('getCurrencyConfig rates', () => {
  beforeEach(() => vi.mocked(getConfig).mockReset());

  it('keeps only valid rates for non-default listed currencies', async () => {
    vi.mocked(getConfig).mockResolvedValue({
      list: ['USD', 'EUR', 'CAD', 'AUD'],
      default: 'USD',
      rates: {
        EUR: { rate: 0.9, rounding: '99' },
        USD: { rate: 1, rounding: 'none' },
        GBP: { rate: 0.8, rounding: 'none' },
        CAD: { rate: -1, rounding: 'none' },
        AUD: { rate: 1.5, rounding: 'bogus' },
      },
    });
    const cfg = await getCurrencyConfig();
    expect(cfg.rates).toEqual({ EUR: { rate: 0.9, rounding: '99' } });
  });

  it('returns empty rates when missing', async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    expect((await getCurrencyConfig()).rates).toEqual({});
  });
});
