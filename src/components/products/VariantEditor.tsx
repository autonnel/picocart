import * as React from 'react';
import type { VariantDraft } from './types';
import { newClientId } from './types';

export interface VariantEditorProps {
  variants: VariantDraft[];
  onChange: (next: VariantDraft[]) => void;
}

const VariantEditor: React.FC<VariantEditorProps> = ({ variants, onChange }) => {
  const update = (clientId: string, patch: Partial<VariantDraft>) => {
    onChange(variants.map((v) => (v.clientId === clientId ? { ...v, ...patch } : v)));
  };

  const remove = (clientId: string) => {
    onChange(variants.filter((v) => v.clientId !== clientId));
  };

  const addRow = () => {
    onChange([
      ...variants,
      {
        clientId: newClientId(),
        sku: '',
        title: '',
        position: variants.length,
        inventoryQuantity: 0,
        options: [],
        prices: [],
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-ds-surface2 border-b border-ds-line">
            <tr>
              <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">SKU</th>
              <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Title</th>
              <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Options (key=value, comma-separated)</th>
              <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right">Position</th>
              <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right"></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const optionsText = v.options.map((o) => `${o.name}=${o.value}`).join(', ');
              const isLast = variants.length <= 1;
              return (
                <tr key={v.clientId} className="border-b border-[#F3F4F6]">
                  <td className="px-3 py-2">
                    <input
                      className="w-full h-8 px-2 text-[12.5px] border border-ds-line rounded-[6px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
                      value={v.sku}
                      onChange={(e) => update(v.clientId, { sku: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full h-8 px-2 text-[12.5px] border border-ds-line rounded-[6px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
                      value={v.title}
                      onChange={(e) => update(v.clientId, { title: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full h-8 px-2 text-[12.5px] border border-ds-line rounded-[6px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
                      placeholder="size=L, color=red"
                      value={optionsText}
                      onChange={(e) => {
                        const text = e.target.value;
                        const opts = text
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((p, i) => {
                            const [name, ...rest] = p.split('=');
                            return {
                              name: (name ?? '').trim(),
                              value: rest.join('=').trim(),
                              position: i,
                            };
                          })
                          .filter((o) => o.name);
                        update(v.clientId, { options: opts });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      className="w-20 h-8 px-2 text-[12.5px] border border-ds-line rounded-[6px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent text-right font-ds-mono tabular"
                      value={v.position}
                      onChange={(e) => update(v.clientId, { position: parseInt(e.target.value, 10) || 0 })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(v.clientId)}
                      disabled={isLast}
                      title={isLast ? 'A product must have at least one variant' : undefined}
                      className="text-[12px] text-ds-bad hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-line bg-ds-card text-ds-ink hover:bg-[#F9FAFB]"
      >
        + Add variant
      </button>
    </div>
  );
};

export default VariantEditor;
