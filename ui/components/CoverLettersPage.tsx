import React, { useEffect, useMemo, useState } from 'react';
import { AVAILABLE_TEMPLATES } from '../constants';
import { generateCoverLetter, listCoverLetters, getCoverLetter, deleteCoverLetter, CoverLetterListItem, CoverLetterRecord } from '../services/coverLetterService';
//import { getSessionUser } from '../services/apiClient'; {user?.email}
import { getLatestDraft, ResumeDraft } from '../services/resumeService';

function templateName(id: string | null) {
  if (!id) return 'N/A';
  return AVAILABLE_TEMPLATES.find(t => t.id === id)?.name || id;
}

type Props = {
  onOpenExamples?: () => void;
};

export default function CoverLettersPage({ onOpenExamples }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CoverLetterListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [latestDraft, setLatestDraft] = useState<ResumeDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);

  const [jobDescription, setJobDescription] = useState('');
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState<string>(AVAILABLE_TEMPLATES[0]?.id || 'classic_pro');
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<CoverLetterRecord | null>(null);

  const [viewerTab, setViewerTab] = useState<'cover_letter' | 'resume'>('cover_letter');

  //const user = getSessionUser();

  const sorted = useMemo(() => items, [items]);

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
    // Cover letters should be grounded on the user's latest resume draft.
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

  function hasResumeData(draft: ResumeDraft | null): boolean {
    if (!draft?.content) return false;
    // Lightweight heuristic to avoid enabling generation on an empty object.
    if (typeof draft.content !== 'object') return true;
    return Object.keys(draft.content).length > 0;
  }

  const canGenerate = jobDescription.trim().length >= 20 && hasResumeData(latestDraft);

  async function handleGenerate() {
    if (!hasResumeData(latestDraft)) {
      alert('Please create or import a resume in WorkSpace first. Then come back to generate a cover letter.');
      return;
    }
    if (jobDescription.trim().length < 20) {
      alert('Please paste a job description (at least 20 characters).');
      return;
    }

    setGenerating(true);
    try {
      const record = await generateCoverLetter({
        jobDescription,
        title: title || undefined,
        templateId,
        resumeJson: latestDraft?.content ?? null,
      });
      setSelected(record);
      setViewerTab('cover_letter');
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function openLetter(id: string) {
    try {
      const r = await getCoverLetter(id);
      setSelected(r);
    } catch (e: any) {
      alert(e?.message || 'Failed to open');
    }
  }

  async function removeLetter(id: string) {
    if (!confirm('Delete this cover letter?')) return;
    try {
      await deleteCoverLetter(id);
      if (selected?.id === id) setSelected(null);
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    }
  }

  function downloadSelected() {
    if (!selected) return;
    const text = selected.content.coverLetterFull || '';
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (selected.title || 'cover_letter').replace(/[^a-z0-9_-]+/gi, '_');
    a.download = `${safeTitle}_${selected.id}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Cover Letters</h2>
          <p className="text-slate-600">
            Paste a job description, generate a tailored cover letter, and keep it saved in your account.
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
              <label className="text-xs font-semibold text-slate-600">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Software Engineer - Acme"
                className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Template (optional)</label>
              <select
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

          <div>
            <label className="text-xs font-semibold text-slate-600">Job Description</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={10}
              className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
              placeholder="Paste the job description here…"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className="w-full bg-slate-900 text-white rounded px-4 py-2 font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate & Save'}
          </button>

          <div className="text-xs text-slate-500">
            {draftLoading ? (
              'Checking your latest resume draft…'
            ) : hasResumeData(latestDraft) ? (
              <>Using your latest resume draft saved on <b>{new Date(latestDraft!.updatedAt).toLocaleString()}</b>.</>
            ) : (
              <>No resume draft found. Go to <b>WorkSpace</b> to create or import a resume to enable cover letter generation.</>
            )}
          </div>

          <div className="text-xs text-slate-500">
            Signed in as <b>User</b>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="text-sm font-semibold text-slate-800">Saved Letters</div>
            <button onClick={refresh} className="text-sm text-slate-700 hover:text-slate-900">Refresh</button>
          </div>

          {error && <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">{error}</div>}

          {loading ? (
            <div className="px-4 py-6 text-slate-500">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="px-4 py-6 text-slate-600">No cover letters yet. Generate your first one above.</div>
          ) : (
            <div>
              {sorted.map((cl) => (
                <div key={cl.id} className="px-4 py-3 border-b border-slate-100 flex items-start justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{cl.title}</div>
                    <div className="text-xs text-slate-500">{templateName(cl.templateId)} · {new Date(cl.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openLetter(cl.id)} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 text-sm">Open</button>
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
            onClick={downloadSelected}
            disabled={!selected}
            className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Download
          </button>
        </div>

        {viewerTab === 'cover_letter' ? (
          selected ? (
            <div className="bg-white border border-slate-200 rounded p-6">
              <div className="text-xs text-slate-500 mb-2">{selected.title} · {templateName(selected.templateId)}</div>
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
