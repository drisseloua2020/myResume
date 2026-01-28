import React, { useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { ActivityLog, User } from '../types';
import { addProfileSourceCatalog, listProfileSourcesCatalog, listTemplates, toggleProfileSourceCatalog, ProfileSourceCatalogItem, AdminTemplate } from '../services/adminService';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [sources, setSources] = useState<ProfileSourceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceIcon, setNewSourceIcon] = useState('');
  const [newSourceProvider, setNewSourceProvider] = useState('');

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const [u, logs, tpls, srcs] = await Promise.all([
        authService.getAllUsers(),
        authService.getLogs(),
        listTemplates(),
        listProfileSourcesCatalog(),
      ]);
      setUsers(u);
      setActivityLog(logs as any);
      setTemplates(tpls);
      setSources(srcs);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'Active').length;
    const totalRevenue = users.reduce((acc, u) => acc + (typeof (u as any).paidAmount === 'string' ? parseFloat((u as any).paidAmount.replace('$', '')) : (u as any).paidAmount || 0), 0);
    return { totalUsers, activeUsers, totalRevenue: totalRevenue.toFixed(2) };
  }, [users]);

  async function addSource() {
    if (!newSourceName.trim()) {
      alert('Source name required');
      return;
    }
    try {
      const updated = await addProfileSourceCatalog({
        name: newSourceName.trim(),
        icon: newSourceIcon || undefined,
        oauthProvider: newSourceProvider || undefined,
      });
      setSources(updated);
      setNewSourceName('');
      setNewSourceIcon('');
      setNewSourceProvider('');
    } catch (e: any) {
      alert(e?.message || 'Failed to add source');
    }
  }

  async function toggleSource(id: string) {
    try {
      const updated = await toggleProfileSourceCatalog(id);
      setSources(updated);
    } catch (e: any) {
      alert(e?.message || 'Failed to toggle source');
    }
  }

  if (loading) {
    return <div className="max-w-6xl mx-auto text-slate-500">Loading admin dashboard…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Admin Console</h2>
          <button onClick={refresh} className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800">
            Refresh
          </button>
        </div>
        {err && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{err}</div>}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 my-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="text-sm text-blue-600 font-semibold uppercase">Total Users</div>
            <div className="text-3xl font-bold text-slate-900">{stats.totalUsers}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <div className="text-sm text-green-600 font-semibold uppercase">Revenue (Total)</div>
            <div className="text-3xl font-bold text-slate-900">${stats.totalRevenue}</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
            <div className="text-sm text-purple-600 font-semibold uppercase">Activities Logged</div>
            <div className="text-3xl font-bold text-slate-900">{activityLog.length}</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
            <div className="text-sm text-orange-600 font-semibold uppercase">Active Accounts</div>
            <div className="text-3xl font-bold text-slate-900">{stats.activeUsers}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">User Profiles</h3>
            <div className="overflow-hidden border border-slate-200 rounded-lg max-h-[420px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Plan</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-900">{u.name}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{u.role}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-700">{u.plan}</div>
                        <div className="text-xs text-slate-500">{u.status}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Audit Log</h3>
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 h-[420px] overflow-y-auto">
              <ul className="space-y-3">
                {activityLog.map((log) => (
                  <li key={log.id} className="text-sm border-b border-slate-200 pb-2 last:border-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1 rounded">{log.action}</span>
                      <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <span className="font-medium text-slate-700">{log.userName}</span>
                      {log.details && <span className="text-xs text-slate-500 truncate max-w-[220px]">{log.details}</span>}
                    </div>
                  </li>
                ))}
                {activityLog.length === 0 && <li className="text-slate-500 italic text-sm">No activity recorded yet.</li>}
              </ul>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Templates Supported</h3>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wide px-4 py-3 border-b border-slate-200">
                <div className="col-span-5">ID</div>
                <div className="col-span-5">Name</div>
                <div className="col-span-2">Tag</div>
              </div>
              {templates.map((t) => (
                <div key={t.id} className="grid grid-cols-12 px-4 py-3 border-b border-slate-100">
                  <div className="col-span-5 font-mono text-xs text-slate-700">{t.id}</div>
                  <div className="col-span-5 text-slate-900 font-medium">{t.name}</div>
                  <div className="col-span-2 text-slate-600 text-sm">{t.tag}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Profile Sources Catalog</h3>
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="Source name (e.g., Coursera)"
                  className="border border-slate-300 rounded px-3 py-2 text-sm"
                />
                <input
                  value={newSourceIcon}
                  onChange={(e) => setNewSourceIcon(e.target.value)}
                  placeholder="Icon (emoji or short text)"
                  className="border border-slate-300 rounded px-3 py-2 text-sm"
                />
                <input
                  value={newSourceProvider}
                  onChange={(e) => setNewSourceProvider(e.target.value)}
                  placeholder="OAuth provider (optional)"
                  className="border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <button onClick={addSource} className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800">
                Add Source
              </button>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wide px-4 py-3 border-b border-slate-200">
                  <div className="col-span-5">Source</div>
                  <div className="col-span-4">OAuth</div>
                  <div className="col-span-1">On</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                {sources.map((s) => (
                  <div key={s.id} className="grid grid-cols-12 px-4 py-3 border-b border-slate-100 items-center">
                    <div className="col-span-5 text-slate-900 font-medium">
                      <span className="mr-2">{s.icon || '🔗'}</span>
                      {s.name}
                    </div>
                    <div className="col-span-4 text-slate-700 text-sm">{s.oauthProvider || '—'}</div>
                    <div className="col-span-1 text-sm">{s.isEnabled ? '✅' : '—'}</div>
                    <div className="col-span-2 flex justify-end">
                      <button
                        onClick={() => toggleSource(s.id)}
                        className="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-sm"
                      >
                        Toggle
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-500">
                This catalog is global. A user can connect a provider via SSO and then the Profile Sync feed can use it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
