import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProviderDemoPage from './ProviderDemoPage';
import { executeDemoOperation, getDemoOperations, getDemoState, getProviderCapabilities } from '../services/providerService';
import { listCareerJobs } from '../services/careerService';
vi.mock('../services/providerService', () => ({ executeDemoOperation: vi.fn(), getDemoOperations: vi.fn(), getDemoState: vi.fn(), getProviderCapabilities: vi.fn() }));
vi.mock('../services/careerService', () => ({ listCareerJobs: vi.fn() }));

describe('Provider demo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProviderCapabilities).mockResolvedValue({ demoEnabled: true, mode: 'mock' });
    vi.mocked(getDemoOperations).mockResolvedValue({ operations: [], total: 0 });
    vi.mocked(getDemoState).mockResolvedValue({ profiles: {}, billing: { plan: 'free', subscriptionStatus: 'inactive' } });
    vi.mocked(listCareerJobs).mockResolvedValue({ jobs: [] });
    vi.mocked(executeDemoOperation).mockResolvedValue({ replayed: false, operation: { id: 'mock-1', provider: 'jobs', action: 'discover', subjectId: null, status: 'succeeded', mode: 'mock', createdAt: '2026-10-23T00:00:00Z', result: { jobs: [{ id: 'sample', title: '[Demo] Engineer', company: 'Example', location: 'Remote', jobDescription: 'Synthetic job' }] } } });
  });
  it('shows labeled discovery results and explicit save', async () => {
    const user = userEvent.setup();
    render(<ProviderDemoPage />);
    await user.click(await screen.findByRole('button', { name: 'Discover sample jobs' }));
    expect(await screen.findByText('[Demo] Engineer')).toBeInTheDocument();
    expect(screen.getByText(/No real charges/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save sample job' }));
    expect(executeDemoOperation).toHaveBeenLastCalledWith(expect.objectContaining({ provider: 'jobs', action: 'save', subjectId: 'sample' }));
  });
  it('reuses the idempotency key after a lost network response', async () => {
    const user = userEvent.setup();
    vi.mocked(executeDemoOperation).mockRejectedValueOnce(new Error('Network interrupted'));
    render(<ProviderDemoPage />);
    await user.click(await screen.findByRole('button', { name: 'Discover sample jobs' }));
    expect(await screen.findByText('Network interrupted')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discover sample jobs' }));
    await waitFor(() => expect(executeDemoOperation).toHaveBeenCalledTimes(2));
    expect(vi.mocked(executeDemoOperation).mock.calls[0][0].idempotencyKey).toBe(vi.mocked(executeDemoOperation).mock.calls[1][0].idempotencyKey);
  });
  it('hides mock controls when disabled', async () => {
    vi.mocked(getProviderCapabilities).mockResolvedValue({ demoEnabled: false, mode: 'disabled' });
    render(<ProviderDemoPage />);
    expect(await screen.findByText('Mock providers are disabled in this environment.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Discover sample jobs' })).not.toBeInTheDocument();
    expect(executeDemoOperation).not.toHaveBeenCalled();
  });
});
