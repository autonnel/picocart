import * as React from 'react';
import type { VariantDraft } from './types';

export interface InventoryToggleProps {
  trackInventory: boolean;
  variants: VariantDraft[];
  onChangeTrack: (next: boolean) => void;
  onChangeVariants: (next: VariantDraft[]) => void;
}

const InventoryToggle: React.FC<InventoryToggleProps> = ({
  trackInventory,
  variants,
  onChangeTrack,
  onChangeVariants,
}) => {
  const updateQty = (clientId: string, qty: number) => {
    onChangeVariants(
      variants.map((v) =>
        v.clientId === clientId ? { ...v, inventoryQuantity: qty } : v,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-[13px] text-ds-ink">
        <input
          type="checkbox"
          checked={trackInventory}
          onChange={(e) => onChangeTrack(e.target.checked)}
          className="w-4 h-4 rounded border-ds-line"
        />
        <span>Track inventory for this product</span>
      </label>
      <p className="text-[12px] text-ds-muted">
        When disabled, variants are treated as having unlimited stock and orders never decrement
        inventory.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-ds-surface2 border-b border-ds-line">
            <tr>
              <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Variant</th>
              <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">SKU</th>
              <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {variants.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-[12.5px] text-ds-muted">
                  No variants.
                </td>
              </tr>
            )}
            {variants.map((v) => (
              <tr key={v.clientId} className="border-b border-[#F3F4F6]">
                <td className="px-3 py-2 text-[13px] text-ds-ink">{v.title || '(unnamed)'}</td>
                <td className="px-3 py-2 text-[12.5px] text-ds-slate font-ds-mono tabular">
                  {v.sku || '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    disabled={!trackInventory}
                    value={v.inventoryQuantity}
                    onChange={(e) => updateQty(v.clientId, parseInt(e.target.value, 10) || 0)}
                    className="w-24 h-8 px-2 text-[12.5px] border border-ds-line rounded-[6px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent text-right font-ds-mono tabular disabled:opacity-50"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryToggle;
