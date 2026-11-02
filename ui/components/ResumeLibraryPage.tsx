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

function formatResumeDate(value?: string) {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ResumeLibraryPage({ onLoadResume, onResumeDeleted, user = fallbackUser }: ResumeLibraryPageProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ResumeListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingResumeId, setLoadingResumeId] = useState<string | null>(null);
  const [selectedResume, setSelectedResume] = useState<ResumeRecord | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [query, setQuery] = useState('');
  const exportRef = useRef<HTMLDivElement>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const itemsWithTemplate = useMemo(() => {
    return items.map((i) => ({ ...i, templateName: templateName(i.templateId) }));
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return itemsWithTemplate;
    return itemsWithTemplate.filter((item) => {
      return [item.title, item.templateName]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [itemsWithTemplate, query]);

  const templateCount = useMemo(() => {
    return new Set(itemsWithTemplate.map((item) => item.templateId)).size;
  }, [itemsWithTemplate]);

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
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-[#f7fbff] via-white to-[#eef8f5] shadow-sm">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">
              Resume library
            </div>
            <h2 className="text-4xl font-black leading-tight tracking-normal text-slate-950 lg:text-5xl">All resumes</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Review saved resumes, open a clean preview, edit the right version, or remove outdated drafts.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={refresh}
              className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search resumes</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title or template"
              className="w-full rounded-md border border-slate-200 bg-[#f4f8fb] px-4 py-3 text-base font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">{itemsWithTemplate.length} saved</span>
            <span className="rounded-full bg-teal-50 px-3 py-2 text-sm font-black text-teal-700">{templateCount} templates</span>
            {selectedResume && (
              <span className="rounded-full bg-amber-50 px-3 py-2 text-sm font-black text-amber-700">Previewing 1</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(480px,0.92fr)_minmax(560px,1.08fr)]">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black tracking-normal text-slate-950">Saved resumes</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Choose a resume to view, edit, or delete.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                {filteredItems.length} shown
              </span>
            </div>
          </div>

          {loading ? (
            <div className="px-5 py-8 text-sm font-semibold text-slate-500">Loading resumes...</div>
          ) : itemsWithTemplate.length === 0 ? (
            <div className="px-5 py-10 text-slate-600">
              <div className="text-lg font-black text-slate-950">No saved resumes yet</div>
              <p className="mt-2 text-sm leading-6">Open Resume Editor, complete a resume, then save it here.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="px-5 py-10 text-slate-600">
              <div className="text-lg font-black text-slate-950">No matches</div>
              <p className="mt-2 text-sm leading-6">Try searching by another title or template.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredItems.map((r) => (
                <article
                  key={r.id}
                  className={`grid gap-4 px-5 py-5 transition-colors lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${
                    selectedResume?.id === r.id ? 'bg-blue-50/70 shadow-[inset_4px_0_0_#1a91f0]' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-4">
                    <div className="relative h-[72px] w-14 overflow-hidden rounded-md bg-white shadow-md ring-1 ring-slate-200">
                      <div className="absolute left-3 right-3 top-4 h-1.5 rounded-full bg-blue-500" />
                      <div className="absolute left-3 right-3 top-7 h-1.5 rounded-full bg-slate-200" />
                      <div className="absolute left-3 right-6 top-10 h-1.5 rounded-full bg-slate-200" />
                      <div className="absolute left-3 right-4 top-[52px] h-1.5 rounded-full bg-slate-200" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-black tracking-normal text-slate-950">{r.title}</h4>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-500">
                        <span>{r.templateName}</span>
                        <span aria-hidden="true">|</span>
                        <span>Updated {formatResumeDate(r.updatedAt || r.createdAt)}</span>
                        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-black text-teal-700">Saved</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      aria-label={loadingResumeId === r.id ? `Opening resume ${r.title}` : `View resume ${r.title}`}
                      onClick={() => handleView(r.id)}
                      disabled={loadingResumeId === r.id}
                      className="rounded-md border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 transition-colors hover:border-blue-200 hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit resume ${r.title}`}
                      onClick={() => handleLoad(r.id)}
                      disabled={loadingResumeId === r.id}
                      className="rounded-md border border-teal-100 bg-teal-50 px-4 py-2.5 text-sm font-black text-teal-700 transition-colors hover:border-teal-200 hover:bg-teal-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete resume ${r.title}`}
                      onClick={() => handleDelete(r.id)}
                      className="rounded-md border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition-colors hover:border-red-200 hover:bg-red-600 hover:text-white"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Resume preview</h3>
              <div className="mt-1 text-xl font-black tracking-normal text-slate-950">{selectedResume?.title || 'No resume selected'}</div>
              {selectedResume && (
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {templateName(selectedResume.templateId)} | Updated {formatResumeDate(selectedResume.updatedAt || selectedResume.createdAt)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!selectedResume || downloadingPdf}
                className="rounded-md bg-[#26384d] px-4 py-2.5 text-sm font-black text-white hover:bg-[#1c2b3d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloadingPdf ? 'Generating...' : 'Download PDF'}
              </button>
              <button
                type="button"
                onClick={() => selectedResume && handleLoad(selectedResume.id)}
                disabled={!selectedResume || loadingResumeId === selectedResume.id}
                className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Edit
              </button>
            </div>
          </div>

          {selectedResume ? (
            <>
              <div className="flex h-[78vh] min-h-[720px] justify-center overflow-auto rounded-lg border border-slate-200 bg-gradient-to-b from-[#eaf2f8] to-[#f8fbfd] p-3 lg:p-5">
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
            <div className="flex h-[560px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-[#f8fbfd] px-6 text-center text-slate-600">
              <div className="max-w-sm">
                <div className="mx-auto mb-5 h-24 w-20 rounded-md bg-white shadow-md ring-1 ring-slate-200">
                  <div className="mx-4 pt-5">
                    <div className="h-1.5 rounded-full bg-blue-500" />
                    <div className="mt-3 h-1.5 rounded-full bg-slate-200" />
                    <div className="mt-3 h-1.5 rounded-full bg-slate-200" />
                    <div className="mt-3 h-1.5 w-8 rounded-full bg-slate-200" />
                  </div>
                </div>
                <div className="text-lg font-black text-slate-950">Select a resume to preview</div>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Use View to open a saved resume here before downloading or editing it.</p>
              </div>
            </div>
          )}
        </aside>
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
