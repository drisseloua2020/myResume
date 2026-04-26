import React, { useEffect, useState } from 'react';
import { listAdminResumes, AdminResumeRow } from '../services/adminService';

export default function AdminResumesPage() {
  const [rows, setRows] = useState<AdminResumeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await listAdminResumes();
        setRows(res);
      } catch (e: any) {
        setError(e?.message || 'Failed to load resumes');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <h1 className="text-2xl font-bold text-slate-900">Resumes</h1>
      <p className="text-slate-600 mt-1">All saved resumes across users (id, user id, template, date).</p>

      {loading && <div className="mt-6 text-slate-600">Loading…</div>}
      {error && <div className="mt-6 text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="mt-6 overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left p-3">Saved</th>
                <th className="text-left p-3">Resume</th>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Template</th>
                <th className="text-left p-3">Title</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="p-3">
                    <div className="font-mono text-xs">{r.id}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{r.userName}</div>
                    <div className="text-xs text-slate-500">{r.userEmail} • {r.userId}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">{r.templateId}</td>
                  <td className="p-3">{r.title}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="p-4 text-slate-600" colSpan={5}>No resumes found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
