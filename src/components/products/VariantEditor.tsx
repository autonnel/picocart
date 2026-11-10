import * as React from 'react';
import type { ImageDraft, VariantDraft } from './types';
import { newClientId } from './types';

export interface VariantEditorProps {
  variants: VariantDraft[];
  images: ImageDraft[];
  onChange: (next: VariantDraft[]) => void;
}

const VariantImagePicker: React.FC<{
  images: ImageDraft[];
  value: string | null | undefined;
  onChange: (clientId: string | null) => void;
}> = ({ images, value, onChange }) => {
  const [anchor, setAnchor] = React.useState<{ top: number; left: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = images.find((img) => img.clientId === value);

  React.useEffect(() => {
    if (!anchor) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAnchor(null);
    };
    const close = () => setAnchor(null);
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [anchor]);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (anchor) return setAnchor(null);
    const rect = e.currentTarget.getBoundingClientRect();
    setAnchor({ top: rect.bottom + 4, left: rect.left });
  };

  const choose = (clientId: string | null) => {
    onChange(clientId);
    setAnchor(null);
  };

  return (
    <div ref={ref}>
      <button
        type="button"
        onClick={toggle}
        disabled={images.length === 0}
        title={images.length === 0 ? 'Add images in the Media tab first' : 'Choose variant image'}
        aria-label="Variant image"
        className="w-9 h-9 rounded-md border border-ds-line bg-ds-surface2 overflow-hidden inline-flex items-center justify-center text-[11px] text-ds-muted disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selected ? <img src={selected.src} alt={selected.alt ?? ''} className="w-full h-full object-cover" /> : '+'}
      </button>
      {anchor && (
        <div
          style={{ top: anchor.top, left: anchor.left }}
          className="fixed z-50 w-[232px] max-h-[280px] overflow-y-auto p-2 bg-ds-card border border-ds-line rounded-[8px] shadow-lg"
        >
          <div className="grid grid-cols-4 gap-1.5">
            {images.map((img) => (
              <button
                key={img.clientId}
                type="button"
                onClick={() => choose(img.clientId)}
                className={`w-12 h-12 rounded-md overflow-hidden border-2 ${img.clientId === value ? 'border-ds-accent' : 'border-transparent hover:border-ds-line'}`}
              >
                <img src={img.src} alt={img.alt ?? ''} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          {selected && (
            <button
              type="button"
              onClick={() => choose(null)}
              className="mt-2 w-full h-7 text-[12px] rounded-md border border-ds-line text-ds-slate hover:bg-ds-surface2"
            >
              Remove image
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const VariantEditor: React.FC<VariantEditorProps> = ({ variants, images, onChange }) => {
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
              <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Image</th>
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
                  <td className="px-3 py-2 w-[60px]">
                    <VariantImagePicker
                      images={images}
                      value={v.imageClientId}
                      onChange={(imageClientId) => update(v.clientId, { imageClientId })}
                    />
                  </td>
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
