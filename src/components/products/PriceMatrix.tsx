import * as React from 'react';
import type { VariantDraft, VariantPriceDraft } from './types';

export interface PriceMatrixProps {
  variants: VariantDraft[];
  currencies: string[];
  onChange: (next: VariantDraft[]) => void;
}

const PriceMatrix: React.FC<PriceMatrixProps> = ({ variants, currencies, onChange }) => {
  if (currencies.length === 0) {
    return (
      <div className="text-[13px] text-ds-muted bg-ds-warnBg border border-ds-warnBorder rounded-[8px] px-3 py-2">
        No currencies configured. Add currencies in Settings → Currencies.
      </div>
    );
  }

  const updatePrice = (
    variantClientId: string,
    currencyCode: string,
    field: 'price' | 'compareAtPrice',
    value: string,
  ) => {
    onChange(
      variants.map((v) => {
        if (v.clientId !== variantClientId) return v;
        const existing = v.prices.find((p) => p.currencyCode === currencyCode);
        let nextPrices: VariantPriceDraft[];
        if (existing) {
          nextPrices = v.prices.map((p) =>
            p.currencyCode === currencyCode ? { ...p, [field]: value } : p,
          );
        } else {
          nextPrices = [
            ...v.prices,
            {
              currencyCode,
              price: field === 'price' ? value : '',
              compareAtPrice: field === 'compareAtPrice' ? value : '',
            },
          ];
        }
        return { ...v, prices: nextPrices };
      }),
    );
  };

  const cellValue = (
    v: VariantDraft,
    currencyCode: string,
    field: 'price' | 'compareAtPrice',
  ): string => {
    const p = v.prices.find((p) => p.currencyCode === currencyCode);
    if (!p) return '';
    return field === 'price' ? p.price : p.compareAtPrice ?? '';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-ds-surface2 border-b border-ds-line">
          <tr>
            <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">
              Variant
            </th>
            {currencies.map((c) => (
              <th
                key={c}
                colSpan={2}
                className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left border-l border-ds-line"
              >
                {c}
              </th>
            ))}
          </tr>
          <tr className="border-b border-ds-line">
            <th></th>
            {currencies.map((c) => (
              <React.Fragment key={c}>
                <th className="px-3 py-1 text-[10.5px] text-ds-faint text-left border-l border-ds-line">Price</th>
                <th className="px-3 py-1 text-[10.5px] text-ds-faint text-left">Compare-at</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.clientId} className="border-b border-[#F3F4F6]">
              <td className="px-3 py-2 text-[13px] text-ds-ink">{v.title || '(unnamed)'}</td>
              {currencies.map((c) => (
                <React.Fragment key={c}>
                  <td className="px-3 py-2 border-l border-ds-line">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-24 h-8 px-2 text-[12.5px] border border-ds-line rounded-[6px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent text-right font-ds-mono tabular"
                      value={cellValue(v, c, 'price')}
                      placeholder="0.00"
                      onChange={(e) => updatePrice(v.clientId, c, 'price', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-24 h-8 px-2 text-[12.5px] border border-ds-line rounded-[6px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent text-right font-ds-mono tabular text-ds-muted"
                      value={cellValue(v, c, 'compareAtPrice')}
                      placeholder="—"
                      onChange={(e) => updatePrice(v.clientId, c, 'compareAtPrice', e.target.value)}
                    />
                  </td>
                </React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PriceMatrix;
