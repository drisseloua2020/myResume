import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import UserOnboarding, { careerOnboardingQuestions } from './UserOnboarding';
import { SubscriptionPlan, UserRole } from '../types';

const testUser = {
  id: 'usr_1',
  name: 'Resume User',
  email: 'resume@example.com',
  role: UserRole.USER,
  plan: SubscriptionPlan.FREE,
  status: 'Active',
  createdAt: '2026-05-25T00:00:00Z',
  paidAmount: '$0.00',
};

describe('UserOnboarding', () => {
  it('renders Samara and starts with one career profile question', () => {
    render(<UserOnboarding user={testUser} onComplete={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByRole('img', { name: /samara/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /shape your profile/i })).toBeInTheDocument();
    expect(screen.getByText(/Question 1 of/i)).toBeInTheDocument();
    expect(screen.getByText(careerOnboardingQuestions[0].prompt)).toBeInTheDocument();
    expect(screen.queryByText(careerOnboardingQuestions[1].prompt)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('advances through questions one at a time', async () => {
    const user = userEvent.setup();

    render(<UserOnboarding user={testUser} onComplete={vi.fn()} onSkip={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Early career professional/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText(careerOnboardingQuestions[1].prompt)).toBeInTheDocument();
    expect(screen.queryByText(careerOnboardingQuestions[0].prompt)).not.toBeInTheDocument();
  });

  it('submits the completed career profile answers', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    render(<UserOnboarding user={testUser} onComplete={onComplete} onSkip={vi.fn()} />);

    const selections = [
      'Experienced specialist',
      'Leadership and coaching',
      'Customer success',
      'Changing careers',
      'Get ready to apply',
      'Move into management',
      'Remote-first roles',
      'Improve resume wording',
    ];

    for (const [index, selection] of selections.entries()) {
      await user.click(screen.getByRole('button', { name: new RegExp(selection, 'i') }));
      await user.click(screen.getByRole('button', {
        name: index === selections.length - 1 ? /^complete profile$/i : /^next$/i,
      }));
    }

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      currentExperience: 'Experienced specialist',
      strengths: 'Leadership and coaching',
      targetRoles: 'Customer success',
      marketStatus: 'Changing careers',
      shortTermGoal: 'Get ready to apply',
      futureGoal: 'Move into management',
      jobPreferences: 'Remote-first roles',
      supportNeeds: 'Improve resume wording',
    }));
  });

  it('lets the user skip onboarding and continue to the editor', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();

    render(<UserOnboarding user={testUser} onComplete={vi.fn()} onSkip={onSkip} />);

    await user.click(screen.getByRole('button', { name: /skip for now/i }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
