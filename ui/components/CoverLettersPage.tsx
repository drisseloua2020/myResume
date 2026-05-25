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

type Props = {
  onOpenExamples?: () => void;
};

type JobSourceMode = 'url' | 'paste';

export default function CoverLettersPage({ onOpenExamples }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CoverLetterListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [latestDraft, setLatestDraft] = useState<ResumeDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);

  const [jobSourceMode, setJobSourceMode] = useState<JobSourceMode>('url');
  const [jobUrl, setJobUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState<string>(AVAILABLE_TEMPLATES[0]?.id || 'classic_pro');
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<CoverLetterRecord | null>(null);
  const [viewerTab, setViewerTab] = useState<'cover_letter' | 'resume'>('cover_letter');

  const sorted = useMemo(() => items, [items]);
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

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    (async () => {
      setDraftLoading(true);
      try {
        const draft = await getLatestDraft();
        setLatestDraft(draft);
      } catch {
        setLatestDraft(null);
      } finally {
        setDraftLoading(false);
      }
    })();
  }, []);

  async function handleGenerate() {
    setError(null);
    if (!hasResumeData(latestDraft)) {
      setError('Please create or import a resume in WorkSpace first. Then come back to generate a cover letter.');
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
    try {
      const record = await generateCoverLetter({
        jobDescription: jobSourceMode === 'paste' ? jobDescription.trim() : undefined,
        jobUrl: jobSourceMode === 'url' ? jobUrl.trim() : undefined,
        title: title.trim() || undefined,
        templateId,
        resumeJson: latestDraft?.content ?? null,
      });
      setSelected(record);
      setViewerTab('cover_letter');
      setTitle('');
      if (jobSourceMode === 'url') {
        setJobUrl('');
      }
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function openLetter(id: string) {
    setError(null);
    try {
      const r = await getCoverLetter(id);
      setSelected(r);
      setViewerTab('cover_letter');
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
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] gap-8">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Cover Letters</h2>
            <p className="text-slate-600">
              Use a job post URL or paste the job description, then save every tailored cover letter to your account.
            </p>
          </div>

          {onOpenExamples && (
            <button
              onClick={onOpenExamples}
              className="mt-1 px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800"
            >
              View Examples
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cover-letter-title" className="text-xs font-semibold text-slate-600">Job Title</label>
              <input
                id="cover-letter-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional, inferred when possible"
                className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="cover-letter-template" className="text-xs font-semibold text-slate-600">Template</label>
              <select
                id="cover-letter-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
              >
                {AVAILABLE_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
              <label htmlFor="job-url" className="text-xs font-semibold text-slate-600">Job Posting URL</label>
              <input
                id="job-url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://company.com/careers/software-engineer"
                className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
              <p className="mt-2 text-xs text-slate-500">
                If the page cannot be read, you will see an error and can paste the job description instead.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="job-description" className="text-xs font-semibold text-slate-600">Job Description</label>
              <textarea
                id="job-description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={10}
                className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="Paste the job description here..."
              />
            </div>
          )}

          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className="w-full bg-slate-900 text-white rounded px-4 py-2 font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate & Save'}
          </button>

          <div className="text-xs text-slate-500">
            {draftLoading ? (
              'Checking your latest resume draft...'
            ) : hasResumeData(latestDraft) ? (
              <>Using your latest resume draft saved on <b>{new Date(latestDraft!.updatedAt).toLocaleString()}</b>.</>
            ) : (
              <>No resume draft found. Go to <b>WorkSpace</b> to create or import a resume to enable cover letter generation.</>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="text-sm font-semibold text-slate-800">Saved Letters</div>
            <button onClick={refresh} className="text-sm text-slate-700 hover:text-slate-900">Refresh</button>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-slate-500">Loading...</div>
          ) : sorted.length === 0 ? (
            <div className="px-4 py-6 text-slate-600">No cover letters yet. Generate your first one above.</div>
          ) : (
            <div>
              {sorted.map((cl) => (
                <div key={cl.id} className="px-4 py-3 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{cl.title}</div>
                    <div className="text-xs text-slate-500">{templateName(cl.templateId)} | {new Date(cl.createdAt).toLocaleString()}</div>
                    {cl.jobUrl && (
                      <a href={cl.jobUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-blue-700 hover:text-blue-900">
                        Job link
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openLetter(cl.id)} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 text-sm">View</button>
                    <button onClick={() => downloadPdf(cl)} className="px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 text-sm">Download PDF</button>
                    <button onClick={() => removeLetter(cl.id)} className="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-sm">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">Viewer</h3>
            <div className="flex bg-slate-100 rounded p-1">
              <button
                onClick={() => setViewerTab('cover_letter')}
                className={`px-3 py-1 text-sm rounded ${viewerTab === 'cover_letter' ? 'bg-white shadow' : 'text-slate-600'}`}
              >
                Cover Letter
              </button>
              <button
                onClick={() => setViewerTab('resume')}
                className={`px-3 py-1 text-sm rounded ${viewerTab === 'resume' ? 'bg-white shadow' : 'text-slate-600'}`}
              >
                Resume
              </button>
            </div>
          </div>
          <button
            onClick={() => selected && downloadPdf(selected)}
            disabled={!selected}
            className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>

        {viewerTab === 'cover_letter' ? (
          selected ? (
            <div className="bg-white border border-slate-200 rounded p-6">
              <div className="text-xs text-slate-500 mb-2">{selected.title} | {templateName(selected.templateId)}</div>
              {selected.jobUrl && (
                <a href={selected.jobUrl} target="_blank" rel="noreferrer" className="mb-4 inline-block text-xs font-semibold text-blue-700 hover:text-blue-900">
                  Open job post
                </a>
              )}
              <div className="whitespace-pre-wrap text-slate-800 text-sm leading-relaxed">
                {selected.content.coverLetterFull || ''}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded p-6 text-slate-600">
              Select a saved letter to preview it here.
            </div>
          )
        ) : (
          <div className="bg-white border border-slate-200 rounded p-6">
            <div className="text-xs text-slate-500 mb-2">Latest resume draft (JSON)</div>
            {hasResumeData(latestDraft) ? (
              <pre className="text-xs text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                {JSON.stringify(latestDraft?.content ?? {}, null, 2)}
              </pre>
            ) : (
              <div className="text-slate-600 text-sm">No resume draft found yet. Create or import a resume in WorkSpace.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
