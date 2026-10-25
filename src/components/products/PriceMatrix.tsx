import * as React from 'react';
import { convertPrice, type CurrencyRate } from '@/lib/pricing/auto-price';
import type { VariantDraft, VariantPriceDraft } from './types';

export interface PriceMatrixProps {
  variants: VariantDraft[];
  currencies: string[];
  defaultCurrency: string;
  rates: Record<string, CurrencyRate>;
  onChange: (next: VariantDraft[]) => void;
}

export type PriceTag = 'auto' | 'manual' | null;

// A currency without a rate is never regenerated, so any row it has is effectively manual.
export function priceTag(
  row: VariantPriceDraft | undefined,
  currencyCode: string,
  defaultCurrency: string,
  rates: Record<string, CurrencyRate>,
): PriceTag {
  if (currencyCode === defaultCurrency) return null;
  if (!rates[currencyCode]) return row ? 'manual' : null;
  return !row || row.isManual === false ? 'auto' : 'manual';
}

const PriceMatrix: React.FC<PriceMatrixProps> = ({ variants, currencies, defaultCurrency, rates, onChange }) => {
  if (currencies.length === 0) {
    return (
      <div className="text-[13px] text-ds-muted bg-ds-warnBg border border-ds-warnBorder rounded-[8px] px-3 py-2">
        No currencies configured. Add currencies in Settings → Currencies.
      </div>
    );
  }

  const findPrice = (v: VariantDraft, currencyCode: string) =>
    v.prices.find((p) => p.currencyCode === currencyCode);

  const convertField = (
    v: VariantDraft,
    currencyCode: string,
    field: 'price' | 'compareAtPrice',
  ): string => {
    const rate = rates[currencyCode];
    const base = findPrice(v, defaultCurrency);
    const raw = base ? (field === 'price' ? base.price : base.compareAtPrice ?? '') : '';
    if (!rate || raw.trim() === '' || !Number.isFinite(Number(raw))) return '';
    return convertPrice(raw, rate, currencyCode);
  };

  const tagOf = (v: VariantDraft, currencyCode: string): PriceTag =>
    priceTag(findPrice(v, currencyCode), currencyCode, defaultCurrency, rates);

  const isAuto = (v: VariantDraft, currencyCode: string): boolean => tagOf(v, currencyCode) === 'auto';

  const cellValue = (
    v: VariantDraft,
    currencyCode: string,
    field: 'price' | 'compareAtPrice',
  ): string => {
    if (isAuto(v, currencyCode)) return convertField(v, currencyCode, field);
    const p = findPrice(v, currencyCode);
    if (!p) return '';
    return field === 'price' ? p.price : p.compareAtPrice ?? '';
  };

  const writePrice = (
    variantClientId: string,
    currencyCode: string,
    build: (v: VariantDraft, existing: VariantPriceDraft | undefined) => VariantPriceDraft,
  ) => {
    onChange(
      variants.map((v) => {
        if (v.clientId !== variantClientId) return v;
        const existing = findPrice(v, currencyCode);
        const next = build(v, existing);
        const nextPrices = existing
          ? v.prices.map((p) => (p.currencyCode === currencyCode ? next : p))
          : [...v.prices, next];
        return { ...v, prices: nextPrices };
      }),
    );
  };

  const updatePrice = (
    variantClientId: string,
    currencyCode: string,
    field: 'price' | 'compareAtPrice',
    value: string,
  ) => {
    writePrice(variantClientId, currencyCode, (v, existing) => {
      const auto = isAuto(v, currencyCode);
      const base: VariantPriceDraft = auto
        ? {
            ...existing,
            currencyCode,
            price: convertField(v, currencyCode, 'price'),
            compareAtPrice: convertField(v, currencyCode, 'compareAtPrice'),
            isManual: true,
          }
        : existing ?? { currencyCode, price: '', compareAtPrice: '', isManual: true };
      return { ...base, [field]: value, isManual: true };
    });
  };

  const resetToAuto = (variantClientId: string, currencyCode: string) => {
    writePrice(variantClientId, currencyCode, (v, existing) => ({
      ...existing,
      currencyCode,
      price: convertField(v, currencyCode, 'price'),
      compareAtPrice: convertField(v, currencyCode, 'compareAtPrice'),
      isManual: false,
    }));
  };

  const tag = (v: VariantDraft, currencyCode: string) => {
    const kind = tagOf(v, currencyCode);
    if (!kind) return null;
    const auto = kind === 'auto';
    return (
      <div className="flex items-center gap-2 mt-1">
        <span
          className={`text-[10.5px] ${auto ? 'text-ds-accent' : 'text-ds-faint'}`}
        >
          {auto ? 'Auto' : 'Manual'}
        </span>
        {!auto && rates[currencyCode] && (
          <button
            type="button"
            className="text-[10.5px] text-ds-muted underline hover:text-ds-ink"
            onClick={() => resetToAuto(v.clientId, currencyCode)}
          >
            Reset to auto
          </button>
        )}
      </div>
    );
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
                    {tag(v, c)}
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
