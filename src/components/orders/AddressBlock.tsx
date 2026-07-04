import * as React from 'react';

export interface AddressBlockProps {
  title: string;
  address: any | null;
}

const FIELDS: Array<{ key: string; label?: string }> = [
  { key: 'name' },
  { key: 'company' },
  { key: 'address1' },
  { key: 'address2' },
  { key: 'city' },
  { key: 'province' },
  { key: 'zip' },
  { key: 'country' },
  { key: 'phone' },
];

const AddressBlock: React.FC<AddressBlockProps> = ({ title, address }) => {
  if (!address || typeof address !== 'object') {
    return (
      <div>
        <div className="text-[12.5px] uppercase tracking-[0.04em] text-ds-faint mb-1.5">
          {title}
        </div>
        <div className="text-[12.5px] text-ds-muted">No address provided.</div>
      </div>
    );
  }
  const lines = FIELDS.map((f) => address[f.key]).filter((v) => typeof v === 'string' && v.trim());
  return (
    <div>
      <div className="text-[12.5px] uppercase tracking-[0.04em] text-ds-faint mb-1.5">{title}</div>
      <div className="text-[13px] text-ds-ink leading-snug space-y-0.5">
        {lines.length === 0 ? (
          <span className="text-ds-muted">—</span>
        ) : (
          lines.map((line, i) => <div key={i}>{String(line)}</div>)
        )}
      </div>
    </div>
  );
};

export default AddressBlock;
