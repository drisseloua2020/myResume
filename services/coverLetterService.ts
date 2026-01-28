import { api } from './apiClient';

export type CoverLetterListItem = {
  id: string;
  templateId: string | null;
  title: string;
  jobDescription: string;
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
  jobDescription: string;
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
