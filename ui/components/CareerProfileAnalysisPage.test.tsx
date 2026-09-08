import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CareerProfileAnalysisPage from './CareerProfileAnalysisPage';
import {
  generateCareerProfileAnalysis,
  getCareerProfileAnalysis,
  type CareerProfileAnalysis,
} from '../services/onboardingService';

vi.mock('../services/onboardingService', () => ({
  generateCareerProfileAnalysis: vi.fn(),
  getCareerProfileAnalysis: vi.fn(),
}));

const analysis: CareerProfileAnalysis = {
  id: 'cpa_1',
  userId: 'usr_1',
  onboardingProfileId: 'onb_1',
  resumeId: 'res_1',
  profileCategory: 'Technical Career Builder',
  resumeCategory: 'Technical and IT resume',
  recommendedJobFamily: 'Software, IT, cloud, data, and systems roles',
  skillFocus: 'System design',
  createdAt: '2026-09-07T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
  analysis: {
    noLlmCalls: true,
    privacyBadge: 'No LLM calls: deterministic local rules only',
    profileCategory: {
      label: 'Technical Career Builder',
      level: 'Mid to senior specialist',
      confidence: 88,
      summary: 'You are best positioned as a technical career builder.',
      evidence: ['Starting point: Experienced specialist', 'Primary strength: Technical skills'],
      nextMilestone: 'Show depth through outcomes.',
    },
    resume: {
      id: 'res_1',
      category: 'Technical and IT resume',
      readinessScore: 78,
      completenessScore: 88,
      bulletQualityScore: 72,
      riskScore: 90,
      skillCoverageScore: 66,
      strengths: ['Name', 'Email'],
      improvements: ['Add proof for system design.'],
      risks: [],
      visibleSkills: ['AWS', 'Python'],
    },
    thingsNeeded: {
      headline: 'What to build next to become an expert',
      prioritySkills: [{
        skill: 'System design',
        why: 'This skill is a strong signal.',
        currentSignal: 'Not yet visible enough.',
        action: 'Build one project that proves system design.',
        timeline: '2-4 weeks',
      }],
      expertPlan: ['Pick one target role family.'],
      supportNeed: 'Improve resume wording',
    },
    jobTargets: {
      recommendedFamily: 'Software, IT, cloud, data, and systems roles',
      recommendedTitles: [{
        title: 'Software Engineer',
        fitScore: 86,
        why: 'Matches the selected target direction.',
        keywords: ['software', 'cloud'],
        applicationAngle: 'Lead with outcomes.',
        autoAgentApply: {
          status: 'ready_to_prepare',
          nextAction: 'Prepare tailored resume.',
          requiredBeforeApply: [],
        },
      }],
      searchStrategy: {
        preferredWorkStyle: 'Remote-first roles',
        keywords: ['software', 'cloud'],
        batchSize: 12,
        reviewAfterApplications: 20,
      },
      autoAgentApplyFeature: {
        enabled: true,
        status: 'ready_to_configure',
        details: 'The agent can prepare tailored packets and tracker entries.',
      },
    },
    source: {
      resumeId: 'res_1',
      onboardingProfileId: 'onb_1',
      generatedAt: '2026-09-07T00:00:00.000Z',
    },
  },
};

describe('CareerProfileAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCareerProfileAnalysis).mockResolvedValue(analysis);
    vi.mocked(generateCareerProfileAnalysis).mockResolvedValue(analysis);
  });

  it('shows saved analysis across profile, resume, needs, and jobs tabs', async () => {
    const user = userEvent.setup();
    render(<CareerProfileAnalysisPage />);

    expect(await screen.findAllByRole('heading', { name: /Technical Career Builder/i })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /Resume/i }));
    expect(screen.getByRole('heading', { name: /Technical and IT resume/i })).toBeInTheDocument();
    expect(screen.getByText(/Add proof for system design/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Things needed/i }));
    expect(screen.getByRole('heading', { name: /What to build next/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /System design/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Jobs to apply/i }));
    expect(screen.getByRole('heading', { name: /Software, IT, cloud/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Prepare auto-apply agent/i }));
    expect(screen.getByText(/Job-board submission needs a connected application source/i)).toBeInTheDocument();
  });

  it('can generate analysis when no saved record exists yet', async () => {
    const user = userEvent.setup();
    vi.mocked(getCareerProfileAnalysis).mockResolvedValueOnce(null);

    render(<CareerProfileAnalysisPage />);

    await user.click(await screen.findByRole('button', { name: /Run analysis/i }));

    await waitFor(() => {
      expect(generateCareerProfileAnalysis).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findAllByRole('heading', { name: /Technical Career Builder/i })).toHaveLength(2);
  });
});
