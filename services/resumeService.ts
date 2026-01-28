import { api } from './apiClient';

export type ResumeListItem = {
  id: string;
  templateId: string;
  title: string;
  createdAt: string;
};

export type ResumeRecord = ResumeListItem & {
  content: any;
};

export type ResumeDraft = {
  id: string;
  templateId: string;
  content: any;
  createdAt: string;
  updatedAt: string;
};

export async function saveResume(payload: { templateId: string; title: string; content: any }): Promise<{ id: string }> {
  return api.post<{ id: string }>('/resumes', payload);
}

export async function listResumes(): Promise<ResumeListItem[]> {
  const res = await api.get<{ resumes: ResumeListItem[] }>('/resumes');
  return res.resumes;
}

export async function getResume(id: string): Promise<ResumeRecord> {
  const res = await api.get<{ resume: ResumeRecord }>(`/resumes/${id}`);
  return res.resume;
}

export async function deleteResume(id: string): Promise<void> {
  await api.delete(`/resumes/${id}`);
}

// ---- Drafts (autosave workspace state) ----

export async function saveDraft(payload: { templateId?: string; content: any }): Promise<void> {
  await api.post('/resumes/draft', payload);
}

export async function getLatestDraft(templateId?: string): Promise<ResumeDraft | null> {
  const qs = templateId ? `?templateId=${encodeURIComponent(templateId)}` : '';
  const res = await api.get<{ draft: ResumeDraft | null }>(`/resumes/latest-draft${qs}`);
  return res.draft;
}
