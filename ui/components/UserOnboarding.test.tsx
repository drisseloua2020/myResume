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
  it('renders the assistant intake questions for career profile and job matching', () => {
    render(<UserOnboarding user={testUser} onComplete={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /user onboarding/i })).toBeInTheDocument();
    expect(screen.getByText(/AI assistant assessment/i)).toBeInTheDocument();

    careerOnboardingQuestions.forEach((question) => {
      expect(screen.getByText(question.prompt)).toBeInTheDocument();
    });
  });

  it('submits the completed career profile answers', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    render(<UserOnboarding user={testUser} onComplete={onComplete} onSkip={vi.fn()} />);

    await user.type(
      screen.getByPlaceholderText(/Customer support lead/i),
      'Senior support lead in SaaS operations',
    );
    await user.type(
      screen.getByPlaceholderText(/Team leadership/i),
      'Team leadership, CRM operations, Salesforce',
    );
    await user.type(
      screen.getByPlaceholderText(/Customer Success Manager/i),
      'Customer Success Manager',
    );
    await user.selectOptions(screen.getByRole('combobox'), 'Changing careers');
    await user.type(
      screen.getByPlaceholderText(/Land interviews/i),
      'Land three interviews this quarter',
    );
    await user.type(
      screen.getByPlaceholderText(/Move into people management/i),
      'Move into people management',
    );
    await user.type(
      screen.getByPlaceholderText(/Remote or hybrid/i),
      'Remote, salary above $95k',
    );
    await user.type(
      screen.getByPlaceholderText(/Clarify my target role/i),
      'Clarify my target role first',
    );

    await user.click(screen.getByRole('button', { name: /complete onboarding/i }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      currentExperience: 'Senior support lead in SaaS operations',
      strengths: 'Team leadership, CRM operations, Salesforce',
      targetRoles: 'Customer Success Manager',
      marketStatus: 'Changing careers',
      shortTermGoal: 'Land three interviews this quarter',
      futureGoal: 'Move into people management',
      jobPreferences: 'Remote, salary above $95k',
      supportNeeds: 'Clarify my target role first',
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
