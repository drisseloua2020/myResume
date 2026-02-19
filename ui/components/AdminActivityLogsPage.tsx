import React, { useEffect, useState } from 'react';
import { listAdminActivityLogs, AdminActivityLog } from '../services/adminService';

export default function AdminActivityLogsPage() {
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await listAdminActivityLogs();
        setLogs(res);
      } catch (e: any) {
        setError(e?.message || 'Failed to load logs');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <h1 className="text-2xl font-bold text-slate-900">Activity Logs</h1>
      <p className="text-slate-600 mt-1">User and admin actions across the system.</p>

      {loading && <div className="mt-6 text-slate-600">Loading…</div>}
      {error && <div className="mt-6 text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="mt-6 overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left p-3">Time</th>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Action</th>
                <th className="text-left p-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</td>
                  <td className="p-3 whitespace-nowrap">{l.userName} <span className="text-slate-500">({l.userId})</span></td>
                  <td className="p-3 whitespace-nowrap font-medium">{l.action}</td>
                  <td className="p-3 text-slate-700 break-all">{l.details}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td className="p-4 text-slate-600" colSpan={4}>No logs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
