import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConfirmNewResumeModal from './ConfirmNewResumeModal';

describe('ConfirmNewResumeModal', () => {
  it('confirms when the user accepts starting a new resume', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(<ConfirmNewResumeModal onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText(/erase the current data/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /yes/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels when the user chooses no', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(<ConfirmNewResumeModal onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /no/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
