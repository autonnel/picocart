import * as React from 'react';

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  features: string[];
}

interface FeatureCatalogItem {
  id: string;
  label: string;
}

export interface RolesPanelProps {
  initial: RoleRow[];
  catalog: FeatureCatalogItem[];
}

const RolesPanel: React.FC<RolesPanelProps> = ({ initial, catalog }) => {
  const [roles, setRoles] = React.useState<RoleRow[]>(initial);
  const [activeRoleId, setActiveRoleId] = React.useState(initial[0]?.id ?? '');
  const [createName, setCreateName] = React.useState('');
  const [createDesc, setCreateDesc] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [savingFeatures, setSavingFeatures] = React.useState(false);

  const activeRole = roles.find((r) => r.id === activeRoleId);

  const createRole = async () => {
    if (!createName.trim()) return;
    setError(null);
    try {
      const res = await fetch('/api/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() || null }),
      });
      const data = (await res.json()) as { error?: string; role?: RoleRow };
      if (!res.ok) {
        setError(data?.error ?? 'Failed to create');
        return;
      }
      if (!data.role) return;
      const newRole: RoleRow = { ...data.role, features: [] };
      setRoles([...roles, newRole]);
      setActiveRoleId(newRole.id);
      setCreateName('');
      setCreateDesc('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteRole = async (id: string) => {
    if (!confirm('Delete this role?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/settings/roles/${id}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data?.error ?? 'Failed to delete');
        return;
      }
      setRoles(roles.filter((r) => r.id !== id));
      if (activeRoleId === id) setActiveRoleId(roles[0]?.id ?? '');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleFeature = (featureId: string) => {
    if (!activeRole || activeRole.isSystem) return;
    const next = activeRole.features.includes(featureId)
      ? activeRole.features.filter((f) => f !== featureId)
      : [...activeRole.features, featureId];
    setRoles(roles.map((r) => (r.id === activeRole.id ? { ...r, features: next } : r)));
  };

  const saveFeatures = async () => {
    if (!activeRole || activeRole.isSystem) return;
    setSavingFeatures(true);
    setError(null);
    try {
      const res = await fetch(`/api/settings/roles/${activeRole.id}/features`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureIds: activeRole.features }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data?.error ?? 'Failed to save');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingFeatures(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-[12.5px] bg-ds-badBg border border-ds-badBorder text-ds-badText rounded-[8px] px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-2">
          <div className="text-[12.5px] font-semibold text-ds-ink">Roles</div>
          <div className="space-y-1">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRoleId(r.id)}
                className={
                  r.id === activeRoleId
                    ? 'w-full text-left px-3 py-2 rounded-md border border-ds-ink bg-ds-ink text-ds-card text-[13px]'
                    : 'w-full text-left px-3 py-2 rounded-md border border-ds-line bg-ds-card text-ds-ink text-[13px] hover:bg-ds-surface2'
                }
              >
                <div className="font-medium">{r.name}</div>
                {r.isSystem && (
                  <div className="text-[11px] opacity-80">System role</div>
                )}
              </button>
            ))}
          </div>
          <div className="bg-ds-surface2 border border-ds-line rounded-[8px] p-3 space-y-2">
            <div className="text-[12px] font-medium text-ds-ink">New role</div>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Name"
              className="w-full h-8 px-2 text-[12.5px] border border-ds-line rounded-[6px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
            />
            <input
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full h-8 px-2 text-[12.5px] border border-ds-line rounded-[6px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
            />
            <button
              type="button"
              onClick={createRole}
              disabled={!createName.trim()}
              className="w-full h-8 px-2 text-[12.5px] rounded-[6px] border border-ds-ink bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
            >
              Create role
            </button>
          </div>
        </div>

        <div className="md:col-span-2">
          {activeRole ? (
            <div className="bg-ds-card border border-ds-line rounded-[10px] p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold text-ds-ink">{activeRole.name}</div>
                  {activeRole.description && (
                    <div className="text-[12.5px] text-ds-muted">{activeRole.description}</div>
                  )}
                </div>
                {!activeRole.isSystem && (
                  <button
                    type="button"
                    onClick={() => deleteRole(activeRole.id)}
                    className="text-[12px] text-ds-bad hover:underline"
                  >
                    Delete role
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2">
                {catalog.map((f) => {
                  const checked = activeRole.features.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      className={
                        activeRole.isSystem
                          ? 'flex items-center gap-2 px-3 py-2 border border-ds-line rounded-[8px] text-[13px] text-ds-muted opacity-75'
                          : 'flex items-center gap-2 px-3 py-2 border border-ds-line rounded-[8px] text-[13px] text-ds-ink cursor-pointer hover:bg-ds-surface2'
                      }
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={activeRole.isSystem}
                        onChange={() => toggleFeature(f.id)}
                      />
                      <span className="flex-1">{f.label}</span>
                      <span className="font-ds-mono tabular text-[11px] text-ds-faint">{f.id}</span>
                    </label>
                  );
                })}
              </div>

              {!activeRole.isSystem && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveFeatures}
                    disabled={savingFeatures}
                    className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-ink bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
                  >
                    {savingFeatures ? 'Saving...' : 'Save features'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[13px] text-ds-muted">Select a role to view its features.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RolesPanel;
