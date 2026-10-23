import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Header from './Header';
import { SubscriptionPlan, UserRole } from '../types';

describe('Header navigation', () => {
  it('makes every user workflow available through mobile navigation', () => {
    const navigate = vi.fn();
    render(<Header currentUser={{ id: 'u', name: 'User', email: 'user@example.com', role: UserRole.USER, plan: SubscriptionPlan.FREE, status: 'Active', createdAt: '', paidAmount: '$0.00' }}
      onLogout={vi.fn()} activeTab="workspace" setActiveTab={navigate} />);
    const menu = screen.getByRole('combobox', { name: 'Navigate workspace' });
    for (const tab of ['cover_letters', 'career_tools', 'jobs_to_apply', 'human_approval', 'account', 'contact']) {
      fireEvent.change(menu, { target: { value: tab } });
      expect(navigate).toHaveBeenLastCalledWith(tab);
    }
  });
});
