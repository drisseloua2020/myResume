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

type IconActionButtonProps = {
  label: string;
  tone: 'blue' | 'emerald' | 'red';
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

const iconToneClasses: Record<IconActionButtonProps['tone'], string> = {
  blue: 'border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-600 hover:text-white shadow-blue-100/70',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-600 hover:text-white shadow-emerald-100/70',
  red: 'border-red-100 bg-red-50 text-red-700 hover:border-red-200 hover:bg-red-600 hover:text-white shadow-red-100/70',
};

function IconActionButton({ label, tone, disabled, onClick, children }: IconActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`group relative inline-flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 ${iconToneClasses[tone]}`}
    >
      {children}
      <span className="pointer-events-none absolute -top-10 left-1/2 z-20 w-max -translate-x-1/2 rounded bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100">
        {label}
      </span>
    </button>
  );
}

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
    <div className="mx-auto max-w-[96rem] space-y-6">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(300px,0.62fr)_minmax(680px,1.38fr)]">
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
                    <IconActionButton
                      label={loadingResumeId === r.id ? 'Opening resume' : 'View resume'}
                      tone="blue"
                      onClick={() => handleView(r.id)}
                      disabled={loadingResumeId === r.id}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </IconActionButton>
                    <IconActionButton
                      label="Load resume into editor"
                      tone="emerald"
                      onClick={() => handleLoad(r.id)}
                      disabled={loadingResumeId === r.id}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12h11.25m0 0l-4.5-4.5m4.5 4.5l-4.5 4.5M19.5 4.5v15" />
                      </svg>
                    </IconActionButton>
                    <IconActionButton
                      label="Delete resume"
                      tone="red"
                      onClick={() => handleDelete(r.id)}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 7.5h10.5M9 7.5V6a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 6v1.5m-6.75 0l.75 12h6l.75-12M10.5 10.5v6M13.5 10.5v6" />
                      </svg>
                    </IconActionButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-200/50 rounded border border-slate-200 p-3 lg:p-5 min-h-[720px] shadow-sm">
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
              <div className="h-[78vh] min-h-[720px] overflow-auto rounded bg-slate-100 p-3 lg:p-5 flex justify-center">
                <div className="origin-top scale-[0.68] sm:scale-[0.78] xl:scale-[0.9] 2xl:scale-100">
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
