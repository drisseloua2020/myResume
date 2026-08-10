import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CoverLettersPage from './CoverLettersPage';
import {
  deleteCoverLetter,
  downloadCoverLetterPdf,
  generateCoverLetter,
  getCoverLetter,
  listCoverLetters,
} from '../services/coverLetterService';
import { getLatestDraft } from '../services/resumeService';

vi.mock('../services/coverLetterService', () => ({
  deleteCoverLetter: vi.fn(),
  downloadCoverLetterPdf: vi.fn(),
  generateCoverLetter: vi.fn(),
  getCoverLetter: vi.fn(),
  listCoverLetters: vi.fn(),
}));

vi.mock('../services/resumeService', () => ({
  getLatestDraft: vi.fn(),
}));

const savedLetter = {
  id: 'cl_1',
  templateId: 'classic_pro',
  title: 'Platform Engineer',
  jobDescription: 'Platform Engineer job description with enough detail to generate a cover letter.',
  jobUrl: 'https://jobs.example.com/platform-engineer',
  createdAt: '2026-05-25T00:00:00Z',
  content: {
    coverLetterFull: 'Dear hiring team...',
    coverLetterShort: 'Short letter',
    coldEmail: 'Hello',
    resumeReference: 'Jordan Candidate - Platform Engineer (Classic Professional)',
  },
};

describe('CoverLettersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLatestDraft).mockResolvedValue({
      id: 'draft_1',
      templateId: 'classic_pro',
      content: {
        targetRole: 'Platform Engineer',
        personalDetails: {
          firstName: 'Jordan',
          lastName: 'Candidate',
        },
      },
      createdAt: '2026-05-25T00:00:00Z',
      updatedAt: '2026-05-25T00:00:00Z',
    });
    vi.mocked(listCoverLetters).mockResolvedValue([savedLetter]);
    vi.mocked(getCoverLetter).mockResolvedValue(savedLetter);
    vi.mocked(generateCoverLetter).mockResolvedValue(savedLetter);
    vi.mocked(deleteCoverLetter).mockResolvedValue(undefined);
    vi.mocked(downloadCoverLetterPdf).mockResolvedValue(undefined);
  });

  it('generates a saved cover letter from a job URL', async () => {
    const user = userEvent.setup();
    vi.mocked(listCoverLetters).mockResolvedValue([]);

    render(<CoverLettersPage />);

    expect(await screen.findByText(/latest resume automatically linked/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/job posting url/i), 'https://jobs.example.com/platform-engineer');
    await user.click(screen.getByRole('button', { name: /generate linked letter/i }));

    await waitFor(() => {
      expect(generateCoverLetter).toHaveBeenCalledWith(expect.objectContaining({
        jobUrl: 'https://jobs.example.com/platform-engineer',
        jobDescription: undefined,
        resumeJson: expect.objectContaining({ targetRole: 'Platform Engineer' }),
      }));
    });
    expect(await screen.findByText(/Created "Platform Engineer" using Jordan Candidate/i)).toBeInTheDocument();
  });

  it('lists saved letters in a table and opens a selected letter in the viewer tab', async () => {
    const user = userEvent.setup();

    render(<CoverLettersPage />);

    expect(await screen.findByText('Platform Engineer')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /job description/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /used resume/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open job url/i })).toHaveAttribute('href', 'https://jobs.example.com/platform-engineer');
    expect(screen.getAllByText('Jordan Candidate - Platform Engineer (Classic Professional)').length).toBeGreaterThan(1);

    await user.click(screen.getByRole('button', { name: /read cover letter/i }));
    expect(await screen.findByText('Dear hiring team...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /viewer/i })).toHaveClass('bg-slate-900');

    await user.click(screen.getAllByRole('button', { name: /download pdf/i })[0]);
    expect(downloadCoverLetterPdf).toHaveBeenCalledWith('cl_1', 'Platform Engineer');
  });
});
