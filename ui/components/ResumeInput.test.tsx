import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResumeInput from './ResumeInput';
import { saveResume } from '../services/resumeService';
import { generateCoverLetter } from '../services/coverLetterService';
import { uploadProfilePhoto } from '../services/uploadService';
import { SubscriptionPlan, UserRole } from '../types';

const pdfMocks = vi.hoisted(() => ({
  html2canvas: vi.fn(() => Promise.resolve({
    width: 1000,
    height: 1414,
    toDataURL: () => 'data:image/jpeg;base64,resume',
  })),
  addImage: vi.fn(),
  addPage: vi.fn(),
  save: vi.fn(),
}));

function mockCreatedCanvases() {
  const originalCreateElement = document.createElement.bind(document);
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const toDataURL = vi.fn(() => 'data:image/jpeg;base64,resume-page');

  const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
    if (tagName.toLowerCase() === 'canvas') {
      let width = 0;
      let height = 0;
      const context = { drawImage, fillRect } as any;

      return {
        get width() {
          return width;
        },
        set width(value: number) {
          width = value;
        },
        get height() {
          return height;
        },
        set height(value: number) {
          height = value;
        },
        getContext: vi.fn(() => context),
        toDataURL,
      } as any;
    }

    return originalCreateElement(tagName, options);
  });

  return { createElementSpy, drawImage, fillRect, toDataURL };
}

vi.mock('html2canvas', () => ({
  default: pdfMocks.html2canvas,
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(function () {
    return {
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    addImage: pdfMocks.addImage,
    addPage: pdfMocks.addPage,
    save: pdfMocks.save,
    };
  }),
}));

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
    vi.mocked(saveResume).mockResolvedValue({ id: 'res_saved' });
    vi.mocked(uploadProfilePhoto).mockResolvedValue({
      url: '/uploads/profile-photos/usr_1/profile.png',
      filename: 'profile.png',
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

  it('saves uploaded profile photos with embedded image data for reload and PDF fallback', async () => {
    const user = userEvent.setup();

    const { container } = render(
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

    await waitFor(() => {
      expect(saveResume).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.objectContaining({
          profileImageUrl: '/uploads/profile-photos/usr_1/profile.png',
          profileImageName: 'avatar.png',
          profileImageData: expect.objectContaining({
            mimeType: 'image/png',
            data: expect.any(String),
          }),
        }),
      }));
    });
  });

  it('clears an existing profile photo when imported resume data starts a new resume', async () => {
    const baseProps = {
      onGenerate: vi.fn(),
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
        status: 'Active',
        createdAt: '2026-05-25T00:00:00Z',
        paidAmount: '$0.00',
      },
    };

    const { rerender } = render(
      <ResumeInput
        {...baseProps}
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
        }}
      />
    );

    const includePhoto = await screen.findByLabelText(/include photo/i);
    await waitFor(() => expect(includePhoto).toBeChecked());
    expect(screen.getByText('profile.png')).toBeInTheDocument();

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

  it('downloads the live resume as a generated PDF without using browser print', async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    mockCreatedCanvases();

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

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => {
      expect(pdfMocks.html2canvas).toHaveBeenCalled();
      expect(pdfMocks.save).toHaveBeenCalledWith('resume-user-resume.pdf');
    });
    expect(printSpy).not.toHaveBeenCalled();

    printSpy.mockRestore();
  });

  it('slices long resume captures into separate PDF pages without overlapping offsets', async () => {
    const user = userEvent.setup();
    const { drawImage } = mockCreatedCanvases();

    pdfMocks.html2canvas.mockResolvedValueOnce({
      width: 1000,
      height: 3000,
      toDataURL: () => 'data:image/jpeg;base64,resume-full',
    });

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

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => {
      expect(pdfMocks.addImage).toHaveBeenCalledTimes(3);
      expect(pdfMocks.addPage).toHaveBeenCalledTimes(2);
      expect(pdfMocks.save).toHaveBeenCalledWith('resume-user-resume.pdf');
    });

    for (const call of pdfMocks.addImage.mock.calls) {
      expect(call[2]).toBe(0);
      expect(call[3]).toBeGreaterThanOrEqual(0);
    }
    expect(drawImage).toHaveBeenCalledTimes(3);
  });

  it('moves PDF page cuts to nearby quiet rows instead of slicing through content', async () => {
    const user = userEvent.setup();
    const { drawImage } = mockCreatedCanvases();
    const quietRanges = [
      [256, 268],
      [516, 528],
    ];

    const getImageData = vi.fn((_x: number, y: number, width: number, height: number) => {
      const data = new Uint8ClampedArray(width * height * 4);

      for (let row = 0; row < height; row += 1) {
        const absoluteY = y + row;
        const isQuietRow = quietRanges.some(([start, end]) => absoluteY >= start && absoluteY <= end);

        for (let col = 0; col < width; col += 1) {
          const index = ((row * width) + col) * 4;
          const value = isQuietRow ? 255 : (col % 8 < 4 ? 30 : 245);
          data[index] = value;
          data[index + 1] = value;
          data[index + 2] = value;
          data[index + 3] = 255;
        }
      }

      return { data, width, height } as ImageData;
    });

    const renderedCanvas = {
      width: 210,
      height: 620,
      getContext: vi.fn(() => ({ getImageData })),
      toDataURL: () => 'data:image/jpeg;base64,resume-full',
    };

    pdfMocks.html2canvas.mockResolvedValueOnce(renderedCanvas);

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

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => {
      expect(pdfMocks.addImage).toHaveBeenCalledTimes(3);
      expect(pdfMocks.addPage).toHaveBeenCalledTimes(2);
    });

    expect(drawImage.mock.calls[0][4]).toBeLessThan(297);
    expect(drawImage.mock.calls[0][4]).toBeGreaterThanOrEqual(256);
    expect(drawImage.mock.calls[1][2]).toBe(drawImage.mock.calls[0][4]);
    expect(drawImage.mock.calls[1][4]).toBeLessThan(289);
    expect(drawImage.mock.calls[1][6]).toBe(8);
  });

  it('keeps marked resume blocks together when choosing PDF page cuts', async () => {
    const user = userEvent.setup();
    const { drawImage } = mockCreatedCanvases();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const isBlock = this instanceof HTMLElement && this.hasAttribute('data-pdf-block');
      return {
        x: 0,
        y: isBlock ? 250 : 0,
        top: isBlock ? 250 : 0,
        bottom: isBlock ? 360 : 620,
        left: 0,
        right: 210,
        width: 210,
        height: isBlock ? 110 : 620,
        toJSON: () => {},
      } as DOMRect;
    });

    const getImageData = vi.fn((_x: number, _y: number, width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4).fill(80),
    } as ImageData));

    pdfMocks.html2canvas.mockResolvedValueOnce({
      width: 210,
      height: 620,
      getContext: vi.fn(() => ({ getImageData })),
      toDataURL: () => 'data:image/jpeg;base64,resume-full',
    });

    render(
      <ResumeInput
        onGenerate={vi.fn()}
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="modern_tech"
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
          targetRole: 'Application Lead',
          personalDetails: {
            firstName: 'Resume',
            lastName: 'User',
            email: 'resume@example.com',
            summary: 'Experienced developer.',
          },
          experienceItems: [
            {
              id: 'exp_1',
              role: 'Application Lead',
              company: 'Honda',
              dates: 'Jun 2013 - Jun 2014',
              description: 'Led development of enterprise web services and implemented API security controls.',
            },
          ],
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => {
      expect(pdfMocks.addImage).toHaveBeenCalledTimes(3);
    });

    expect(drawImage.mock.calls[0][4]).toBeLessThan(250);
    expect(drawImage.mock.calls[0][4]).toBeGreaterThanOrEqual(201);
    expect(drawImage.mock.calls[1][2]).toBe(drawImage.mock.calls[0][4]);

    rectSpy.mockRestore();
  });

  it('paints the modern template sidebar across every generated PDF page', async () => {
    const user = userEvent.setup();
    const { drawImage, fillRect } = mockCreatedCanvases();

    pdfMocks.html2canvas.mockResolvedValueOnce({
      width: 1000,
      height: 3000,
      toDataURL: () => 'data:image/jpeg;base64,resume-full',
    });

    render(
      <ResumeInput
        onGenerate={vi.fn()}
        onImport={vi.fn()}
        onTemplateChange={vi.fn()}
        isLoading={false}
        role={UserRole.USER}
        userPlan={SubscriptionPlan.FREE}
        selectedTemplateId="modern_tech"
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

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => {
      expect(pdfMocks.addImage).toHaveBeenCalledTimes(3);
    });

    const sidebarFillCalls = fillRect.mock.calls.filter((call) => call[0] === 0 && call[1] === 0 && call[2] === 320);
    expect(sidebarFillCalls).toHaveLength(3);
    for (const call of sidebarFillCalls) {
      expect(call[3]).toBe(1414);
    }
    expect(drawImage.mock.calls[1][1]).toBe(320);
    expect(drawImage.mock.calls[1][5]).toBe(320);
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
