import { API_URL, api, getToken } from './apiClient';

export type CoverLetterListItem = {
  id: string;
  templateId: string | null;
  title: string;
  jobDescription: string;
  jobUrl?: string | null;
  createdAt: string;
};

export type CoverLetterRecord = CoverLetterListItem & {
  content: {
    coverLetterFull: string;
    coverLetterShort: string;
    coldEmail: string;
  };
};

export async function generateCoverLetter(payload: {
  jobDescription?: string;
  jobUrl?: string;
  title?: string;
  templateId?: string;
  resumeJson?: any;
}): Promise<CoverLetterRecord> {
  const res = await api.post<{ coverLetter: CoverLetterRecord }>('/cover-letters/generate', payload);
  return res.coverLetter;
}

export async function listCoverLetters(): Promise<CoverLetterListItem[]> {
  const res = await api.get<{ coverLetters: CoverLetterListItem[] }>('/cover-letters');
  return res.coverLetters;
}

export async function getCoverLetter(id: string): Promise<CoverLetterRecord> {
  const res = await api.get<{ coverLetter: CoverLetterRecord }>(`/cover-letters/${id}`);
  return res.coverLetter;
}

export async function deleteCoverLetter(id: string): Promise<void> {
  await api.delete(`/cover-letters/${id}`);
}

export async function downloadCoverLetterPdf(id: string, title = 'cover_letter'): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/cover-letters/${encodeURIComponent(id)}/pdf`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = typeof data?.detail === 'string' ? data.detail : undefined;
    throw new Error(detail || `PDF download failed (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeTitle = (title || 'cover_letter').replace(/[^a-z0-9_-]+/gi, '_');
  link.href = url;
  link.download = `${safeTitle}_${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
