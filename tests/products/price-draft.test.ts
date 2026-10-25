import { describe, expect, it } from 'vitest';
import { fromServer } from '@/components/products/types';

function loaded(prices: unknown[]) {
  return fromServer({ id: 'p1', variants: [{ id: 'v1', prices }] }).variants[0].prices;
}

describe('fromServer price formatting', () => {
  it('shows loaded prices with the currency fixed decimals', () => {
    const prices = loaded([
      { currencyCode: 'USD', price: '60', compareAtPrice: '75.5', isManual: true },
      { currencyCode: 'EUR', price: 59.9, compareAtPrice: null, isManual: false },
      { currencyCode: 'JPY', price: '1500.00', compareAtPrice: '2000', isManual: true },
    ]);
    expect(prices.map((p) => [p.price, p.compareAtPrice])).toEqual([
      ['60.00', '75.50'],
      ['59.90', ''],
      ['1500', '2000'],
    ]);
  });
});
