import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/apiClient';
import { listProfileSourcesCatalog, listTemplates, toggleProfileSourceCatalog, AdminActivityLog, AdminUserRow, ProfileSourceCatalogItem, AdminTemplate } from '../services/adminService';
type AdminView = 'overview' | 'users' | 'features' | 'automation' | 'audit';

export default function AdminWorkflowConsolePage({ view }: { view: AdminView }) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [sources, setSources] = useState<ProfileSourceCatalogItem[]>([]);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [overview, setOverview] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<AdminActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const loadGeneration = useRef(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const generation = ++loadGeneration.current;
    const params = new URLSearchParams({ q: search, offset: String(page * 20), limit: '20' });
    const [u, l, s, t, o] = await Promise.all([
      view === 'users' ? api.get<{ users: AdminUserRow[]; total: number }>(`/admin/users?${params}`) : Promise.resolve({ users: [], total: 0 }),
      view === 'audit' ? api.get<{ logs: AdminActivityLog[]; total: number }>(`/admin/activity-logs?${params}`) : Promise.resolve({ logs: [], total: 0 }),
      listProfileSourcesCatalog(), listTemplates(), api.get<Record<string, any>>('/admin/overview')]);
    if (generation !== loadGeneration.current) return;
    setUsers(u.users); setLogs(l.logs); setTotal(view === 'users' ? u.total : l.total); setSources(s); setTemplates(t); setOverview(o);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { setBusy(true); load().catch(e => setError(e.message)).finally(() => setBusy(false)); }, 200);
    return () => { window.clearTimeout(timer); loadGeneration.current += 1; };
  }, [search, page, view]);
  useEffect(() => {
    let alive = true;
    setSelectedLogs([]);
    if (selected) api.get<{ logs: AdminActivityLog[] }>(`/admin/activity-logs?userId=${encodeURIComponent(selected.id)}&limit=20`)
      .then(result => { if (alive) setSelectedLogs(result.logs); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [selected?.id]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await action(); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const labels = { overview: 'Overview', users: 'Users', features: 'Feature Availability', automation: 'Automation', audit: 'Audit and Privacy' };
  return <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
    <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{labels[view]}</h1><button disabled={busy} className="rounded border px-3 py-2" onClick={() => run(async () => {})}>Refresh</button></div>
    {error && <p role="alert" className="bg-red-50 p-3 text-red-800">{error}</p>}
    {busy && <p role="status">Loading...</p>}
    {view === 'overview' && <dl className="grid grid-cols-2 gap-4 border-y border-slate-200 py-5 md:grid-cols-5">{['users', 'resumes', 'coverLetters', 'jobs', 'openSupport'].map(key => <div key={key}><dt className="text-sm text-slate-600">{key}</dt><dd className="text-2xl font-bold">{overview[key] ?? 'Unavailable'}</dd></div>)}</dl>}
    {view === 'users' && <>
      <input aria-label="Search users" placeholder="Search users" className="w-full rounded border p-2" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Name', 'Email', 'Plan', 'Status', 'Account'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{users.map(user => <tr key={user.id} className="border-t border-slate-200"><td className="p-3">{user.name}</td><td className="p-3">{user.email}</td><td className="p-3">{user.plan}</td><td className="p-3">{user.status}</td><td className="p-3"><button onClick={() => setSelected(user)} className="font-semibold text-blue-700">Open</button></td></tr>)}</tbody></table></div>
      <div className="flex gap-4"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={(page + 1) * 20 >= total} onClick={() => setPage(page + 1)}>Next</button></div>
      {selected && <section className="space-y-3 border-t border-slate-200 py-4"><h2 className="text-lg font-bold">{selected.name}</h2><p>{selected.email} | {selected.role} | {selected.status}</p>
        <button className="rounded border px-3 py-2" disabled={busy || selected.role === 'admin'} onClick={() => {
          const status = selected.status === 'Active' ? 'Canceled' : 'Active';
          if (window.confirm(`${status === 'Active' ? 'Reactivate' : 'Deactivate'} this user? Existing sessions will be revoked.`)) run(async () => { await api.patch(`/admin/users/${selected.id}/status`, { status }); setSelected({ ...selected, status }); });
        }}>{selected.status === 'Active' ? 'Deactivate account' : 'Reactivate account'}</button>
        <h3 className="font-semibold">Recent activity</h3>{selectedLogs.map(log => <p key={log.id} className="text-sm">{new Date(log.timestamp).toLocaleString()} | {log.action}</p>)}
      </section>}
    </>}
    {view === 'features' && <><h2 className="font-bold">Resume templates ({templates.length})</h2><ul className="grid gap-3 sm:grid-cols-3">{templates.map(t => <li className="border-b p-2" key={t.id}>{t.name} | {t.tag}</li>)}</ul>
      <h2 className="font-bold">Source catalog visibility</h2>{sources.map(source => <label key={source.id} className="flex items-center gap-3"><input type="checkbox" checked={source.isEnabled} disabled={busy} onChange={() => run(() => toggleProfileSourceCatalog(source.id))} />{source.name}</label>)}
      <p className="text-sm text-slate-600">Catalog visibility does not activate an external connector.</p></>}
    {view === 'automation' && <dl className="space-y-3"><div><dt className="font-bold">Packet preparation and review</dt><dd>Available to users. Approval is recorded against a saved snapshot.</dd></div><div><dt className="font-bold">External submission, profile synchronization, billing and email reminders</dt><dd>Unavailable. No external connector or scheduler is active.</dd></div></dl>}
    {view === 'audit' && <><p className="text-sm">Users can export their account data or delete their account from Account settings.</p><input aria-label="Search audit logs" placeholder="Search audit logs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-full rounded border p-2" />
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Date</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>{logs.map(log => <tr key={log.id} className="border-t"><td className="p-2">{new Date(log.timestamp).toLocaleString()}</td><td className="p-2">{log.userName}</td><td className="p-2">{log.action}</td><td className="p-2">{log.details}</td></tr>)}</tbody></table></div><div className="flex gap-4"><button disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} | {total} records</span><button disabled={busy || (page + 1) * 20 >= total} onClick={() => setPage(page + 1)}>Next</button></div></>}
  </main>;
}
