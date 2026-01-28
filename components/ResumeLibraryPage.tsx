import React, { useEffect, useMemo, useState } from 'react';
import { AVAILABLE_TEMPLATES } from '../constants';
import { deleteResume, getResume, listResumes, ResumeListItem } from '../services/resumeService';

function templateName(id: string) {
  return AVAILABLE_TEMPLATES.find((t) => t.id === id)?.name || id;
}

export default function ResumeLibraryPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ResumeListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const itemsWithTemplate = useMemo(() => {
    return items.map((i) => ({ ...i, templateName: templateName(i.templateId) }));
  }, [items]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listResumes();
      setItems(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load resumes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDownload(id: string) {
    try {
      const r = await getResume(id);
      const blob = new Blob([JSON.stringify(r.content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = (r.title || 'resume').replace(/[^a-z0-9_-]+/gi, '_');
      a.download = `${safeTitle}_${r.templateId}_${id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || 'Download failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this saved resume?')) return;
    try {
      await deleteResume(id);
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Resumes</h2>
          <p className="text-slate-600">Saved resumes are listed by most recent save date.</p>
        </div>
        <button
          onClick={refresh}
          className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : itemsWithTemplate.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded p-6 text-slate-600">
          You haven't saved any resumes yet. Generate a resume, then click <b>Save to Library</b>.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="grid grid-cols-12 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wide px-4 py-3 border-b border-slate-200">
            <div className="col-span-5">Title</div>
            <div className="col-span-3">Template</div>
            <div className="col-span-2">Saved</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {itemsWithTemplate.map((r) => (
            <div key={r.id} className="grid grid-cols-12 px-4 py-3 border-b border-slate-100 items-center">
              <div className="col-span-5">
                <div className="font-medium text-slate-900">{r.title}</div>
                <div className="text-xs text-slate-500">{r.id}</div>
              </div>
              <div className="col-span-3 text-slate-700">{r.templateName}</div>
              <div className="col-span-2 text-slate-700 text-sm">{new Date(r.createdAt).toLocaleDateString()}</div>
              <div className="col-span-2 flex justify-end gap-2">
                <button
                  onClick={() => handleDownload(r.id)}
                  className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 text-sm"
                >
                  Download
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-900 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
