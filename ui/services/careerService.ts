import { api } from './apiClient';
import type { UserInputData } from '../types';

export type CareerAnalysisReport = {
  noLlmCalls: boolean;
  privacyBadge: string;
  atsScore: number;
  job: {
    title: string;
    company?: string | null;
    location?: string | null;
    salary?: string | null;
    responsibilities: string[];
    requirements: string[];
    keywords: Record<string, string[]>;
  };
  missingKeywords: Record<string, string[]>;
  includedKeywords: string[];
  sectionMatches: Array<{ section: string; matched: string[]; missing: string[]; score: number }>;
  bulletQuality: { averageScore: number; bullets: Array<{ text: string; score: number; checks: Record<string, boolean> }> };
  riskScan: { score: number; risks: Array<{ severity: string; item: string; fix: string }> };
  completeness: { score: number; checks: Array<{ label: string; passed: boolean }> };
  skillTaxonomy: { normalized: string[]; duplicates: string[] };
  readyToApplyChecklist: Array<{ label: string; passed: boolean }>;
  linkedinChecklist: Array<{ label: string; passed: boolean }>;
  templates: Record<string, string>;
  featureCoverage: Array<{ group: string; name: string; operation: string; llmCalls: boolean }>;
  exportsPreview: { atsText: string };
};

export type CareerJob = {
  id: string;
  status: 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';
  title: string;
  company?: string | null;
  jobUrl?: string | null;
  jobDescription: string;
  location?: string | null;
  salary?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  deadline?: string | null;
  resumeId?: string | null;
  coverLetterId?: string | null;
  packet?: any;
  reminders?: any;
  savedAnswers?: any;
  createdAt: string;
  updatedAt: string;
};

export type CareerAchievement = {
  id: string;
  title: string;
  category: string;
  content: string;
  tags?: any;
  metrics?: string | null;
  sourceResumeId?: string | null;
  createdAt: string;
};

export type CareerVersion = {
  id: string;
  resumeId?: string | null;
  jobApplicationId?: string | null;
  kind: string;
  title: string;
  locale?: string | null;
  content: UserInputData | Record<string, unknown>;
  changeSummary?: string | null;
  createdAt: string;
};

export function analyzeCareer(payload: {
  resumeJson: UserInputData | Record<string, unknown>;
  jobDescription: string;
  jobUrl?: string;
  targetCountry?: string;
  targetLanguage?: string;
}): Promise<{ report: CareerAnalysisReport }> {
  return api.post('/career/analyze', payload);
}

export function exportResumeFormats(payload: {
  resumeJson: UserInputData | Record<string, unknown>;
  title?: string;
  publicProfileUrl?: string;
  redactPii?: boolean;
}): Promise<{ exports: Record<string, any> }> {
  return api.post('/career/exports/resume', payload);
}

export function importLinkedInProfile(profileText: string): Promise<{ resume: UserInputData; checklist: Array<{ label: string; passed: boolean }>; warnings: string[] }> {
  return api.post('/career/import/linkedin', { profileText });
}

export function listCareerJobs(): Promise<{ jobs: CareerJob[] }> {
  return api.get('/career/jobs');
}

export function createCareerJob(payload: Partial<CareerJob>): Promise<{ job: CareerJob }> {
  return api.post('/career/jobs', payload);
}

export function updateCareerJob(id: string, payload: Partial<CareerJob>): Promise<{ job: CareerJob }> {
  return api.patch(`/career/jobs/${id}`, payload);
}

export function getCareerAnalytics(): Promise<{ analytics: Record<string, any> }> {
  return api.get('/career/jobs/analytics');
}

export function listAchievements(): Promise<{ achievements: CareerAchievement[] }> {
  return api.get('/career/achievements');
}

export function createAchievement(payload: { title: string; category?: string; content: string; tags?: string[]; metrics?: string; sourceResumeId?: string }): Promise<{ achievements: CareerAchievement[] }> {
  return api.post('/career/achievements', payload);
}

export function listResumeVersions(): Promise<{ versions: CareerVersion[] }> {
  return api.get('/career/resume-versions');
}

export function createResumeVersion(payload: { resumeId?: string; jobApplicationId?: string; kind: string; title: string; locale?: string; content: any; changeSummary?: string }): Promise<{ versions: CareerVersion[] }> {
  return api.post('/career/resume-versions', payload);
}

export function getCareerFeatures(): Promise<{ features: Array<{ group: string; name: string; operation: string; llmCalls: boolean }> }> {
  return api.get('/career/features');
}

export function exportCareerData(): Promise<Record<string, any>> {
  return api.get('/career/data-export');
}

export function deleteCareerData(): Promise<{ ok: boolean }> {
  return api.delete('/career/data');
}
