import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CareerToolkitPage from './CareerToolkitPage';
import { getLatestResume } from '../services/resumeService';
import {
  analyzeCareer,
  createAchievement,
  createCareerJob,
  createResumeVersion,
  exportCareerData,
  exportResumeFormats,
  getCareerAnalytics,
  getCareerFeatures,
  importLinkedInProfile,
  listAchievements,
  listCareerJobs,
  listResumeVersions,
} from '../services/careerService';

vi.mock('../services/resumeService', () => ({
  getLatestResume: vi.fn(),
}));

vi.mock('../services/careerService', () => ({
  analyzeCareer: vi.fn(),
  createAchievement: vi.fn(),
  createCareerJob: vi.fn(),
  createResumeVersion: vi.fn(),
  exportCareerData: vi.fn(),
  exportResumeFormats: vi.fn(),
  getCareerAnalytics: vi.fn(),
  getCareerFeatures: vi.fn(),
  importLinkedInProfile: vi.fn(),
  listAchievements: vi.fn(),
  listCareerJobs: vi.fn(),
  listResumeVersions: vi.fn(),
  updateCareerJob: vi.fn(),
}));

const report = {
  noLlmCalls: true,
  privacyBadge: 'No LLM calls: deterministic local rules only',
  atsScore: 82,
  job: {
    title: 'Platform Engineer',
    company: 'Acme',
    location: 'Remote',
    salary: '$140,000',
    responsibilities: ['Build platforms'],
    requirements: ['AWS'],
    keywords: { hardSkills: ['Cloud'], softSkills: ['Communication'], tools: ['AWS'], certifications: [] },
  },
  missingKeywords: { all: ['Terraform'], hardSkills: [], softSkills: [], tools: ['Terraform'], certifications: [] },
  includedKeywords: ['AWS', 'Cloud'],
  sectionMatches: [
    { section: 'summary', matched: ['Cloud'], missing: ['Terraform'], score: 50 },
    { section: 'experience', matched: ['AWS'], missing: [], score: 80 },
  ],
  bulletQuality: { averageScore: 75, bullets: [] },
  riskScan: { score: 90, risks: [] },
  completeness: { score: 88, checks: [] },
  skillTaxonomy: { normalized: ['AWS'], duplicates: [] },
  readyToApplyChecklist: [{ label: 'ATS score is 75 or higher', passed: true }],
  linkedinChecklist: [],
  templates: { followUpEmail: 'Hello follow up' },
  featureCoverage: [],
  exportsPreview: { atsText: 'Resume text' },
};

describe('CareerToolkitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLatestResume).mockResolvedValue({
      id: 'res_1',
      templateId: 'modern_tech',
      title: 'Latest Resume',
      content: { targetRole: 'Platform Engineer' },
      createdAt: '2026-08-11T00:00:00Z',
      updatedAt: '2026-08-11T00:00:00Z',
    });
    vi.mocked(listCareerJobs).mockResolvedValue({ jobs: [] });
    vi.mocked(listAchievements).mockResolvedValue({ achievements: [] });
    vi.mocked(listResumeVersions).mockResolvedValue({ versions: [] });
    vi.mocked(getCareerAnalytics).mockResolvedValue({ analytics: { total: 0, byStatus: {} } });
    vi.mocked(getCareerFeatures).mockResolvedValue({ features: [{ group: 'ATS and Resume Quality', name: 'ATS score', operation: 'deterministic', llmCalls: false }] });
    vi.mocked(analyzeCareer).mockResolvedValue({ report } as any);
    vi.mocked(createCareerJob).mockResolvedValue({ job: {} as any });
    vi.mocked(createAchievement).mockResolvedValue({ achievements: [] });
    vi.mocked(createResumeVersion).mockResolvedValue({ versions: [] });
    vi.mocked(exportResumeFormats).mockResolvedValue({ exports: { txtBase64: 'UmVzdW1l', pdfValidation: { selectableText: true } } });
    vi.mocked(exportCareerData).mockResolvedValue({ privacy: { noLlmCalls: true } });
    vi.mocked(importLinkedInProfile).mockResolvedValue({ resume: { targetRole: 'Imported' } as any, checklist: [], warnings: [] });
  });

  it('runs deterministic ATS analysis and shows the report', async () => {
    const user = userEvent.setup();
    render(<CareerToolkitPage />);

    expect(await screen.findByText(/career toolkit/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /run ats analysis/i }));

    await waitFor(() => {
      expect(analyzeCareer).toHaveBeenCalledWith(expect.objectContaining({
        jobDescription: expect.stringContaining('Platform Engineer'),
      }));
    });
    expect(await screen.findByText('82')).toBeInTheDocument();
    expect(screen.getByText('Terraform')).toBeInTheDocument();
    expect(screen.getByText(/deterministic local rules/i)).toBeInTheDocument();
  });
});
