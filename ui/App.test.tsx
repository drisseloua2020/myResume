import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { generateResumeContent } from './services/geminiService';
import { saveResume, updateResume, saveDraft, getLatestDraft, getLatestResume } from './services/resumeService';
import { SubscriptionPlan, UserRole } from './types';

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

vi.mock('./services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(() => testUser),
    logActivity: vi.fn(),
    refreshMe: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('./services/agentService', () => ({
  agentService: {
    checkForUpdates: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('./services/geminiService', () => ({
  generateResumeContent: vi.fn(),
}));

vi.mock('./services/resumeService', () => ({
  getLatestResume: vi.fn(),
  getLatestDraft: vi.fn(),
  saveDraft: vi.fn(),
  saveResume: vi.fn(),
  updateResume: vi.fn(),
}));

vi.mock('./services/locationService', () => ({
  locationService: {
    getCountries: vi.fn().mockResolvedValue(['United States']),
    getStates: vi.fn().mockResolvedValue(['California']),
    getCities: vi.fn().mockResolvedValue(['San Francisco']),
  },
}));

vi.mock('./services/uploadService', () => ({
  uploadProfilePhoto: vi.fn(),
}));

vi.mock('./services/coverLetterService', () => ({
  generateCoverLetter: vi.fn(),
}));

describe('App import flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLatestResume).mockResolvedValue(null);
    vi.mocked(getLatestDraft).mockResolvedValue(null);
    vi.mocked(saveDraft).mockResolvedValue(undefined);
    vi.mocked(saveResume).mockResolvedValue({ id: 'res_imported' });
    vi.mocked(generateResumeContent).mockResolvedValue({
      json: {
        header: {
          name: 'Alex Resume',
          email: 'alex@example.com',
          phone: '555-0100',
          location: 'Austin, TX',
        },
        summary: 'Backend engineer.',
        skills: {
          core: ['Python', 'FastAPI'],
        },
        experience: [
          {
            role: 'Data Analyst',
            company: 'Insight LLC',
            start: '2021',
            end: '2023',
            highlights: [{ bullet: 'Built dashboards' }],
          },
        ],
        education: [],
      },
    });
  });

  it('creates a new saved resume record when a PDF resume is imported', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(await screen.findByRole('button', { name: /import file/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, new File(['resume'], 'alex-resume.pdf', { type: 'application/pdf' }));
    await screen.findByText('alex-resume.pdf');

    await user.click(screen.getByRole('button', { name: /import to live editor/i }));

    await waitFor(() => {
      expect(saveResume).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(saveResume).mock.calls[0][0];
    expect(payload.templateId).toBe('classic_pro');
    expect(payload.title).toBe('Alex Resume - Data Analyst');
    expect(payload.content.fileData).toBeUndefined();
    expect(payload.content.currentResumeText).toBeUndefined();
    expect(payload.content.experienceItems[0]).toEqual(expect.objectContaining({
      role: 'Data Analyst',
      company: 'Insight LLC',
      dates: '2021 - 2023',
    }));
    expect(payload.content.skillItems[0]).toEqual(expect.objectContaining({
      category: 'Core',
      items: 'Python, FastAPI',
    }));

    await waitFor(() => {
      expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
        templateId: 'classic_pro',
        content: expect.objectContaining({
          templateId: 'classic_pro',
          experienceItems: expect.any(Array),
        }),
      }));
    });
  });

  it('maps flexible parsed resume JSON into live editor fields', async () => {
    const user = userEvent.setup();
    vi.mocked(generateResumeContent).mockResolvedValueOnce({
      json: {
        RESUME_JSON: {
          header: {
            full_name: 'Jordan Candidate',
            title: 'Software Architect',
            email: 'jordan@example.com',
            phone: '555-555-0100',
            location: 'Seattle, WA 98101',
          },
          professional_summary: 'Architect focused on AI-enabled delivery.',
          technical_skills: {
            core: 'Cloud Architecture | AI Engineering | Python',
          },
          work_experience: [
            {
              jobTitle: 'Software Architect',
              employer: 'Slalom',
              date_range: 'Jan 2022 - Present',
              responsibilities: [
                'Led AI accelerated engineering assessments.',
                'Mapped modernization roadmaps for enterprise teams.',
              ],
            },
          ],
          education: [
            {
              institution: 'State University',
              qualification: 'BS Computer Science',
              years: '2012 - 2016',
            },
          ],
        },
      },
    });

    const { container } = render(<App />);

    await user.click(await screen.findByRole('button', { name: /import file/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, new File(['resume'], 'jordan-resume.pdf', { type: 'application/pdf' }));
    await screen.findByText('jordan-resume.pdf');

    await user.click(screen.getByRole('button', { name: /import to live editor/i }));

    await waitFor(() => {
      expect(saveResume).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(saveResume).mock.calls[0][0];
    expect(payload.title).toBe('Jordan Candidate - Software Architect');
    expect(payload.content.targetRole).toBe('Software Architect');
    expect(payload.content.personalDetails).toEqual(expect.objectContaining({
      firstName: 'Jordan',
      lastName: 'Candidate',
      email: 'jordan@example.com',
      phone: '555-555-0100',
      city: 'Seattle',
      state: 'WA',
      postalCode: '98101',
      summary: 'Architect focused on AI-enabled delivery.',
    }));
    expect(payload.content.experienceItems[0]).toEqual(expect.objectContaining({
      role: 'Software Architect',
      company: 'Slalom',
      dates: 'Jan 2022 - Present',
      description: '- Led AI accelerated engineering assessments.\n- Mapped modernization roadmaps for enterprise teams.',
    }));
    expect(payload.content.educationItems[0]).toEqual(expect.objectContaining({
      school: 'State University',
      degree: 'BS Computer Science',
      dates: '2012 - 2016',
    }));
    expect(payload.content.skillItems[0]).toEqual(expect.objectContaining({
      category: 'Core',
      items: 'Cloud Architecture, AI Engineering, Python',
    }));
  });

  it('starts a fresh template flow without overwriting the loaded resume', async () => {
    const user = userEvent.setup();
    vi.mocked(getLatestResume).mockResolvedValue({
      id: 'res_existing',
      templateId: 'modern_tech',
      title: 'Existing Resume',
      content: {
        role: UserRole.USER,
        plan: SubscriptionPlan.FREE,
        templateId: 'modern_tech',
        targetRole: 'Software Architect',
        preferences: {
          pages: '1-page',
          tone: 'modern',
          region: 'US',
          photo: false,
        },
        personalDetails: {
          firstName: 'Alex',
          lastName: 'Resume',
          email: 'alex@example.com',
          phone: '555-0100',
          address: '1 Main St',
          city: 'Austin',
          state: 'TX',
          country: 'United States',
          postalCode: '78701',
          summary: 'Software architect.',
        },
        experienceItems: [
          {
            id: 'exp_1',
            role: 'Software Architect',
            company: 'Tech Co',
            dates: '2021 - Present',
            description: 'Led platform architecture.',
          },
        ],
        educationItems: [
          {
            id: 'edu_1',
            school: 'State University',
            degree: 'BS Computer Science',
            dates: '2012 - 2016',
          },
        ],
        skillItems: [
          {
            id: 'skill_1',
            category: 'Core',
            items: 'Architecture, AI',
          },
        ],
      },
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-02T00:00:00Z',
    });

    render(<App />);

    await screen.findByText(/Loaded resume: Existing Resume/i);

    await user.click(screen.getAllByRole('button', { name: /new resume/i })[0]);
    await user.click(screen.getByRole('button', { name: /choose template/i }));

    expect(await screen.findByRole('heading', { name: /choose a template/i })).toBeInTheDocument();
    expect(screen.queryByText(/Loaded resume: Existing Resume/i)).not.toBeInTheDocument();
    expect(saveResume).not.toHaveBeenCalled();
    expect(updateResume).not.toHaveBeenCalled();
  });
});
