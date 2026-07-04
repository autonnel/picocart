import * as React from 'react';

const KNOWN = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY'];

export interface CurrenciesPanelProps {
  initial: { list: string[]; default: string };
}

const CurrenciesPanel: React.FC<CurrenciesPanelProps> = ({ initial }) => {
  const [list, setList] = React.useState<string[]>(initial.list);
  const [defaultCode, setDefaultCode] = React.useState(initial.default);
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

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/currencies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list, default: defaultCode }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ tone: 'bad', text: data?.error ?? 'Failed to save' });
        return;
      }
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
