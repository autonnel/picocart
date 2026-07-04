import * as React from 'react';

export interface OrderTrackingFormProps {
  orderId: string;
  initialNumber: string | null;
  initialCompany: string | null;
  initialFulfillmentStatus: 'UNFULFILLED' | 'SHIPPED' | 'DELIVERED';
}

const OrderTrackingForm: React.FC<OrderTrackingFormProps> = ({
  orderId,
  initialNumber,
  initialCompany,
  initialFulfillmentStatus,
}) => {
  const [number, setNumber] = React.useState(initialNumber ?? '');
  const [company, setCompany] = React.useState(initialCompany ?? '');
  const [status, setStatus] = React.useState(initialFulfillmentStatus);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: number || null,
          trackingCompany: company || null,
          fulfillmentStatus: status,
        }),
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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[12.5px] font-medium text-ds-ink">Tracking number</label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent font-ds-mono tabular"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[12.5px] font-medium text-ds-ink">Carrier</label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-[12.5px] font-medium text-ds-ink">Fulfillment status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
        >
          <option value="UNFULFILLED">Unfulfilled</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
        </select>
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
          onClick={save}
          disabled={saving}
          className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-ink bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default OrderTrackingForm;
