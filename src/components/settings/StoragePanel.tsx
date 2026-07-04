import * as React from 'react';

interface StoragePublic {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKeyMasked: string;
  endpoint?: string | null;
  publicBaseUrl?: string | null;
  configured: boolean;
}

export interface StoragePanelProps {
  initial: StoragePublic | null;
}

const StoragePanel: React.FC<StoragePanelProps> = ({ initial }) => {
  const [bucket, setBucket] = React.useState(initial?.bucket ?? '');
  const [region, setRegion] = React.useState(initial?.region ?? 'us-east-1');
  const [accessKeyId, setAccessKeyId] = React.useState(initial?.accessKeyId ?? '');
  const [secretAccessKey, setSecretAccessKey] = React.useState('');
  const [endpoint, setEndpoint] = React.useState(initial?.endpoint ?? '');
  const [publicBaseUrl, setPublicBaseUrl] = React.useState(initial?.publicBaseUrl ?? '');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/storage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket,
          region,
          accessKeyId,
          secretAccessKey: secretAccessKey || undefined,
          endpoint: endpoint || null,
          publicBaseUrl: publicBaseUrl || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ tone: 'bad', text: data?.error ?? 'Failed to save' });
        return;
      }
      setMessage({ tone: 'ok', text: 'Saved' });
      setSecretAccessKey('');
    } catch (err) {
      setMessage({ tone: 'bad', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {!initial?.configured && (
        <div className="text-[12.5px] bg-ds-warnBg border border-ds-warnBorder text-ds-warnText rounded-[8px] px-3 py-2">
          Configure S3 credentials below to enable image uploads.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Bucket">
          <input
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
          />
        </Field>
        <Field label="Region">
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
          />
        </Field>
        <Field label="Access key ID">
          <input
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value)}
            className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent font-ds-mono tabular"
          />
        </Field>
        <Field
          label="Secret access key"
          hint={initial?.configured ? `Currently set (${initial.secretAccessKeyMasked}). Leave blank to keep.` : undefined}
        >
          <input
            type="password"
            value={secretAccessKey}
            onChange={(e) => setSecretAccessKey(e.target.value)}
            placeholder={initial?.configured ? '••••••••' : ''}
            className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent font-ds-mono tabular"
          />
        </Field>
      </div>

      <Field label="Endpoint" hint="Leave blank for AWS S3">
        <input
          value={endpoint ?? ''}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://s3.example.com"
          className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
        />
      </Field>

      <Field label="Public base URL" hint="CDN domain prefix used to build asset URLs (optional)">
        <input
          value={publicBaseUrl ?? ''}
          onChange={(e) => setPublicBaseUrl(e.target.value)}
          placeholder="https://cdn.example.com"
          className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
        />
      </Field>

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
          disabled={saving || !bucket || !region || !accessKeyId}
          className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-ink bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="space-y-1">
    <label className="block text-[12.5px] font-medium text-ds-ink">{label}</label>
    {children}
    {hint && <div className="text-[11.5px] text-ds-muted">{hint}</div>}
  </div>
);

export default StoragePanel;
