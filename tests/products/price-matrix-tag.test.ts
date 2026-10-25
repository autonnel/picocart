import { describe, expect, it } from 'vitest';
import { priceTag } from '@/components/products/PriceMatrix';

const rates = { EUR: { rate: 0.9, rounding: '99' as const } };
const row = (currencyCode: string, isManual: boolean) => ({ currencyCode, price: '1.00', compareAtPrice: '', isManual });

describe('priceTag', () => {
  it('shows no tag for the default currency', () => {
    expect(priceTag(row('USD', true), 'USD', 'USD', rates)).toBeNull();
  });

  it('marks rated currencies auto or manual', () => {
    expect(priceTag(undefined, 'EUR', 'USD', rates)).toBe('auto');
    expect(priceTag(row('EUR', false), 'EUR', 'USD', rates)).toBe('auto');
    expect(priceTag(row('EUR', true), 'EUR', 'USD', rates)).toBe('manual');
  });

  it('shows existing rows of a currency without a rate as manual, even former auto rows', () => {
    expect(priceTag(row('GBP', false), 'GBP', 'USD', rates)).toBe('manual');
    expect(priceTag(row('GBP', true), 'GBP', 'USD', rates)).toBe('manual');
    expect(priceTag(undefined, 'GBP', 'USD', rates)).toBeNull();
  });
});
