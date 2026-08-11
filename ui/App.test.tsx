import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import {
  deleteResume,
  getLatestDraft,
  getLatestResume,
  getResume,
  listResumes,
  parseResumeUpload,
  saveDraft,
  saveResume,
  updateResume,
} from './services/resumeService';
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

vi.mock('./services/resumeService', () => ({
  deleteResume: vi.fn(),
  getResume: vi.fn(),
  listResumes: vi.fn(),
  getLatestResume: vi.fn(),
  getLatestDraft: vi.fn(),
  parseResumeUpload: vi.fn(),
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

const parsedResumeResult = (resume: Record<string, unknown>) => ({
  resume,
  warnings: [],
  confidence: {},
  document: {},
  atsReport: {},
});

describe('App import flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLatestResume).mockResolvedValue(null);
    vi.mocked(getLatestDraft).mockResolvedValue(null);
    vi.mocked(listResumes).mockResolvedValue([]);
    vi.mocked(getResume).mockRejectedValue(new Error('Unexpected resume lookup'));
    vi.mocked(deleteResume).mockResolvedValue(undefined);
    vi.mocked(saveDraft).mockResolvedValue(undefined);
    vi.mocked(saveResume).mockResolvedValue({ id: 'res_imported' });
    vi.mocked(parseResumeUpload).mockResolvedValue(parsedResumeResult({
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
    }));
  });

  it('creates a new saved resume record when a PDF resume is imported', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(await screen.findByRole('button', { name: /import file/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, new File(['resume'], 'alex-resume.pdf', { type: 'application/pdf' }));
    await screen.findByText('alex-resume.pdf');

    await user.click(screen.getByRole('button', { name: /import to editor/i }));

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
    vi.mocked(parseResumeUpload).mockResolvedValueOnce(parsedResumeResult({
          header: {
            full_name: 'Jordan Candidate',
            title: 'Software Architect',
            email: 'jordan@example.com',
            phone: '555-555-0100',
            location: 'Seattle, WA 98101',
            links: [{ label: 'LinkedIn', url: 'linkedin.com/in/jordan' }],
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
              location: 'Richardson, TX',
              years: '2012 - 2016',
            },
          ],
          projects: [
            {
              name: 'Resume Scanner',
              link: 'https://example.com/project',
              description: 'Classified imported resume sections.',
              bullets: ['Moved certifications into grouped editor skills.'],
            },
          ],
          certifications: ['AWS Certified Solutions Architect'],
    }));

    const { container } = render(<App />);

    await user.click(await screen.findByRole('button', { name: /import file/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, new File(['resume'], 'jordan-resume.pdf', { type: 'application/pdf' }));
    await screen.findByText('jordan-resume.pdf');

    await user.click(screen.getByRole('button', { name: /import to editor/i }));

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
      links: 'LinkedIn: linkedin.com/in/jordan',
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
      location: 'Richardson, TX',
      dates: '2012 - 2016',
    }));
    expect(payload.content.skillItems[0]).toEqual(expect.objectContaining({
      category: 'Core',
      items: 'Cloud Architecture, AI Engineering, Python',
    }));
    expect(payload.content.additionalSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Projects',
        items: 'Resume Scanner: Classified imported resume sections.\nMoved certifications into grouped editor skills.\nhttps://example.com/project',
      }),
      expect.objectContaining({
        title: 'Certifications',
        items: 'AWS Certified Solutions Architect',
      }),
    ]));
  });

  it('maps intelligent scan labels into the correct editor fields', async () => {
    const user = userEvent.setup();
    vi.mocked(parseResumeUpload).mockResolvedValueOnce(parsedResumeResult({
          'Candidate Info': {
            'Full Name': 'Avery Stone',
            'Professional Title': 'Registered Nurse',
            'Contact Details': {
              'Email Address': 'avery@example.com',
              'Cell Phone': '(555) 222-0100',
            },
            'Current Location': 'Tampa, FL 33602',
          },
          'Professional Summary': 'Clinical professional focused on patient-centered care.',
          'Work Experience': {
            'Job Title': 'Registered Nurse',
            'Employer Name': 'BrightWorks Health',
            'Date Range': 'Mar 2020 - Present',
            Accomplishments: [
              { Text: 'Coordinated care plans across a 24-bed unit.' },
              { Text: 'Trained new staff on EHR documentation practices.' },
            ],
          },
          'Education And Training': {
            'Institution Name': 'University of South Florida',
            Credential: 'BS Nursing',
            Location: 'Tampa, FL',
            'Date Range': '2015 - 2019',
          },
          'Technical Skills': [
            {
              Category: 'Clinical',
              Items: ['Patient Care', 'EHR Documentation'],
            },
          ],
    }));

    const { container } = render(<App />);

    await user.click(await screen.findByRole('button', { name: /import file/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, new File(['resume'], 'avery-resume.pdf', { type: 'application/pdf' }));
    await screen.findByText('avery-resume.pdf');

    await user.click(screen.getByRole('button', { name: /import to editor/i }));

    await waitFor(() => {
      expect(saveResume).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(saveResume).mock.calls[0][0];
    expect(payload.title).toBe('Avery Stone - Registered Nurse');
    expect(payload.content.personalDetails).toEqual(expect.objectContaining({
      firstName: 'Avery',
      lastName: 'Stone',
      email: 'avery@example.com',
      phone: '(555) 222-0100',
      city: 'Tampa',
      state: 'FL',
      postalCode: '33602',
      summary: 'Clinical professional focused on patient-centered care.',
    }));
    expect(payload.content.experienceItems[0]).toEqual(expect.objectContaining({
      role: 'Registered Nurse',
      company: 'BrightWorks Health',
      dates: 'Mar 2020 - Present',
      description: '- Coordinated care plans across a 24-bed unit.\n- Trained new staff on EHR documentation practices.',
    }));
    expect(payload.content.educationItems[0]).toEqual(expect.objectContaining({
      school: 'University of South Florida',
      degree: 'BS Nursing',
      location: 'Tampa, FL',
      dates: '2015 - 2019',
    }));
    expect(payload.content.skillItems[0]).toEqual(expect.objectContaining({
      category: 'Clinical',
      items: 'Patient Care, EHR Documentation',
    }));
  });

  it('maps labeled skill lines into separate skills categories', async () => {
    const user = userEvent.setup();
    vi.mocked(parseResumeUpload).mockResolvedValueOnce(parsedResumeResult({
          header: {
            name: 'Taylor Skills',
            title: 'Solutions Architect',
            email: 'taylor@example.com',
          },
          skills: [
            'Architecture: Distributed Systems',
            'Microservices',
            'AI & Security: Agentic AI',
            'OpenAI APIs',
            'Cloud & Engineering: AWS',
            'Azure',
            'Boot',
            'AngularJS',
          ],
          experience: [],
          education: [],
    }));

    const { container } = render(<App />);

    await user.click(await screen.findByRole('button', { name: /import file/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, new File(['resume'], 'taylor-skills.pdf', { type: 'application/pdf' }));
    await screen.findByText('taylor-skills.pdf');

    await user.click(screen.getByRole('button', { name: /import to editor/i }));

    await waitFor(() => {
      expect(saveResume).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(saveResume).mock.calls[0][0];
    expect(payload.content.skillItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'Architecture',
        items: 'Distributed Systems, Microservices',
      }),
      expect.objectContaining({
        category: 'AI & Security',
        items: 'Agentic AI, OpenAI APIs',
      }),
      expect.objectContaining({
        category: 'Cloud & Engineering',
        items: 'AWS, Azure',
      }),
      expect.objectContaining({
        category: 'Boot',
        items: 'AngularJS',
      }),
    ]));
  });

  it('moves skill-looking education lines into skills while keeping only schools in education', async () => {
    const user = userEvent.setup();
    vi.mocked(parseResumeUpload).mockResolvedValueOnce(parsedResumeResult({
          header: {
            name: 'Taylor Mixed',
            title: 'Solutions Architect',
            email: 'taylor@example.com',
          },
          education: [
            'Architecture: Distributed Systems',
            'Microservices',
            'Cloud & Engineering: AWS',
            'Azure',
            {
              institution: 'State University',
              qualification: 'BS Computer Science',
              location: 'Richardson, TX',
              years: '2012 - 2016',
            },
          ],
          skills: [],
          experience: [],
    }));

    const { container } = render(<App />);

    await user.click(await screen.findByRole('button', { name: /import file/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, new File(['resume'], 'taylor-mixed.pdf', { type: 'application/pdf' }));
    await screen.findByText('taylor-mixed.pdf');

    await user.click(screen.getByRole('button', { name: /import to editor/i }));

    await waitFor(() => {
      expect(saveResume).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(saveResume).mock.calls[0][0];
    expect(payload.content.educationItems).toEqual([
      expect.objectContaining({
        school: 'State University',
        degree: 'BS Computer Science',
        location: 'Richardson, TX',
        dates: '2012 - 2016',
      }),
    ]);
    expect(payload.content.skillItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'Architecture',
        items: 'Distributed Systems, Microservices',
      }),
      expect.objectContaining({
        category: 'Cloud & Engineering',
        items: 'AWS, Azure',
      }),
    ]));
  });

  it('folds undated imported job fragments into the previous dated job description', async () => {
    const user = userEvent.setup();
    vi.mocked(parseResumeUpload).mockResolvedValueOnce(parsedResumeResult({
          header: {
            name: 'Riley Defender',
            title: 'Security Analyst',
            email: 'riley@example.com',
          },
          experience: [
            {
              role: 'Security Analyst',
              company: 'Acme Security',
              start: '2021',
              end: 'Present',
              highlights: [{ bullet: 'Improved alert triage coverage.' }],
            },
            {
              title: 'blue-team',
              date: '',
            },
          ],
          education: [],
          skills: [],
    }));

    const { container } = render(<App />);

    await user.click(await screen.findByRole('button', { name: /import file/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, new File(['resume'], 'riley-resume.pdf', { type: 'application/pdf' }));
    await screen.findByText('riley-resume.pdf');

    await user.click(screen.getByRole('button', { name: /import to editor/i }));

    await waitFor(() => {
      expect(saveResume).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(saveResume).mock.calls[0][0];
    expect(payload.content.experienceItems).toHaveLength(1);
    expect(payload.content.experienceItems[0]).toEqual(expect.objectContaining({
      role: 'Security Analyst',
      company: 'Acme Security',
      dates: '2021 - Present',
      description: '- Improved alert triage coverage.\n- blue-team',
    }));
    expect(payload.content.experienceItems.some((exp: any) => exp.role === 'blue-team')).toBe(false);
  });

  it('keeps full street addresses and nested contact details in the right imported fields', async () => {
    const user = userEvent.setup();
    vi.mocked(parseResumeUpload).mockResolvedValueOnce(parsedResumeResult({
          personalDetails: {
            firstName: 'Sam',
            lastName: 'Structured',
            title: 'Product Engineer',
            contact: {
              email: 'sam@example.com',
              mobile: '(555) 123-4567',
            },
            address: '123 Main St, Austin, TX 78701',
          },
          summary: 'Engineer focused on product delivery.',
          skills: ['React', 'TypeScript'],
          experience: [
            {
              position: 'Product Engineer',
              organization: 'Acme Products',
              period: '2022 - Present',
              achievements: ['Shipped customer-facing workflow improvements.'],
            },
          ],
          education: [],
    }));

    const { container } = render(<App />);

    await user.click(await screen.findByRole('button', { name: /import file/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, new File(['resume'], 'sam-resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }));
    await screen.findByText('sam-resume.docx');

    await user.click(screen.getByRole('button', { name: /import to editor/i }));

    await waitFor(() => {
      expect(saveResume).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(saveResume).mock.calls[0][0];
    expect(payload.title).toBe('Sam Structured - Product Engineer');
    expect(payload.content.personalDetails).toEqual(expect.objectContaining({
      firstName: 'Sam',
      lastName: 'Structured',
      email: 'sam@example.com',
      phone: '(555) 123-4567',
      address: '123 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      summary: 'Engineer focused on product delivery.',
    }));
    expect(payload.content.personalDetails.city).not.toBe('123 Main St');
    expect(payload.content.experienceItems[0]).toEqual(expect.objectContaining({
      role: 'Product Engineer',
      company: 'Acme Products',
      dates: '2022 - Present',
      description: '- Shipped customer-facing workflow improvements.',
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

    await screen.findByDisplayValue('Tech Co');

    await user.click(screen.getAllByRole('button', { name: /new resume/i })[0]);
    await user.click(screen.getByRole('button', { name: /choose template/i }));

    expect(await screen.findByRole('heading', { name: /choose a template/i })).toBeInTheDocument();
    expect(saveResume).not.toHaveBeenCalled();
    expect(updateResume).not.toHaveBeenCalled();
  });

  it('resets the editor when the currently loaded resume is deleted from the library', async () => {
    const user = userEvent.setup();
    const loadedResume = {
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
    };

    vi.mocked(getLatestResume).mockResolvedValue(loadedResume);
    vi.mocked(listResumes).mockResolvedValue([{
      id: loadedResume.id,
      templateId: loadedResume.templateId,
      title: loadedResume.title,
      createdAt: loadedResume.createdAt,
      updatedAt: loadedResume.updatedAt,
    }]);

    render(<App />);

    await screen.findByDisplayValue('Tech Co');

    await user.click(screen.getByRole('button', { name: /view resume/i }));
    expect(await screen.findByText('Existing Resume')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /yes/i }));

    await waitFor(() => {
      expect(deleteResume).toHaveBeenCalledWith('res_existing');
    });

    await user.click(screen.getByRole('button', { name: /^editor$/i }));

    await waitFor(() => {
      expect(screen.queryByDisplayValue('Tech Co')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('Software Architect')).not.toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('First Name')).toHaveValue('');
    expect(screen.getByPlaceholderText('email@example.com')).toHaveValue('');
    expect(await screen.findAllByTestId('empty-live-preview')).not.toHaveLength(0);
  });

  it('keeps the editor and preview empty when there are no saved resumes', async () => {
    vi.mocked(getLatestResume).mockResolvedValue(null);
    vi.mocked(getLatestDraft).mockResolvedValue({
      templateId: 'classic_pro',
      content: {
        targetRole: 'Stale Architect',
        personalDetails: {
          firstName: 'Stale',
          lastName: 'Draft',
          email: 'stale@example.com',
          phone: '',
          address: '',
          city: '',
          state: '',
          country: '',
          postalCode: '',
          summary: '',
        },
        experienceItems: [
          {
            id: 'exp_stale',
            role: 'Stale Architect',
            company: 'Stale Co',
            dates: '2020 - 2021',
            description: 'Old draft content.',
          },
        ],
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(getLatestResume).toHaveBeenCalled();
    });

    expect(getLatestDraft).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('Stale Co')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Stale Architect')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('First Name')).toHaveValue('');
    expect(screen.getByPlaceholderText('email@example.com')).toHaveValue('');
    expect(await screen.findAllByTestId('empty-live-preview')).not.toHaveLength(0);
  });
});
