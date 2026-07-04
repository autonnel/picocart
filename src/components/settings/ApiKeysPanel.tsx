import * as React from 'react';

interface ApiKeyRow {
  id: string;
  name: string;
  writeAccess: boolean;
  isActive: boolean;
  keyPreview: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface ApiKeysPanelProps {
  initial: ApiKeyRow[];
}

const ApiKeysPanel: React.FC<ApiKeysPanelProps> = ({ initial }) => {
  const [keys, setKeys] = React.useState<ApiKeyRow[]>(initial);
  const [name, setName] = React.useState('');
  const [writeAccess, setWriteAccess] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [revealedToken, setRevealedToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), writeAccess }),
      });
      const data = (await res.json()) as { error?: string; apiKey?: ApiKeyRow; token?: string };
      if (!res.ok) {
        setError(data?.error ?? 'Failed to create');
        return;
      }
      if (data.apiKey) setKeys([data.apiKey, ...keys]);
      setRevealedToken(data.token ?? null);
      setName('');
      setWriteAccess(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this key? Calls using it will start failing immediately.')) return;
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
      if (res.ok) setKeys(keys.filter((k) => k.id !== id));
    } catch {
      // noop
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-ds-surface2 border border-ds-line rounded-[10px] p-4">
        <div className="text-[13px] font-semibold text-ds-ink mb-3">Create new API key</div>
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[220px] space-y-1">
            <label className="block text-[12.5px] font-medium text-ds-ink">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production server"
              className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
            />
          </div>
          <label className="flex items-center gap-2 h-9 px-3 border border-ds-line rounded-[7px] bg-ds-card text-[13px] text-ds-ink cursor-pointer">
            <input
              type="checkbox"
              checked={writeAccess}
              onChange={(e) => setWriteAccess(e.target.checked)}
            />
            Write access
          </label>
          <button
            type="button"
            onClick={create}
            disabled={creating || !name.trim()}
            className="h-9 px-3 text-[13px] rounded-[7px] border border-ds-ink bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
        {error && (
          <div className="text-[12.5px] bg-ds-badBg border border-ds-badBorder text-ds-badText rounded-[8px] px-3 py-2 mt-3">
            {error}
          </div>
        )}
        {revealedToken && (
          <div className="mt-3 p-3 border border-ds-okBorder bg-ds-okBg rounded-[8px]">
            <div className="text-[12.5px] font-medium text-ds-okText mb-1">
              Copy this token now — it won't be shown again.
            </div>
            <div className="font-ds-mono tabular text-[12px] text-ds-ink bg-ds-card border border-ds-line rounded-[6px] px-2 py-1 break-all">
              {revealedToken}
            </div>
            <button
              type="button"
              onClick={() => setRevealedToken(null)}
              className="text-[11.5px] text-ds-muted hover:text-ds-ink mt-2"
            >
              I've copied it, dismiss
            </button>
          </div>
        )}
      </div>

      <div className="bg-ds-card border border-ds-line rounded-[10px] overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-ds-surface2 border-b border-ds-line">
            <tr>
              <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Name</th>
              <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Token preview</th>
              <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Access</th>
              <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Created</th>
              <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right"></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[12.5px] text-ds-muted">
                  No API keys yet.
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-[#F3F4F6]">
                <td className="px-4 py-3 text-[13.5px] text-ds-ink">{k.name}</td>
                <td className="px-4 py-3 text-[12.5px] text-ds-slate font-ds-mono tabular">{k.keyPreview}</td>
                <td className="px-4 py-3 text-[12.5px] text-ds-ink">
                  {k.writeAccess ? 'Read + Write' : 'Read only'}
                </td>
                <td className="px-4 py-3 text-[12.5px] text-ds-slate">
                  {new Date(k.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => revoke(k.id)}
                    className="text-[12px] text-ds-bad hover:underline"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ApiKeysPanel;
