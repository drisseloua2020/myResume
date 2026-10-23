import { api, getToken } from './apiClient';
const draftQueues = new Map<string, Promise<void>>();

export type ResumeListItem = {
  id: string;
  templateId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ResumeRecord = ResumeListItem & {
  content: any;
};

export type ResumeDraft = {
  resumeId?: string | null;
  id: string;
  templateId: string;
  content: any;
  createdAt: string;
  updatedAt: string;
};

export type ParsedResumeUpload = {
  resume: Record<string, unknown>;
  warnings: string[];
  confidence: Record<string, unknown>;
  document: Record<string, unknown>;
  atsReport: Record<string, unknown>;
};

export async function saveResume(payload: { templateId: string; title: string; content: any; idempotencyKey?: string }): Promise<{ id: string }> {
  return api.post<{ id: string }>('/resumes', payload);
}

export async function updateResume(id: string, payload: { templateId?: string; title?: string; content?: any }): Promise<void> {
  await api.put(`/resumes/${id}`, payload);
}

export async function listResumes(): Promise<ResumeListItem[]> {
  const res = await api.get<{ resumes: ResumeListItem[] }>('/resumes');
  return res.resumes;
}

export async function getResume(id: string): Promise<ResumeRecord> {
  const res = await api.get<{ resume: ResumeRecord }>(`/resumes/${id}`);
  return res.resume;
}

export async function getLatestResume(): Promise<ResumeRecord | null> {
  const res = await api.get<{ resume: ResumeRecord | null }>('/resumes/latest');
  return res.resume;
}

export async function deleteResume(id: string): Promise<void> {
  await api.delete(`/resumes/${id}`);
}

// ---- Drafts (autosave workspace state) ----

export async function saveDraft(payload: { templateId?: string; resumeId?: string | null; content: any }): Promise<void> {
  const token = getToken();
  const key = `${token}:${payload.resumeId || `new:${payload.templateId || ''}`}`;
  const previous = draftQueues.get(key) || Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    if (!token || getToken() !== token) throw new Error('Session changed before the draft could be saved.');
    await api.post('/resumes/draft', payload);
  });
  draftQueues.set(key, next);
  try { await next; } finally { if (draftQueues.get(key) === next) draftQueues.delete(key); }
}

export async function getLatestDraft(templateId?: string, resumeId?: string): Promise<ResumeDraft | null> {
  const query = new URLSearchParams();
  if (templateId) query.set('templateId', templateId);
  if (resumeId) query.set('resumeId', resumeId);
  const qs = query.size ? `?${query}` : '';
  const res = await api.get<{ draft: ResumeDraft | null }>(`/resumes/latest-draft${qs}`);
  return res.draft;
}

export async function parseResumeUpload(payload: {
  importFormat?: 'ats';
  fileData: {
    mimeType: string;
    data: string;
    name?: string;
  };
}): Promise<ParsedResumeUpload> {
  return api.post<ParsedResumeUpload>('/resumes/parse-upload', payload);
}
