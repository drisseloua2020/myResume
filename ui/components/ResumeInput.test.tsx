import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResumeInput from './ResumeInput';
import { saveResume } from '../services/resumeService';
import { generateCoverLetter } from '../services/coverLetterService';
import { SubscriptionPlan, UserRole } from '../types';

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
    vi.clearAllMocks();
    vi.mocked(saveResume).mockResolvedValue({ id: 'res_saved' });
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

  it('restores and persists the include-photo status from a loaded resume record', async () => {
    const user = userEvent.setup();

    render(
      <ResumeInput
        onGenerate={vi.fn()}
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
          status: 'Active',
          createdAt: '2026-05-25T00:00:00Z',
          paidAmount: '$0.00',
        }}
        prefilledData={{
          targetRole: 'Senior Developer',
          profileImageUrl: '/uploads/profile-photos/usr_1/profile.png',
          profileImageName: 'profile.png',
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
          profileImageUrl: '/uploads/profile-photos/usr_1/profile.png',
          profileImageName: 'profile.png',
          preferences: expect.objectContaining({
            photo: true,
          }),
        }),
      }));
    });
  });

  it('rejects unsupported import files before they reach the live editor parser', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { container } = render(
      <ResumeInput
        onGenerate={vi.fn()}
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
          status: 'Active',
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

    expect(alertSpy).toHaveBeenCalledWith('Supported formats: PDF, DOC, DOCX.');
    expect(screen.queryByText('resume.png')).not.toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('hides target role while importing an existing resume file', async () => {
    const user = userEvent.setup();

    render(
      <ResumeInput
        onGenerate={vi.fn()}
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
          status: 'Active',
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
        onGenerate={vi.fn()}
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
          status: 'Active',
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

    await user.click(screen.getByRole('button', { name: /import to live editor/i }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(expect.objectContaining({
        targetRole: '',
        currentResumeText: '',
        fileData: expect.objectContaining({
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          name: 'resume.docx',
          data: expect.any(String),
        }),
      }));
    });
  });

  it('creates and saves a cover letter from a job URL', async () => {
    const user = userEvent.setup();

    render(
      <ResumeInput
        onGenerate={vi.fn()}
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
          status: 'Active',
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
