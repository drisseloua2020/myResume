import React, { useEffect, useMemo, useState } from 'react';
import { AVAILABLE_TEMPLATES } from '../constants';
import { deleteResume, getResume, listResumes, ResumeListItem } from '../services/resumeService';
import type { ResumeRecord } from '../services/resumeService';
import ConfirmDeleteResumeModal from './ConfirmDeleteResumeModal';

function templateName(id: string) {
  return AVAILABLE_TEMPLATES.find((t) => t.id === id)?.name || id;
}

type ResumeLibraryPageProps = {
  onLoadResume?: (resume: ResumeRecord) => void | Promise<void>;
};

export default function ResumeLibraryPage({ onLoadResume }: ResumeLibraryPageProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ResumeListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingResumeId, setLoadingResumeId] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  async function handleLoad(id: string) {
    if (!onLoadResume) return;
    setLoadingResumeId(id);
    try {
      const resume = await getResume(id);
      await onLoadResume(resume);
    } catch (e: any) {
      alert(e?.message || 'Load failed');
    } finally {
      setLoadingResumeId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeleteConfirmId(id);
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      await deleteResume(deleteConfirmId);
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
        <div className="text-slate-500">Loading...</div>
      ) : itemsWithTemplate.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded p-6 text-slate-600">
          You haven't saved any resumes yet. Generate a resume, then click <b>Save to Library</b>.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wide px-4 py-3 border-b border-slate-200">
            <div className="col-span-3">Title</div>
            <div className="col-span-3">Template</div>
            <div className="col-span-2">Saved</div>
            <div className="col-span-4 text-right">Actions</div>
          </div>
          {itemsWithTemplate.map((r) => (
            <div key={r.id} className="grid grid-cols-1 gap-3 px-4 py-4 border-b border-slate-100 items-center sm:grid-cols-12 sm:gap-0">
              <div className="sm:col-span-3 min-w-0">
                <div className="font-medium text-slate-900">{r.title}</div>
                <div className="text-xs text-slate-500">{r.id}</div>
              </div>
              <div className="sm:col-span-3 text-slate-700">{r.templateName}</div>
              <div className="sm:col-span-2 text-slate-700 text-sm">{new Date(r.updatedAt || r.createdAt).toLocaleDateString()}</div>
              <div className="sm:col-span-4 flex flex-wrap justify-start sm:justify-end gap-2">
                <button
                  onClick={() => handleLoad(r.id)}
                  disabled={loadingResumeId === r.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h12m0 0l-4-4m4 4l-4 4M3 5h6a2 2 0 012 2v10a2 2 0 01-2 2H3" />
                  </svg>
                  {loadingResumeId === r.id ? 'Loading...' : 'Load in Editor'}
                </button>
                <button
                  onClick={() => handleDownload(r.id)}
                  className="px-3 py-1.5 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-semibold whitespace-nowrap"
                >
                  Download
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold whitespace-nowrap"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    {deleteConfirmId && (
      <ConfirmDeleteResumeModal
        loading={isDeleting}
        onCancel={() => {
          if (!isDeleting) setDeleteConfirmId(null);
        }}
        onConfirm={confirmDelete}
      />
    )}

    </div>
  );
}
