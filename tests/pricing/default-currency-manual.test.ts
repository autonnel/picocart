import { describe, it, expect } from 'vitest';
import { forceDefaultCurrencyManual } from '@/lib/pricing/auto-price';

describe('forceDefaultCurrencyManual', () => {
  it('marks default-currency rows manual and leaves others untouched', () => {
    const variants = [
      {
        title: 'A',
        prices: [
          { currencyCode: 'USD', price: '10', isManual: false },
          { currencyCode: 'EUR', price: '9', isManual: false },
          { currencyCode: 'GBP', price: '8' },
        ],
      },
      { title: 'B' },
    ];
    const out = forceDefaultCurrencyManual(variants, 'USD');
    expect(out[0].prices).toEqual([
      { currencyCode: 'USD', price: '10', isManual: true },
      { currencyCode: 'EUR', price: '9', isManual: false },
      { currencyCode: 'GBP', price: '8' },
    ]);
    expect(out[1]).toEqual({ title: 'B' });
  });
});
