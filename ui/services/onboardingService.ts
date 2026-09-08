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
