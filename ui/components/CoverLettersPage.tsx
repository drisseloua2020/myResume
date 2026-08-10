import React, { useEffect, useMemo, useState } from 'react';
import { AVAILABLE_TEMPLATES } from '../constants';
import {
  CoverLetterListItem,
  CoverLetterRecord,
  deleteCoverLetter,
  downloadCoverLetterPdf,
  generateCoverLetter,
  getCoverLetter,
  listCoverLetters,
} from '../services/coverLetterService';
import { getLatestDraft, ResumeDraft } from '../services/resumeService';

function templateName(id: string | null) {
  if (!id) return 'N/A';
  return AVAILABLE_TEMPLATES.find(t => t.id === id)?.name || id;
}

function hasResumeData(draft: ResumeDraft | null): boolean {
  if (!draft?.content) return false;
  if (typeof draft.content !== 'object') return true;
  return Object.keys(draft.content).length > 0;
}

function resumeReferenceFromDraft(draft: ResumeDraft | null): string {
  const content = draft?.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return 'Latest resume draft';
  const personal = content.personalDetails || {};
  const name = [personal.firstName, personal.lastName].filter(Boolean).join(' ').trim();
  const role = content.targetRole || content.experienceItems?.[0]?.role || '';
  const label = [name, role].filter(Boolean).join(' - ') || 'Latest resume draft';
  return `${label} (${templateName(draft?.templateId || null)})`;
}

function letterResumeReference(letter: CoverLetterListItem | CoverLetterRecord, latestDraft: ResumeDraft | null): string {
  return letter.content?.resumeReference || resumeReferenceFromDraft(latestDraft);
}

function jobPreview(value: string): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Job description from URL';
  return clean.length > 160 ? `${clean.slice(0, 160)}...` : clean;
}

type JobSourceMode = 'url' | 'paste';
type CoverLetterTab = 'generate' | 'viewer';

export default function CoverLettersPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CoverLetterListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [latestDraft, setLatestDraft] = useState<ResumeDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<CoverLetterTab>('generate');
  const [jobSourceMode, setJobSourceMode] = useState<JobSourceMode>('url');
  const [jobUrl, setJobUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState<string>(AVAILABLE_TEMPLATES[0]?.id || 'classic_pro');
  const [generating, setGenerating] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<CoverLetterRecord | null>(null);

  const sorted = useMemo(() => items, [items]);
  const resumeReference = resumeReferenceFromDraft(latestDraft);
  const canGenerateFromUrl = jobUrl.trim().length >= 8 && /^https?:\/\//i.test(jobUrl.trim());
  const canGenerateFromPaste = jobDescription.trim().length >= 20;
  const canGenerate = hasResumeData(latestDraft) && (jobSourceMode === 'url' ? canGenerateFromUrl : canGenerateFromPaste);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listCoverLetters();
      setItems(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load cover letters');
    } finally {
      setLoading(false);
    }
  }

  async function loadLatestDraft(): Promise<ResumeDraft | null> {
    setDraftLoading(true);
    try {
      const draft = await getLatestDraft();
      setLatestDraft(draft);
      return draft;
    } catch {
      setLatestDraft(null);
      return null;
    } finally {
      setDraftLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    void loadLatestDraft();
  }, []);

  async function handleGenerate() {
    setError(null);
    setGenerationNotice(null);
    const draft = await loadLatestDraft();
    const reference = resumeReferenceFromDraft(draft);

    if (!hasResumeData(draft)) {
      setError('Please create or import a resume in Editor first. Then come back to generate a cover letter.');
      return;
    }
    if (jobSourceMode === 'url' && !canGenerateFromUrl) {
      setError('Enter a valid http or https job posting URL.');
      return;
    }
    if (jobSourceMode === 'paste' && !canGenerateFromPaste) {
      setError('Paste a job description with at least 20 characters.');
      return;
    }

    setGenerating(true);
    setGenerationNotice(`Generating a cover letter linked to ${reference}.`);
    try {
      const record = await generateCoverLetter({
        jobDescription: jobSourceMode === 'paste' ? jobDescription.trim() : undefined,
        jobUrl: jobSourceMode === 'url' ? jobUrl.trim() : undefined,
        title: title.trim() || undefined,
        templateId,
        resumeJson: draft?.content ?? null,
      });
      setSelected(record);
      setItems(prev => [record, ...prev.filter(item => item.id !== record.id)]);
      setTitle('');
      if (jobSourceMode === 'url') {
        setJobUrl('');
      }
      setGenerationNotice(`Created "${record.title}" using ${record.content?.resumeReference || reference}. Open it from the Viewer tab.`);
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
      setGenerationNotice(null);
    } finally {
      setGenerating(false);
    }
  }

  async function openLetter(id: string) {
    setError(null);
    try {
      const r = await getCoverLetter(id);
      setSelected(r);
      setActiveTab('viewer');
    } catch (e: any) {
      setError(e?.message || 'Failed to open cover letter');
    }
  }

  async function removeLetter(id: string) {
    if (!confirm('Delete this cover letter?')) return;
    setError(null);
    try {
      await deleteCoverLetter(id);
      if (selected?.id === id) setSelected(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  }

  async function downloadPdf(letter: CoverLetterListItem | CoverLetterRecord) {
    setError(null);
    try {
      await downloadCoverLetterPdf(letter.id, letter.title);
    } catch (e: any) {
      setError(e?.message || 'PDF download failed');
    }
  }

  return (
    <div className="mx-auto max-w-[96rem] space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Cover Letters</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Create a tailored cover letter from a job post and the latest resume you entered in the editor.
          </p>
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 shadow-sm">
          {draftLoading ? (
            'Loading your latest resume...'
          ) : hasResumeData(latestDraft) ? (
            <>Latest resume automatically linked: <b>{resumeReference}</b></>
          ) : (
            <>No resume draft found. Open <b>Editor</b> to create or import a resume first.</>
          )}
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('generate')}
          className={`px-5 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === 'generate' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Generate
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('viewer')}
          className={`px-5 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === 'viewer' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Viewer
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {generationNotice && (
        <div className={`rounded border px-4 py-3 text-sm ${generating ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {generationNotice}
        </div>
      )}

      {activeTab === 'generate' ? (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-5 text-white">
              <h3 className="text-lg font-bold">Generate from Job Post</h3>
              <p className="mt-1 text-sm text-slate-200">Paste a job URL, confirm the linked resume, and generate a saved cover letter.</p>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <div className="inline-flex rounded border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setJobSourceMode('url')}
                    className={`px-4 py-2 rounded text-sm font-semibold ${jobSourceMode === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                  >
                    Job URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setJobSourceMode('paste')}
                    className={`px-4 py-2 rounded text-sm font-semibold ${jobSourceMode === 'paste' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                  >
                    Paste Description
                  </button>
                </div>

                {jobSourceMode === 'url' ? (
                  <div>
                    <label htmlFor="job-url" className="text-xs font-bold uppercase tracking-wide text-slate-500">Job Posting URL</label>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                      <input
                        id="job-url"
                        value={jobUrl}
                        onChange={(e) => setJobUrl(e.target.value)}
                        placeholder="https://company.com/careers/software-engineer"
                        className="min-w-0 flex-1 rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={generating || !canGenerate}
                        className="rounded bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {generating ? 'Generating...' : 'Generate Linked Letter'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">If the URL cannot be read, switch to Paste Description.</p>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="job-description" className="text-xs font-bold uppercase tracking-wide text-slate-500">Job Description</label>
                    <textarea
                      id="job-description"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      rows={9}
                      className="mt-2 w-full rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-blue-400 focus:bg-white"
                      placeholder="Paste the job description here..."
                    />
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={generating || !canGenerate}
                      className="mt-3 rounded bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {generating ? 'Generating...' : 'Generate Linked Letter'}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="cover-letter-title" className="text-xs font-bold uppercase tracking-wide text-slate-500">Job Title</label>
                    <input
                      id="cover-letter-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Optional, inferred when possible"
                      className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="cover-letter-template" className="text-xs font-bold uppercase tracking-wide text-slate-500">Template</label>
                    <select
                      id="cover-letter-template"
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      {AVAILABLE_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 6h9m-9 6h9m-9 6h9M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
                  </svg>
                </div>
                <div className="font-bold">Reference Resume</div>
                <p className="mt-1 leading-relaxed">
                  {draftLoading ? 'Checking the latest editor draft...' : resumeReference}
                </p>
                <button
                  type="button"
                  onClick={() => void loadLatestDraft()}
                  className="mt-4 rounded border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                >
                  Refresh Linked Resume
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <div className="text-sm font-bold text-slate-900">Generated Cover Letters</div>
                <div className="text-xs text-slate-500">{sorted.length} saved</div>
              </div>
              <button onClick={refresh} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Refresh</button>
            </div>

            {loading ? (
              <div className="px-5 py-8 text-slate-500">Loading...</div>
            ) : sorted.length === 0 ? (
              <div className="px-5 py-8 text-slate-600">No cover letters yet. Generate your first one above.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-white">
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3">Job Description</th>
                      <th className="px-5 py-3">Cover Letter</th>
                      <th className="px-5 py-3">Used Resume</th>
                      <th className="px-5 py-3">Download</th>
                      <th className="px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sorted.map((cl) => (
                      <tr key={cl.id} className="align-top hover:bg-slate-50/80">
                        <td className="max-w-[420px] px-5 py-4">
                          <div className="font-semibold text-slate-900">{cl.title}</div>
                          <div className="mt-1 text-xs leading-relaxed text-slate-500">{jobPreview(cl.jobDescription)}</div>
                          {cl.jobUrl && (
                            <a href={cl.jobUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-bold text-blue-700 hover:text-blue-900">
                              Open job URL
                            </a>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => openLetter(cl.id)}
                            className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500"
                          >
                            Read Cover Letter
                          </button>
                        </td>
                        <td className="max-w-[260px] px-5 py-4 text-xs font-semibold leading-relaxed text-slate-600">
                          {letterResumeReference(cl, latestDraft)}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => downloadPdf(cl)}
                            className="rounded bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
                          >
                            Download PDF
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <button onClick={() => removeLetter(cl.id)} className="rounded border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-600">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Viewer</h3>
              <p className="text-xs text-slate-500">{selected ? `${selected.title} | ${templateName(selected.templateId)}` : 'Choose Read Cover Letter from the generated table.'}</p>
            </div>
            <button
              onClick={() => selected && downloadPdf(selected)}
              disabled={!selected}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download PDF
            </button>
          </div>

          {selected ? (
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[320px_1fr]">
              <aside className="border-b border-slate-200 bg-slate-50 p-5 lg:border-b-0 lg:border-r">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Job Description</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{jobPreview(selected.jobDescription)}</p>
                {selected.jobUrl && (
                  <a href={selected.jobUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-blue-700 hover:text-blue-900">
                    Open job URL
                  </a>
                )}
                <div className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">Reference Resume</div>
                <p className="mt-2 text-sm font-semibold text-slate-800">{letterResumeReference(selected, latestDraft)}</p>
              </aside>
              <div className="p-8">
                <div className="mx-auto max-w-3xl">
                  <h4 className="text-2xl font-bold text-slate-900">{selected.title}</h4>
                  <div className="mt-6 min-h-[560px] whitespace-pre-wrap rounded border border-slate-100 bg-white p-6 text-sm leading-7 text-slate-800 shadow-sm">
                    {selected.content.coverLetterFull || ''}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-600">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M8 11h8M8 15h5M5 4h14v16H5z" />
                </svg>
              </div>
              <div className="font-semibold text-slate-900">No cover letter selected</div>
              <p className="mt-1 text-sm">Click Read Cover Letter from the table to open it here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
