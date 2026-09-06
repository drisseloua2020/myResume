import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Header from './Header';
import { SubscriptionPlan, UserRole } from '../types';

const currentUser = {
  id: 'usr_1',
  name: 'Resume User',
  email: 'resume@example.com',
  role: UserRole.USER,
  plan: SubscriptionPlan.FREE,
  status: 'Active',
  createdAt: '2026-05-25T00:00:00Z',
  paidAmount: '$0.00',
};

describe('Header feature flags', () => {
  it('keeps the existing workspace navigation when Career OS is disabled', () => {
    render(
      <Header
        currentUser={currentUser}
        onLogout={vi.fn()}
        activeTab="workspace"
        setActiveTab={vi.fn()}
        featureFlags={{ careerOSExperience: false, careerOSNavigation: false }}
      />
    );

    expect(screen.getByRole('button', { name: /career workspace/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^career os$/i })).not.toBeInTheDocument();
  });

  it('does not show Career OS navigation when only the child flag is enabled', () => {
    render(
      <Header
        currentUser={currentUser}
        onLogout={vi.fn()}
        activeTab="workspace"
        setActiveTab={vi.fn()}
        featureFlags={{ careerOSExperience: false, careerOSNavigation: true }}
      />
    );

    expect(screen.getByRole('button', { name: /career workspace/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^career os$/i })).not.toBeInTheDocument();
  });

  it('can show Career OS navigation while keeping the builder tab target stable', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();

    render(
      <Header
        currentUser={currentUser}
        onLogout={vi.fn()}
        activeTab="workspace"
        setActiveTab={setActiveTab}
        featureFlags={{ careerOSExperience: true, careerOSNavigation: true }}
      />
    );

    await user.click(screen.getByRole('button', { name: /^career os$/i }));

    expect(setActiveTab).toHaveBeenCalledWith('workspace');
    expect(screen.queryByRole('button', { name: /career workspace/i })).not.toBeInTheDocument();
  });
});
