import * as React from 'react';

export interface CustomerCardProps {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  ordersCount: number;
  totalSpent: number;
  currencyCode: string;
}

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

const CustomerCard: React.FC<CustomerCardProps> = ({
  email,
  firstName,
  lastName,
  phone,
  ordersCount,
  totalSpent,
  currencyCode,
}) => {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim() || '(no name)';
  return (
    <div className="bg-ds-card border border-ds-line rounded-[10px] shadow-[0_1px_2px_rgba(17,24,39,.04)] p-6">
      <div className="text-[16px] font-semibold text-ds-ink">{name}</div>
      <div className="text-[13px] text-ds-slate mt-0.5">{email}</div>
      {phone && <div className="text-[13px] text-ds-slate">{phone}</div>}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-ds-line">
        <div>
          <div className="text-[11.5px] uppercase tracking-[0.04em] text-ds-faint">Orders</div>
          <div className="text-[18px] font-semibold text-ds-ink font-ds-mono tabular mt-1">{ordersCount}</div>
        </div>
        <div>
          <div className="text-[11.5px] uppercase tracking-[0.04em] text-ds-faint">Total spent</div>
          <div className="text-[18px] font-semibold text-ds-ink font-ds-mono tabular mt-1">
            {fmt(totalSpent, currencyCode)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCard;
