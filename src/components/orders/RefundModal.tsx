import * as React from 'react';
import Drawer from '@/components/ui/ds/Drawer';

export interface RefundModalProps {
  orderId: string;
  open: boolean;
  onClose: () => void;
  totalPrice: number;
  refundedSoFar: number;
  currencyCode: string;
}

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

const RefundModal: React.FC<RefundModalProps> = ({
  orderId,
  open,
  onClose,
  totalPrice,
  refundedSoFar,
  currencyCode,
}) => {
  const remaining = Math.max(0, totalPrice - refundedSoFar);
  const [mode, setMode] = React.useState<'partial' | 'full'>('partial');
  const [amount, setAmount] = React.useState(remaining.toFixed(2));
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setAmount(remaining.toFixed(2));
      setReason('');
      setError(null);
      setMode('partial');
    }
  }, [open, remaining]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const finalAmount = mode === 'full' ? remaining.toFixed(2) : amount;
    try {
      const res = await fetch(`/api/orders/${orderId}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalAmount, reason: reason.trim() || null }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data?.error ?? 'Failed to issue refund');
        return;
      }
      onClose();
      window.location.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Issue refund"
      subtitle={`Remaining ${fmt(remaining, currencyCode)} of ${fmt(totalPrice, currencyCode)}`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-line bg-ds-card text-ds-ink hover:bg-[#F9FAFB]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || remaining <= 0}
            className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-ink bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
          >
            {submitting ? 'Issuing...' : 'Issue refund'}
          </button>
        </>
      }
    >
      <div className="px-5 py-4 space-y-4">
        <div className="flex gap-2 text-[13px]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="refund-mode"
              checked={mode === 'partial'}
              onChange={() => setMode('partial')}
            />
            Partial
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="refund-mode"
              checked={mode === 'full'}
              onChange={() => setMode('full')}
            />
            Full ({fmt(remaining, currencyCode)})
          </label>
        </div>

        <div className="space-y-1">
          <label className="block text-[12.5px] font-medium text-ds-ink">Amount</label>
          <input
            type="text"
            inputMode="decimal"
            disabled={mode === 'full'}
            value={mode === 'full' ? remaining.toFixed(2) : amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent font-ds-mono tabular disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[12.5px] font-medium text-ds-ink">Reason (optional)</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
          />
        </div>

        {error && (
          <div className="text-[12.5px] bg-ds-badBg border border-ds-badBorder text-ds-badText rounded-[8px] px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default RefundModal;
