import React, { useEffect, useState } from 'react';
import { listAdminAgentUpdates, AdminAgentUpdate } from '../services/adminService';

export default function AdminAgentUpdatesPage() {
  const [updates, setUpdates] = useState<AdminAgentUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const rows = await listAdminAgentUpdates();
        setUpdates(rows);
      } catch (e: any) {
        setError(e?.message || 'Failed to load agent updates');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <h1 className="text-2xl font-bold text-slate-900">Agent Updates</h1>
      <p className="text-slate-600 mt-1">Updates detected by agents across all users.</p>

      {loading && <div className="mt-6 text-slate-600">Loading…</div>}
      {error && <div className="mt-6 text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="mt-6 overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {updates.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">{new Date(u.dateFound).toLocaleDateString()}</td>
                  <td className="p-3">
                    <div className="font-medium">{u.userName}</div>
                    <div className="text-xs text-slate-500">{u.userEmail} • {u.userId}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">{u.source}</td>
                  <td className="p-3 whitespace-nowrap">{u.type}</td>
                  <td className="p-3">{u.title}<div className="text-xs text-slate-500 mt-1">{u.description}</div></td>
                  <td className="p-3 whitespace-nowrap">{u.status}</td>
                </tr>
              ))}
              {updates.length === 0 && (
                <tr><td className="p-4 text-slate-600" colSpan={6}>No agent updates found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
