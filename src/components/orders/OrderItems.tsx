import * as React from 'react';

interface LineItem {
  id: string;
  title: string;
  variantTitle?: string | null;
  sku?: string | null;
  quantity: number;
  price: any;
  totalDiscount: any;
}

export interface OrderItemsProps {
  lineItems: LineItem[];
  currencyCode: string;
}

function fmt(amount: any, currency: string): string {
  const n = Number(amount);
  if (!isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

const OrderItems: React.FC<OrderItemsProps> = ({ lineItems, currencyCode }) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse">
      <thead className="bg-ds-surface2 border-b border-ds-line">
        <tr>
          <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Item</th>
          <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">SKU</th>
          <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right">Qty</th>
          <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right">Price</th>
          <th className="px-3 py-2 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {lineItems.length === 0 && (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-[12.5px] text-ds-muted">No line items.</td>
          </tr>
        )}
        {lineItems.map((li) => {
          const total = Number(li.price) * li.quantity - Number(li.totalDiscount ?? 0);
          return (
            <tr key={li.id} className="border-b border-[#F3F4F6]">
              <td className="px-3 py-2 text-[13px] text-ds-ink">
                <div>{li.title}</div>
                {li.variantTitle && (
                  <div className="text-[11.5px] text-ds-muted">{li.variantTitle}</div>
                )}
              </td>
              <td className="px-3 py-2 text-[12.5px] text-ds-slate font-ds-mono tabular">
                {li.sku || '—'}
              </td>
              <td className="px-3 py-2 text-[13px] text-ds-ink font-ds-mono tabular text-right">{li.quantity}</td>
              <td className="px-3 py-2 text-[13px] text-ds-ink font-ds-mono tabular text-right">{fmt(li.price, currencyCode)}</td>
              <td className="px-3 py-2 text-[13px] text-ds-ink font-ds-mono tabular text-right">{fmt(total, currencyCode)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default OrderItems;
