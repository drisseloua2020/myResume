import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResumeLibraryPage from './ResumeLibraryPage';
import { getResume, listResumes } from '../services/resumeService';

vi.mock('../services/resumeService', () => ({
  deleteResume: vi.fn(),
  getResume: vi.fn(),
  listResumes: vi.fn(),
}));

describe('ResumeLibraryPage', () => {
  beforeEach(() => {
    vi.mocked(listResumes).mockResolvedValue([
      {
        id: 'res_123',
        templateId: 'classic_pro',
        title: 'Senior Developer Resume',
        createdAt: '2026-05-01T12:00:00Z',
        updatedAt: '2026-05-20T12:00:00Z',
      },
    ]);
    vi.mocked(getResume).mockResolvedValue({
      id: 'res_123',
      templateId: 'classic_pro',
      title: 'Senior Developer Resume',
      createdAt: '2026-05-01T12:00:00Z',
      updatedAt: '2026-05-20T12:00:00Z',
      content: { targetRole: 'Senior Developer' },
    });
  });

  it('loads a selected saved resume into the editor', async () => {
    const user = userEvent.setup();
    const onLoadResume = vi.fn();

    render(<ResumeLibraryPage onLoadResume={onLoadResume} />);

    expect(await screen.findByText('Senior Developer Resume')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /load in editor/i }));

    await waitFor(() => {
      expect(onLoadResume).toHaveBeenCalledWith(expect.objectContaining({
        id: 'res_123',
        content: { targetRole: 'Senior Developer' },
      }));
    });
  });
});
