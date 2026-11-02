import { api } from './apiClient';
import type { CareerOnboardingAnswers } from '../components/UserOnboarding';

export type CareerOnboardingProfile = CareerOnboardingAnswers & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

type CareerOnboardingProfileEnvelope = {
  profile: CareerOnboardingProfile | null;
};

export type CareerProfileAnalysisReport = {
  noLlmCalls: boolean;
  privacyBadge: string;
  profileCategory: {
    label: string;
    level: string;
    confidence: number;
    summary: string;
    evidence: string[];
    nextMilestone: string;
  };
  resume: {
    id?: string | null;
    category: string;
    readinessScore: number;
    completenessScore: number;
    bulletQualityScore: number;
    riskScore: number;
    skillCoverageScore: number;
    strengths: string[];
    improvements: string[];
    risks: Array<{ severity: string; item: string; fix: string }>;
    visibleSkills: string[];
  };
  thingsNeeded: {
    headline: string;
    prioritySkills: Array<{ skill: string; why: string; currentSignal: string; action: string; timeline: string }>;
    expertPlan: string[];
    supportNeed?: string;
  };
  jobTargets: {
    recommendedFamily: string;
    recommendedTitles: Array<{
      title: string;
      fitScore: number;
      why: string;
      keywords: string[];
      applicationAngle: string;
      autoAgentApply: {
        status: string;
        nextAction: string;
        requiredBeforeApply: string[];
      };
    }>;
    searchStrategy: {
      preferredWorkStyle?: string;
      keywords: string[];
      batchSize: number;
      reviewAfterApplications: number;
    };
    autoAgentApplyFeature: {
      enabled: boolean;
      status: string;
      details: string;
    };
  };
  source: {
    resumeId?: string | null;
    onboardingProfileId?: string | null;
    generatedAt: string;
  };
};

export type CareerProfileAnalysis = {
  id: string;
  userId: string;
  onboardingProfileId?: string | null;
  resumeId?: string | null;
  profileCategory: string;
  resumeCategory: string;
  recommendedJobFamily: string;
  skillFocus: string;
  analysis: CareerProfileAnalysisReport;
  createdAt: string;
  updatedAt: string;
};

type CareerProfileAnalysisEnvelope = {
  analysis: CareerProfileAnalysis | null;
};

export async function getCareerOnboardingProfile(): Promise<CareerOnboardingProfile | null> {
  const res = await api.get<CareerOnboardingProfileEnvelope>('/career/onboarding-profile');
  return res.profile;
}

export async function saveCareerOnboardingProfile(answers: CareerOnboardingAnswers): Promise<CareerOnboardingProfile> {
  const res = await api.put<CareerOnboardingProfileEnvelope>('/career/onboarding-profile', answers);
  if (!res.profile) {
    throw new Error('Career profile answers were not saved.');
  }
  return res.profile;
}

export async function getCareerProfileAnalysis(): Promise<CareerProfileAnalysis | null> {
  const res = await api.get<CareerProfileAnalysisEnvelope>('/career/profile-analysis');
  return res.analysis;
}

export async function generateCareerProfileAnalysis(payload: { resumeId?: string | null } = {}): Promise<CareerProfileAnalysis> {
  const res = await api.post<CareerProfileAnalysisEnvelope>('/career/profile-analysis', payload);
  if (!res.analysis) {
    throw new Error('Career profile analysis was not saved.');
  }
  return res.analysis;
}
