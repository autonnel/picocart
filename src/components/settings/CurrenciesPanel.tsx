import * as React from 'react';
import { isZeroDecimal, type CurrencyRate, type RoundingRule } from '@/lib/pricing/auto-price';

const KNOWN = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY'];

export interface CurrenciesPanelProps {
  initial: { list: string[]; default: string; rates?: Record<string, CurrencyRate> };
}

const ROUNDING_OPTIONS: Array<{ value: RoundingRule; label: string }> = [
  { value: 'none', label: 'No rounding' },
  { value: 'integer', label: 'Round up to integer' },
  { value: '99', label: 'Round up to .99' },
  { value: '95', label: 'Round up to .95' },
];

interface RateDraft {
  rate: string;
  rounding: RoundingRule;
}

const toDrafts = (rates: Record<string, CurrencyRate> = {}): Record<string, RateDraft> =>
  Object.fromEntries(
    Object.entries(rates).map(([code, r]) => [code, { rate: String(r.rate), rounding: r.rounding }]),
  );

const CurrenciesPanel: React.FC<CurrenciesPanelProps> = ({ initial }) => {
  const [list, setList] = React.useState<string[]>(initial.list);
  const [defaultCode, setDefaultCode] = React.useState(initial.default);
  const [rates, setRates] = React.useState<Record<string, RateDraft>>(toDrafts(initial.rates));
  const [customInput, setCustomInput] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const toggle = (code: string) => {
    if (list.includes(code)) {
      const next = list.filter((c) => c !== code);
      if (next.length === 0) return;
      setList(next);
      if (defaultCode === code) setDefaultCode(next[0]);
    } else {
      setList([...list, code]);
    }
  };

  const addCustom = () => {
    const trimmed = customInput.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(trimmed)) {
      setMessage({ tone: 'bad', text: 'Currency code must be 3 letters (e.g. USD)' });
      return;
    }
    if (list.includes(trimmed)) {
      setCustomInput('');
      return;
    }
    setList([...list, trimmed]);
    setCustomInput('');
  };

  const updateRate = (code: string, patch: Partial<RateDraft>) => {
    setRates((prev) => ({ ...prev, [code]: { ...(prev[code] ?? { rate: '', rounding: 'none' }), ...patch } }));
  };

  const submit = async () => {
    setMessage(null);
    const payloadRates: Record<string, CurrencyRate> = {};
    for (const code of list) {
      if (code === defaultCode) continue;
      const draft = rates[code];
      if (!draft || draft.rate.trim() === '') continue;
      const value = Number(draft.rate);
      if (!Number.isFinite(value) || value <= 0) {
        setMessage({ tone: 'bad', text: `Rate for ${code} must be a positive number` });
        return;
      }
      payloadRates[code] = { rate: value, rounding: isZeroDecimal(code) ? 'integer' : draft.rounding };
    }
    setSaving(true);
    try {
      const res = await fetch('/api/settings/currencies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list, default: defaultCode, rates: payloadRates }),
      });
      const data = (await res.json()) as { error?: string; currencies?: { rates?: Record<string, CurrencyRate> } };
      if (!res.ok) {
        setMessage({ tone: 'bad', text: data?.error ?? 'Failed to save' });
        return;
      }
      setRates(toDrafts(data.currencies?.rates));
      setMessage({ tone: 'ok', text: 'Saved' });
    } catch (err) {
      setMessage({ tone: 'bad', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const allOptions = Array.from(new Set([...KNOWN, ...list]));

  return (
    <div className="space-y-4 max-w-xl">
      <div className="space-y-2">
        <div className="text-[12.5px] font-medium text-ds-ink">Enabled currencies</div>
        <div className="grid grid-cols-2 gap-2">
          {allOptions.map((code) => (
            <label
              key={code}
              className="flex items-center gap-2 px-3 py-2 border border-ds-line rounded-[8px] text-[13px] text-ds-ink cursor-pointer hover:bg-ds-surface2"
            >
              <input
                type="checkbox"
                checked={list.includes(code)}
                onChange={() => toggle(code)}
              />
              <span className="font-ds-mono tabular">{code}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <label className="block text-[12.5px] font-medium text-ds-ink">Add custom currency</label>
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value.toUpperCase())}
            placeholder="ISO 4217 code (e.g. CHF)"
            className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent font-ds-mono tabular"
          />
        </div>
        <button
          type="button"
          onClick={addCustom}
          className="h-9 px-3 text-[13px] rounded-[7px] border border-ds-line bg-ds-card text-ds-ink hover:bg-[#F9FAFB]"
        >
          Add
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-[12.5px] font-medium text-ds-ink">Default currency</div>
        <div className="flex gap-2 flex-wrap">
          {list.map((code) => (
            <label
              key={code}
              className={
                defaultCode === code
                  ? 'flex items-center gap-1.5 px-2.5 py-1 border border-ds-ink bg-ds-ink text-ds-card rounded-[6px] text-[12.5px] cursor-pointer'
                  : 'flex items-center gap-1.5 px-2.5 py-1 border border-ds-line bg-ds-surface2 text-ds-ink rounded-[6px] text-[12.5px] cursor-pointer hover:bg-ds-card'
              }
            >
              <input
                type="radio"
                name="default-currency"
                checked={defaultCode === code}
                onChange={() => setDefaultCode(code)}
                className="hidden"
              />
              <span className="font-ds-mono tabular">{code}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[12.5px] font-medium text-ds-ink">Exchange rates</div>
        <p className="text-[12px] text-ds-muted">
          Prices in other currencies are filled automatically from the default currency price. Prices you set by hand are never overwritten. Changing the default currency clears all rates.
        </p>
        {list.filter((code) => code !== defaultCode).length === 0 && (
          <div className="text-[12.5px] text-ds-muted">Enable another currency to set a rate.</div>
        )}
        {list
          .filter((code) => code !== defaultCode)
          .map((code) => {
            const zeroDecimal = isZeroDecimal(code);
            const draft = rates[code] ?? { rate: '', rounding: 'none' as RoundingRule };
            return (
              <div key={code} className="flex items-center gap-2 text-[13px] text-ds-ink">
                <span className="whitespace-nowrap">
                  1 <span className="font-ds-mono tabular">{defaultCode}</span> =
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={draft.rate}
                  onChange={(e) => updateRate(code, { rate: e.target.value })}
                  aria-label={`Rate for ${code}`}
                  className="w-28 h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent font-ds-mono tabular"
                />
                <span className="font-ds-mono tabular">{code}</span>
                <select
                  value={zeroDecimal ? 'integer' : draft.rounding}
                  disabled={zeroDecimal}
                  onChange={(e) => updateRate(code, { rounding: e.target.value as RoundingRule })}
                  aria-label={`Rounding for ${code}`}
                  className="h-9 px-2 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent disabled:opacity-60"
                >
                  {ROUNDING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
      </div>

      {message && (
        <div
          className={
            message.tone === 'ok'
              ? 'text-[12.5px] bg-ds-okBg border border-ds-okBorder text-ds-okText rounded-[8px] px-3 py-2'
              : 'text-[12.5px] bg-ds-badBg border border-ds-badBorder text-ds-badText rounded-[8px] px-3 py-2'
          }
        >
          {message.text}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={saving || list.length === 0}
          className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-ink bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default CurrenciesPanel;
