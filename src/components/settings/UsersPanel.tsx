import * as React from 'react';

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  roles: Array<{ id: string; name: string }>;
}

interface RoleOption {
  id: string;
  name: string;
}

export interface UsersPanelProps {
  initial: UserRow[];
  roles: RoleOption[];
}

const UsersPanel: React.FC<UsersPanelProps> = ({ initial, roles }) => {
  const [users, setUsers] = React.useState<UserRow[]>(initial);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState(roles[0]?.name ?? 'viewer');
  const [inviting, setInviting] = React.useState(false);
  const [inviteResult, setInviteResult] = React.useState<{
    tone: 'ok' | 'bad';
    text: string;
    inviteUrl?: string;
  } | null>(null);

  const updateRole = async (userId: string, roleId: string) => {
    try {
      const res = await fetch(`/api/settings/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleIds: roleId ? [roleId] : [] }),
      });
      if (res.ok) {
        const role = roles.find((r) => r.id === roleId);
        setUsers(
          users.map((u) =>
            u.id === userId ? { ...u, roles: role ? [role] : [] } : u,
          ),
        );
      }
    } catch {
      // noop
    }
  };

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch('/api/settings/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), roleName: inviteRole }),
      });
      const data = (await res.json()) as {
        error?: string;
        invitation?: { token: string; email: string; expiresAt: string };
      };
      if (!res.ok || !data.invitation) {
        setInviteResult({ tone: 'bad', text: data?.error ?? 'Failed to invite' });
        return;
      }
      const inviteUrl = `${window.location.origin}/login?invite=${data.invitation.token}`;
      setInviteResult({
        tone: 'ok',
        text: `Invitation created for ${data.invitation.email}`,
        inviteUrl,
      });
      setInviteEmail('');
    } catch (err) {
      setInviteResult({ tone: 'bad', text: (err as Error).message });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-ds-surface2 border border-ds-line rounded-[10px] p-4">
        <div className="text-[13px] font-semibold text-ds-ink mb-3">Invite user</div>
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[220px] space-y-1">
            <label className="block text-[12.5px] font-medium text-ds-ink">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full h-9 px-3 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[12.5px] font-medium text-ds-ink">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="h-9 px-2 text-[13px] border border-ds-line rounded-[7px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={invite}
            disabled={inviting || !inviteEmail.trim()}
            className="h-9 px-3 text-[13px] rounded-[7px] border border-ds-ink bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
          >
            {inviting ? 'Inviting...' : 'Invite'}
          </button>
        </div>
        {inviteResult && (
          <div
            className={
              inviteResult.tone === 'ok'
                ? 'text-[12.5px] bg-ds-okBg border border-ds-okBorder text-ds-okText rounded-[8px] px-3 py-2 mt-3'
                : 'text-[12.5px] bg-ds-badBg border border-ds-badBorder text-ds-badText rounded-[8px] px-3 py-2 mt-3'
            }
          >
            <div>{inviteResult.text}</div>
            {inviteResult.inviteUrl && (
              <div className="font-ds-mono tabular text-[12px] mt-1 break-all">
                {inviteResult.inviteUrl}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-ds-card border border-ds-line rounded-[10px] overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-ds-surface2 border-b border-ds-line">
            <tr>
              <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">User</th>
              <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Email</th>
              <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-[12.5px] text-ds-muted">
                  No users yet.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const currentRoleId = u.roles[0]?.id ?? '';
              return (
                <tr key={u.id} className="border-b border-[#F3F4F6]">
                  <td className="px-4 py-3 text-[13.5px] text-ds-ink">{u.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-ds-slate">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={currentRoleId}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      className="h-8 px-2 text-[12.5px] border border-ds-line rounded-[6px] bg-ds-card focus:outline-none focus:ring-2 focus:ring-ds-accent"
                    >
                      <option value="">No role</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsersPanel;
