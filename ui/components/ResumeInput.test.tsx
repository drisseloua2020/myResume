import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResumeInput from './ResumeInput';
import { downloadResumeFile } from '../services/exportService';
import { saveResume } from '../services/resumeService';
import { generateCoverLetter } from '../services/coverLetterService';
import { uploadProfilePhoto } from '../services/uploadService';
import { SubscriptionPlan, UserRole } from '../types';

vi.mock('../services/exportService', () => ({ downloadResumeFile: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../services/locationService', () => ({
  locationService: {
    getCountries: vi.fn().mockResolvedValue(['United States']),
    getStates: vi.fn().mockResolvedValue(['California']),
    getCities: vi.fn().mockResolvedValue(['San Francisco']),
  },
}));

vi.mock('../services/resumeService', () => ({
  saveResume: vi.fn(),
  updateResume: vi.fn(),
}));

vi.mock('../services/uploadService', () => ({
  uploadProfilePhoto: vi.fn(),
}));

vi.mock('../services/coverLetterService', () => ({
  generateCoverLetter: vi.fn(),
}));

describe('ResumeInput', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(saveResume).mockResolvedValue({ id: 'res_saved' });
    vi.mocked(uploadProfilePhoto).mockResolvedValue({
      url: '/uploads/profile-photo/profile-abc123.png',
      filename: 'profile-abc123.png',
      contentType: 'image/png',
      size: 128,
    });
    vi.mocked(generateCoverLetter).mockResolvedValue({
      id: 'cl_1',
      templateId: 'classic_pro',
      title: 'Senior Developer Cover Letter',
      jobDescription: 'Senior Developer role building reliable products for customers.',
      jobUrl: 'https://jobs.example.com/senior-developer',
      createdAt: '2026-05-25T00:00:00Z',
      content: {
        coverLetterFull: 'Dear team...',
        coverLetterShort: 'Short letter',
        coldEmail: 'Hello',
      },
    });
  });

  it('ignores a delayed parent echo of an older editor draft', async () => {
    const onWorkspaceChange = vi.fn();
    const props = { onImport: vi.fn(), onTemplateChange: vi.fn(), isLoading: false,
      role: UserRole.USER, userPlan: SubscriptionPlan.FREE, selectedTemplateId: 'classic_pro',
      user: { id: 'usr_echo', name: 'Echo User', email: 'echo@example.com', role: UserRole.USER,
        plan: SubscriptionPlan.FREE, status: 'Active' as const, createdAt: '', paidAmount: '$0.00' },
      onWorkspaceChange, prefilledData: { targetRole: 'Original' } };
    const { rerender } = render(<ResumeInput {...props} />);
    const target = screen.getByPlaceholderText('e.g. Senior Product Designer');
    fireEvent.change(target, { target: { value: 'First edit' } });
    const olderDraft = onWorkspaceChange.mock.calls.at(-1)?.[0];
    fireEvent.change(target, { target: { value: 'Latest edit' } });
    rerender(<ResumeInput {...props} prefilledData={olderDraft} />);
    expect(target).toHaveValue('Latest edit');
  });

  it('restores and persists the include-photo status from a loaded resume record', async () => {
    const user = userEvent.setup();

    render(
      <ResumeInput
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
        prefilledData={{
          targetRole: 'Senior Developer',
          profileImageUrl: '/uploads/profile-photo/profile-abc123.png',
          profileImageName: 'profile-abc123.png',
          preferences: {
            pages: '1-page',
            tone: 'modern',
            region: 'US',
            photo: true,
          },
          personalDetails: {
            firstName: 'Resume',
            lastName: 'User',
            email: 'resume@example.com',
            phone: '555-0100',
            address: '100 Main St',
            city: 'San Francisco',
            state: 'California',
            country: 'United States',
            postalCode: '94105',
            summary: 'Experienced developer.',
          },
          experienceItems: [
            { id: 'exp_1', role: 'Senior Developer', company: 'Acme', dates: '2020 - Present', description: 'Built products.' },
          ],
          educationItems: [
            { id: 'edu_1', degree: 'BS Computer Science', school: 'State University', dates: '2016 - 2020' },
          ],
          skillItems: [
            { id: 'skill_1', category: 'Technical', items: 'React, Python' },
          ],
        }}
      />
    );

    const includePhoto = await screen.findByLabelText(/include photo/i);
    await waitFor(() => expect(includePhoto).toBeChecked());

    await user.click(screen.getByRole('button', { name: /^save resume$/i }));

    await waitFor(() => {
      expect(saveResume).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.objectContaining({
          profileImageUrl: '/uploads/profile-photo/profile-abc123.png',
          profileImageName: 'profile-abc123.png',
          preferences: expect.objectContaining({
            photo: true,
          }),
        }),
      }));
    });
  });

  it('saves resumes when education dates and address are missing', async () => {
    const user = userEvent.setup();

    render(
      <ResumeInput
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
        prefilledData={{
          targetRole: 'Senior Developer',
          preferences: {
            pages: '1-page',
            tone: 'modern',
            region: 'US',
            photo: false,
          },
          personalDetails: {
            firstName: 'Resume',
            lastName: 'User',
            email: 'resume@example.com',
            phone: '555-0100',
            address: '',
            city: '',
            state: '',
            country: '',
            postalCode: '',
            summary: 'Experienced developer.',
          },
          experienceItems: [
            { id: 'exp_1', role: 'Senior Developer', company: 'Acme', dates: '2020 - Present', description: 'Built products.' },
          ],
          educationItems: [
            { id: 'edu_1', degree: 'BS Computer Science', school: 'State University', location: 'Richardson, TX', dates: '' },
          ],
          skillItems: [
            { id: 'skill_1', category: 'Technical', items: 'React, Python' },
          ],
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /^save resume$/i }));

    await waitFor(() => expect(saveResume).toHaveBeenCalled());
    const savedContent = vi.mocked(saveResume).mock.calls.at(-1)?.[0].content;
    expect(savedContent?.educationItems?.[0]).toEqual(expect.objectContaining({
      school: 'State University',
      degree: 'BS Computer Science',
      location: 'Richardson, TX',
      dates: '',
    }));
    expect(savedContent?.personalDetails).toEqual(expect.objectContaining({
      address: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
    }));
  });

  it('saves when optional resume fields are blank and only work experience is complete', async () => {
    const user = userEvent.setup();

    render(
      <ResumeInput
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
        prefilledData={{
          targetRole: '',
          preferences: {
            pages: '1-page',
            tone: 'modern',
            region: 'US',
            photo: false,
          },
          personalDetails: {
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            country: '',
            postalCode: '',
            summary: '',
          },
          experienceItems: [{
            id: 'exp_1',
            role: 'Security Analyst',
            company: 'Blue Team Co',
            dates: 'January 2020 - Present',
            startMonth: 'January',
            startYear: '2020',
            endMonth: '',
            endYear: '',
            isPresent: true,
            description: 'Monitored security events and documented incidents.',
          }],
          educationItems: [
            { id: 'edu_empty', degree: '', school: '', location: '', dates: '' },
          ],
          skillItems: [
            { id: 'skill_empty', category: '', items: '' },
          ],
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /^save resume$/i }));

    await waitFor(() => expect(saveResume).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(saveResume).mock.calls[0][0];
    expect(saved.title).toBe('Resume');
    expect(saved.content.targetRole).toBe('');
    expect(saved.content.personalDetails?.summary).toBe('');
    expect(saved.content.experienceItems?.[0]).toEqual(expect.objectContaining({
      role: 'Security Analyst',
      company: 'Blue Team Co',
      dates: 'January 2020 - Present',
      description: 'Monitored security events and documented incidents.',
    }));
    expect(saved.content.educationItems).toEqual([]);
    expect(saved.content.skillItems).toEqual([]);
  });

  it('switches editor workspace between split, viewer-only, and editor-only layouts', async () => {
    const user = userEvent.setup();

    render(
      <ResumeInput
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
        prefilledData={{
          targetRole: 'Security Analyst',
          preferences: {
            pages: '1-page',
            tone: 'modern',
            region: 'US',
            photo: false,
          },
          personalDetails: {
            firstName: 'Resume',
            lastName: 'User',
            email: 'resume@example.com',
            phone: '',
            address: '',
            city: '',
            state: '',
            country: '',
            postalCode: '',
            summary: '',
          },
          experienceItems: [{
            id: 'exp_1',
            role: 'Security Analyst',
            company: 'Blue Team Co',
            dates: 'January 2020 - Present',
            description: 'Monitored security events.',
          }],
          educationItems: [],
          skillItems: [],
        }}
      />
    );

    expect(screen.getByPlaceholderText(/senior product designer/i)).toBeInTheDocument();
    expect(screen.getByText('Live Preview')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^viewer$/i }));
    expect(screen.queryByPlaceholderText(/senior product designer/i)).not.toBeInTheDocument();
    expect(screen.getByText('Live Preview')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^editor$/i }));
    expect(screen.getByPlaceholderText(/senior product designer/i)).toBeInTheDocument();
    expect(screen.queryByText('Live Preview')).not.toBeInTheDocument();
  });

  it('saves uploaded profile photos with the protected app URL', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <ResumeInput
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
        prefilledData={{
          targetRole: 'Senior Developer',
          preferences: {
            pages: '1-page',
            tone: 'modern',
            region: 'US',
            photo: true,
          },
          personalDetails: {
            firstName: 'Resume',
            lastName: 'User',
            email: 'resume@example.com',
            phone: '555-0100',
            address: '100 Main St',
            city: 'San Francisco',
            state: 'California',
            country: 'United States',
            postalCode: '94105',
            summary: 'Experienced developer.',
          },
          experienceItems: [
            { id: 'exp_1', role: 'Senior Developer', company: 'Acme', dates: '2020 - Present', description: 'Built products.' },
          ],
          educationItems: [
            { id: 'edu_1', degree: 'BS Computer Science', school: 'State University', dates: '2016 - 2020' },
          ],
          skillItems: [
            { id: 'skill_1', category: 'Technical', items: 'React, Python' },
          ],
        }}
      />
    );

    const photoInput = container.querySelector('input[accept="image/*"]') as HTMLInputElement;
    await user.upload(photoInput, new File(['avatar-image'], 'avatar.png', { type: 'image/png' }));

    await waitFor(() => {
      expect(uploadProfilePhoto).toHaveBeenCalled();
      expect(screen.getByText('avatar.png')).toBeInTheDocument();
      expect(screen.getByAltText('Profile')).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/));
    });

    await user.click(screen.getByRole('button', { name: /^save resume$/i }));

    await waitFor(() => expect(saveResume).toHaveBeenCalled());
    const savedContent = vi.mocked(saveResume).mock.calls.at(-1)?.[0].content;
    expect(savedContent).toEqual(expect.objectContaining({
      profileImageUrl: '/uploads/profile-photo/profile-abc123.png',
      profileImageName: 'avatar.png',
    }));
    expect(savedContent.profileImageData).toBeUndefined();
  });

  it('loads saved protected profile photos with the user session token', async () => {
    sessionStorage.setItem('rf_token', 'session-token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['saved-avatar'], { type: 'image/png' }), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      })
    );

    render(
      <ResumeInput
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
        prefilledData={{
          targetRole: 'Senior Developer',
          profileImageUrl: '/uploads/profile-photo/profile-abc123.png',
          profileImageName: 'profile-abc123.png',
          preferences: {
            pages: '1-page',
            tone: 'modern',
            region: 'US',
            photo: true,
          },
        }}
      />
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/uploads/profile-photo/profile-abc123.png',
        expect.objectContaining({
          headers: { Authorization: 'Bearer session-token' },
        })
      );
      expect(screen.getByAltText('Profile')).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/));
    });
  });

  it('clears an existing profile photo when imported resume data starts a new resume', async () => {
    const baseProps = {
      onImport: vi.fn(),
      onTemplateChange: vi.fn(),
      isLoading: false,
      role: UserRole.USER,
      userPlan: SubscriptionPlan.FREE,
      selectedTemplateId: 'classic_pro',
      user: {
        id: 'usr_1',
        name: 'Resume User',
        email: 'resume@example.com',
        role: UserRole.USER,
        plan: SubscriptionPlan.FREE,
        status: 'Active' as const,
        createdAt: '2026-05-25T00:00:00Z',
        paidAmount: '$0.00',
      },
    };

    const { rerender } = render(
      <ResumeInput
        {...baseProps}
        prefilledData={{
          targetRole: 'Senior Developer',
          profileImageUrl: '/uploads/profile-photo/profile-abc123.png',
          profileImageName: 'profile-abc123.png',
          preferences: {
            pages: '1-page',
            tone: 'modern',
            region: 'US',
            photo: true,
          },
        }}
      />
    );

    const includePhoto = await screen.findByLabelText(/include photo/i);
    await waitFor(() => expect(includePhoto).toBeChecked());
    expect(screen.getByText('profile-abc123.png')).toBeInTheDocument();

    rerender(
      <ResumeInput
        {...baseProps}
        prefilledData={{
          targetRole: '',
          profileImageUrl: undefined,
          profileImageName: undefined,
          profileImageData: undefined,
          preferences: {
            pages: '1-page',
            tone: 'modern',
            region: 'US',
            photo: false,
          },
        }}
      />
    );

    await waitFor(() => expect(includePhoto).not.toBeChecked());
    expect(screen.queryByText('profile.png')).not.toBeInTheDocument();
  });

  it('rejects unsupported import files before they reach the live editor parser', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { container } = render(
      <ResumeInput
        onImport={onImport}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /import file/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    expect(fileInput.accept).toContain('.pdf');
    expect(fileInput.accept).toContain('.doc');
    expect(fileInput.accept).toContain('.docx');
    expect(fileInput.accept).not.toContain('image/');

    const rejectedImage = new File(['not a resume'], 'resume.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [rejectedImage] } });

    expect(alertSpy).toHaveBeenCalledWith('Supported ATS resume formats: PDF, DOC, DOCX.');
    expect(screen.queryByText('resume.png')).not.toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('hides target role while importing an existing resume file', async () => {
    const user = userEvent.setup();

    render(
      <ResumeInput
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
      />
    );

    expect(screen.getByText(/^Target Role$/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /import file/i }));

    expect(screen.queryByText(/^Target Role$/i)).not.toBeInTheDocument();
  });

  it('sends Word import files to the live editor parser', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();

    const { container } = render(
      <ResumeInput
        onImport={onImport}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /import file/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    expect(fileInput.accept).toContain('.pdf');
    expect(fileInput.accept).toContain('.doc');
    expect(fileInput.accept).toContain('.docx');
    expect(fileInput.accept).not.toContain('image/');

    const docx = new File(['resume content'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await user.upload(fileInput, docx);

    expect(await screen.findByText('resume.docx')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /import to editor/i }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(expect.objectContaining({
        targetRole: '',
        importFormat: 'ats',
        profileImageUrl: undefined,
        profileImageName: undefined,
        profileImageData: undefined,
        preferences: expect.objectContaining({
          photo: false,
        }),
        currentResumeText: '',
        fileData: expect.objectContaining({
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          name: 'resume.docx',
          data: expect.any(String),
        }),
      }));
    });
  });

  it('shows imported certifications as editable inputs and saves edits', async () => {
    const user = userEvent.setup();

    render(
      <ResumeInput
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
        prefilledData={{
          targetRole: 'Software Engineer',
          personalDetails: {
            firstName: 'Jordan',
            lastName: 'Carter',
            email: 'jordan@example.com',
            phone: '555-0100',
            links: 'LinkedIn: linkedin.com/in/jordan',
            address: '',
            city: 'Austin',
            state: 'TX',
            country: 'United States',
            postalCode: '73301',
            summary: 'Engineer building reliable applications.',
          },
          experienceItems: [{
            id: 'exp_1',
            role: 'Software Engineer',
            company: 'Example Co',
            dates: 'January 2021 - Present',
            startMonth: 'January',
            startYear: '2021',
            endMonth: '',
            endYear: '',
            isPresent: true,
            description: 'Built secure APIs.',
          }],
          educationItems: [{
            id: 'edu_1',
            school: 'State University',
            degree: 'BS Computer Science',
            dates: '',
          }],
          certificationItems: [{
            id: 'cert_1',
            name: 'AWS Certified Developer',
            issuer: 'Amazon Web Services',
            date: 'May 2026',
            credentialUrl: 'https://credentials.example.com/aws-dev',
            details: 'Developer associate credential',
          }],
          skillItems: [{
            id: 'skill_1',
            category: 'Core',
            items: 'Python, AWS',
          }],
          additionalSections: [{
            id: 'section_1',
            title: 'Projects',
            items: 'Internal API modernization',
          }],
        }}
      />
    );

    expect(screen.getByDisplayValue('LinkedIn: linkedin.com/in/jordan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('AWS Certified Developer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Amazon Web Services')).toBeInTheDocument();
    expect(screen.getByDisplayValue('May 2026')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Projects')).toBeInTheDocument();

    const details = screen.getByDisplayValue('Developer associate credential');
    fireEvent.change(details, { target: { value: 'Developer associate credential\nSecurity+' } });

    await user.click(screen.getByRole('button', { name: /save resume/i }));

    await waitFor(() => expect(saveResume).toHaveBeenCalledTimes(1));
    const savedContent = vi.mocked(saveResume).mock.calls[0][0].content;
    expect(savedContent.certificationItems).toEqual([
      expect.objectContaining({
        name: 'AWS Certified Developer',
        issuer: 'Amazon Web Services',
        date: 'May 2026',
        credentialUrl: 'https://credentials.example.com/aws-dev',
        details: 'Developer associate credential\nSecurity+',
      }),
    ]);
    expect(savedContent.additionalSections).toEqual([
      expect.objectContaining({
        title: 'Projects',
        items: 'Internal API modernization',
      }),
    ]);
    expect(savedContent.personalDetails?.links).toBe('LinkedIn: linkedin.com/in/jordan');
  });

  it('downloads a selectable text PDF through the export service', async () => {
    render(<ResumeInput onImport={vi.fn()} onTemplateChange={vi.fn()} isLoading={false}
      role={UserRole.USER} userPlan={SubscriptionPlan.FREE} selectedTemplateId="classic_pro"
      user={{ id: 'u', name: 'Resume User', email: 'resume@example.com', role: UserRole.USER,
        plan: SubscriptionPlan.FREE, status: 'Active', createdAt: '', paidAmount: '$0.00' }} />);
    await userEvent.click(screen.getByRole('button', { name: /download pdf/i }));
    await waitFor(() => expect(downloadResumeFile).toHaveBeenCalledWith(
      expect.objectContaining({ personalDetails: expect.objectContaining({ firstName: 'Resume' }) }),
      'Resume User Resume', 'pdf'));
  });

  it('preserves international postal codes and emits live workspace data', async () => {
    const changed = vi.fn();
    render(<ResumeInput onImport={vi.fn()} onTemplateChange={vi.fn()} onWorkspaceChange={changed}
      isLoading={false} role={UserRole.USER} userPlan={SubscriptionPlan.FREE} selectedTemplateId="classic_pro"
      user={{ id: 'u', name: 'User', email: 'user@example.com', role: UserRole.USER,
        plan: SubscriptionPlan.FREE, status: 'Active', createdAt: '', paidAmount: '$0.00' }} />);
    const postal = screen.getByPlaceholderText('e.g. 94105');
    await userEvent.type(postal, 'K1A 0B1');
    expect(postal).toHaveValue('K1A 0B1');
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({
      personalDetails: expect.objectContaining({ postalCode: 'K1A 0B1' }),
    }));
  });

  it('does not expose ATS scoring from the resume editor tabs', () => {
    render(
      <ResumeInput
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
      />
    );

    expect(screen.queryByRole('button', { name: /^ats score$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run ats score/i })).not.toBeInTheDocument();
  });

  it('creates and saves a cover letter from a job URL', async () => {
    const user = userEvent.setup();

    render(
      <ResumeInput
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="classic_pro"
        initialTab="cover_letter"
        user={{
          id: 'usr_1',
          name: 'Resume User',
          email: 'resume@example.com',
          role: UserRole.USER,
          plan: SubscriptionPlan.FREE,
          status: 'Active' as const,
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
      />
    );

    await user.type(screen.getByPlaceholderText(/senior product designer/i), 'Senior Developer');
    await user.type(screen.getByPlaceholderText(/company.com\/careers/i), 'https://jobs.example.com/senior-developer');
    await user.click(screen.getByRole('button', { name: /generate & save cover letter/i }));

    await waitFor(() => {
      expect(generateCoverLetter).toHaveBeenCalledWith(expect.objectContaining({
        jobUrl: 'https://jobs.example.com/senior-developer',
        jobDescription: undefined,
        templateId: 'classic_pro',
        resumeJson: expect.objectContaining({
          targetRole: 'Senior Developer',
          jobUrl: 'https://jobs.example.com/senior-developer',
        }),
      }));
    });
    expect(await screen.findByText(/open the cover letters menu/i)).toBeInTheDocument();
  });
});
