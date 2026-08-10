import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AVAILABLE_TEMPLATES } from '../constants';
import { SubscriptionPlan, User, UserRole } from '../types';
import { deleteResume, getResume, listResumes, ResumeListItem } from '../services/resumeService';
import type { ResumeRecord } from '../services/resumeService';
import ConfirmDeleteResumeModal from './ConfirmDeleteResumeModal';
import LivePreview from './LivePreview';

function templateName(id: string) {
  return AVAILABLE_TEMPLATES.find((t) => t.id === id)?.name || id;
}

function safeFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'resume';
}

type ResumeLibraryPageProps = {
  onLoadResume?: (resume: ResumeRecord) => void | Promise<void>;
  onResumeDeleted?: (resumeId: string, options?: { isLibraryEmpty: boolean }) => void | Promise<void>;
  user?: User;
};

const fallbackUser: User = {
  id: 'preview',
  name: 'Resume User',
  email: '',
  role: UserRole.USER,
  plan: SubscriptionPlan.FREE,
  status: 'Active',
  createdAt: new Date().toISOString(),
  paidAmount: '$0.00',
  authProvider: 'email',
};

export default function ResumeLibraryPage({ onLoadResume, onResumeDeleted, user = fallbackUser }: ResumeLibraryPageProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ResumeListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingResumeId, setLoadingResumeId] = useState<string | null>(null);
  const [selectedResume, setSelectedResume] = useState<ResumeRecord | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const itemsWithTemplate = useMemo(() => {
    return items.map((i) => ({ ...i, templateName: templateName(i.templateId) }));
  }, [items]);

  async function refresh(): Promise<ResumeListItem[]> {
    setLoading(true);
    setError(null);
    try {
      const res = await listResumes();
      setItems(res);
      return res;
    } catch (e: any) {
      setError(e?.message || 'Failed to load resumes');
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleView(id: string) {
    setLoadingResumeId(id);
    setError(null);
    try {
      const resume = await getResume(id);
      setSelectedResume(resume);
    } catch (e: any) {
      setError(e?.message || 'Failed to open resume');
    } finally {
      setLoadingResumeId(null);
    }
  }

  async function handleLoad(id: string) {
    if (!onLoadResume) return;
    setLoadingResumeId(id);
    try {
      const resume = selectedResume?.id === id ? selectedResume : await getResume(id);
      await onLoadResume(resume);
    } catch (e: any) {
      alert(e?.message || 'Load failed');
    } finally {
      setLoadingResumeId(null);
    }
  }

  async function handleDownloadPdf() {
    const node = exportRef.current;
    if (!node || !selectedResume) return;

    setDownloadingPdf(true);
    setError(null);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(node, {
        backgroundColor: '#ffffff',
        scale: Math.max(2, window.devicePixelRatio || 1),
        useCORS: true,
        logging: false,
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      const imageData = canvas.toDataURL('image/png');

      let remainingHeight = imageHeight;
      let y = 0;
      pdf.addImage(imageData, 'PNG', 0, y, pageWidth, imageHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        y -= pageHeight;
        pdf.addPage();
        pdf.addImage(imageData, 'PNG', 0, y, pageWidth, imageHeight);
        remainingHeight -= pageHeight;
      }

      pdf.save(`${safeFilename(selectedResume.title)}.pdf`);
    } catch (e: any) {
      setError(e?.message || 'PDF download failed');
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteConfirmId(id);
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return;
    const deletedResumeId = deleteConfirmId;
    setIsDeleting(true);
    try {
      await deleteResume(deletedResumeId);
      if (selectedResume?.id === deletedResumeId) setSelectedResume(null);
      const refreshedItems = await refresh();
      await onResumeDeleted?.(deletedResumeId, { isLibraryEmpty: refreshedItems.length === 0 });
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">View Resume</h2>
          <p className="mt-2 text-slate-600">Open a saved resume, review it visually, download it as PDF, or send it back to the editor.</p>
        </div>
        <button
          onClick={refresh}
          className="self-start px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(320px,0.82fr)_minmax(520px,1.18fr)]">
        <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="text-sm font-semibold text-slate-800">Saved Resumes</div>
            <div className="text-xs text-slate-500">{itemsWithTemplate.length} saved</div>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-slate-500">Loading...</div>
          ) : itemsWithTemplate.length === 0 ? (
            <div className="px-4 py-6 text-slate-600">
              You have not saved any resumes yet. Open Editor, complete a resume, then save it.
            </div>
          ) : (
            <div>
              {itemsWithTemplate.map((r) => (
                <div key={r.id} className={`border-b border-slate-100 px-4 py-4 ${selectedResume?.id === r.id ? 'bg-blue-50/60' : ''}`}>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{r.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{r.templateName} | {new Date(r.updatedAt || r.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleView(r.id)}
                      disabled={loadingResumeId === r.id}
                      className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60 text-sm font-semibold"
                    >
                      {loadingResumeId === r.id ? 'Opening...' : 'View'}
                    </button>
                    <button
                      onClick={() => handleLoad(r.id)}
                      disabled={loadingResumeId === r.id}
                      className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 text-sm font-semibold"
                    >
                      Load in Editor
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-200/50 rounded border border-slate-200 p-4 lg:p-6 min-h-[640px] shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Resume Preview</h3>
              <div className="text-lg font-bold text-slate-900">{selectedResume?.title || 'No resume selected'}</div>
            </div>
            <button
              onClick={handleDownloadPdf}
              disabled={!selectedResume || downloadingPdf}
              className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 text-sm font-semibold"
            >
              {downloadingPdf ? 'Generating...' : 'Download PDF'}
            </button>
          </div>

          {selectedResume ? (
            <>
              <div className="h-[720px] overflow-auto rounded bg-slate-100 p-4 flex justify-center">
                <div className="origin-top scale-[0.62] sm:scale-[0.72] xl:scale-[0.82]">
                  <LivePreview data={selectedResume.content} user={user} templateId={selectedResume.templateId} />
                </div>
              </div>
              <div
                aria-hidden="true"
                className="fixed left-[-10000px] top-0 w-[210mm] bg-white"
              >
                <div ref={exportRef}>
                  <LivePreview data={selectedResume.content} user={user} templateId={selectedResume.templateId} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-[520px] items-center justify-center rounded bg-white border border-dashed border-slate-300 text-center text-slate-600">
              <div>
                <div className="font-semibold text-slate-900">Select a resume to view it</div>
                <p className="mt-1 text-sm">Saved resumes appear on the left after you create or import them in Editor.</p>
              </div>
            </div>
          )}
        </div>
      </div>

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
