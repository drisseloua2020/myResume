import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuthScreen from './AuthScreen';
vi.mock('../services/apiClient', () => ({ API_URL: 'http://localhost:3000', api: { get: vi.fn().mockResolvedValue({ providers: { google: false } }) } }));

describe('authentication dialogs', () => {
  it('opens one login form, supports registration, and closes with Escape', async () => {
    render(<AuthScreen onLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getAllByPlaceholderText('name@example.com')).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole('button', { name: /continue with google/i })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Complete Registration' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
