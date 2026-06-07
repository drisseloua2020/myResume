import React, { useState, useRef, useEffect } from 'react';
import { AppMode, UserInputData, UserRole, SubscriptionPlan, ExperienceItem, EducationItem, SkillItem, User, PersonalDetails } from '../types';
import { AVAILABLE_TEMPLATES } from '../constants';
import LivePreview from './LivePreview';
import ConfirmNewResumeModal from './ConfirmNewResumeModal';
import { saveResume, updateResume } from '../services/resumeService';
import { locationService } from '../services/locationService';
import { apiAssetUrl } from '../services/apiClient';
import { uploadProfilePhoto } from '../services/uploadService';
import { generateCoverLetter } from '../services/coverLetterService';

interface ResumeInputProps {
  onGenerate: (data: UserInputData, mode: AppMode) => void;
  onImport: (data: UserInputData) => void;
  onTemplateChange: (templateId: string) => void;
  onNewResume?: () => void;
  onDraftChange?: (draft: UserInputData) => void;
  isLoading: boolean;
  role: UserRole;
  userPlan: SubscriptionPlan;
  selectedTemplateId?: string;
  user: User; // Need user info for the preview
  initialTab?: 'upload' | 'create' | 'cover_letter';
  prefilledData?: Partial<UserInputData> | null;
  loadedResumeId?: string | null;
}

type TabType = 'upload' | 'create' | 'cover_letter';
type JobSourceMode = 'url' | 'paste';

const IMPORT_DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const IMPORT_DOCUMENT_ACCEPT = [
  ...Object.keys(IMPORT_DOCUMENT_TYPES),
  ...Object.values(IMPORT_DOCUMENT_TYPES),
].join(',');

function getImportDocumentMimeType(file: File): string | null {
  if (file.type && IMPORT_DOCUMENT_TYPES[file.type]) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.doc')) return 'application/msword';
  if (lowerName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return null;
}

function slugifyFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'resume';
}

async function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  }));
}

function imageDataUrlFromProfileData(imageData?: { mimeType: string; data: string }): string | undefined {
  return imageData ? `data:${imageData.mimeType};base64,${imageData.data}` : undefined;
}

async function readProfileImageData(file: File): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, data] = result.split(',');
      if (!data) {
        reject(new Error('Could not read the selected photo.'));
        return;
      }
      resolve({ mimeType: file.type, data });
    };
    reader.onerror = () => reject(new Error('Could not read the selected photo.'));
    reader.readAsDataURL(file);
  });
}

type PdfPageSlice = {
  sourceY: number;
  heightPx: number;
  topMarginMm: number;
};

type VerticalRange = {
  startY: number;
  endY: number;
};

const CONTINUATION_PAGE_TOP_MARGIN_MM = 8;
const PAGE_END_EMPTY_SPACE_MM = 18;
const MIN_PDF_PAGE_FILL_RATIO = 0.68;
const PDF_SAFE_CUT_PADDING_PX = 6;
const JOB_BLOCK_START_GUARD_MM = 28;
const MODERN_TECH_SIDEBAR_RATIO = 0.32;
const MODERN_TECH_SIDEBAR_COLOR = '#0f172a';

function getPdfPageHeightPx(canvasWidthPx: number, pageWidthMm: number, usablePageHeightMm: number): number {
  return Math.floor((canvasWidthPx * usablePageHeightMm) / pageWidthMm);
}

function collectTextLineRanges(node: HTMLElement): VerticalRange[] {
  const ranges: VerticalRange[] = [];
  const rootRect = node.getBoundingClientRect();
  const doc = node.ownerDocument;

  function visit(child: ChildNode): void {
    if (child.nodeType === Node.TEXT_NODE) {
      if (!child.textContent?.trim()) {
        return;
      }

      const range = doc.createRange();
      try {
        range.selectNodeContents(child);
        if (typeof range.getClientRects !== 'function') {
          return;
        }

        Array.from(range.getClientRects()).forEach((rect) => {
          if (rect.height <= 0 || rect.width <= 0) {
            return;
          }

          ranges.push({
            startY: Math.max(0, rect.top - rootRect.top - PDF_SAFE_CUT_PADDING_PX),
            endY: Math.max(0, rect.bottom - rootRect.top + PDF_SAFE_CUT_PADDING_PX),
          });
        });
      } finally {
        range.detach();
      }
      return;
    }

    child.childNodes.forEach(visit);
  }

  node.childNodes.forEach(visit);
  return ranges.sort((a, b) => a.startY - b.startY);
}

function scaleVerticalRanges(ranges: VerticalRange[], scale: number): VerticalRange[] {
  if (!Number.isFinite(scale) || scale <= 0) {
    return [];
  }

  return ranges.map((range) => ({
    startY: Math.floor(range.startY * scale),
    endY: Math.ceil(range.endY * scale),
  }));
}

function collectBlockRanges(node: HTMLElement): VerticalRange[] {
  const rootRect = node.getBoundingClientRect();
  return Array.from(node.querySelectorAll<HTMLElement>('[data-pdf-block]'))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        startY: Math.max(0, rect.top - rootRect.top - PDF_SAFE_CUT_PADDING_PX),
        endY: Math.max(0, rect.bottom - rootRect.top + PDF_SAFE_CUT_PADDING_PX),
      };
    })
    .filter((range) => range.endY > range.startY)
    .sort((a, b) => a.startY - b.startY);
}

function findSafeCutBeforeBlocks(
  blockRanges: VerticalRange[],
  minEndY: number,
  idealEndY: number,
  pageHeightPx: number,
  guardPx: number
): number | null {
  if (!blockRanges.length || idealEndY <= minEndY) {
    return null;
  }

  const guardedStartY = Math.max(minEndY, idealEndY - guardPx);
  const relevantBlock = blockRanges.find((range) => {
    const crossesPageEnd = range.startY < idealEndY && range.endY > idealEndY;
    const startsTooLate = range.startY >= guardedStartY && range.startY < idealEndY;
    const fitsOnNextPage = range.endY - range.startY <= pageHeightPx;
    return fitsOnNextPage && range.startY > 0 && (crossesPageEnd || startsTooLate);
  });

  if (!relevantBlock) {
    return null;
  }

  const cutY = Math.floor(relevantBlock.startY - PDF_SAFE_CUT_PADDING_PX);
  if (cutY > minEndY) {
    return cutY;
  }

  return null;
}

function findDomSafeCut(
  blockedRanges: VerticalRange[],
  minEndY: number,
  idealEndY: number
): number | null {
  if (!blockedRanges.length || idealEndY <= minEndY) {
    return null;
  }

  const relevantRanges = blockedRanges.filter((range) => range.endY >= minEndY && range.startY <= idealEndY);
  if (!relevantRanges.length) {
    return idealEndY;
  }

  for (let cutY = idealEndY; cutY >= minEndY; cutY -= 1) {
    const intersectsText = relevantRanges.some((range) => cutY >= range.startY && cutY <= range.endY);
    if (!intersectsText) {
      return cutY;
    }
  }

  return null;
}

function findQuietHorizontalCut(
  canvas: HTMLCanvasElement,
  minEndY: number,
  idealEndY: number
): number | null {
  if (typeof canvas.getContext !== 'function' || idealEndY <= minEndY) {
    return null;
  }

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return null;
  }

  const searchHeight = idealEndY - minEndY;
  const sampleStep = Math.max(2, Math.floor(canvas.width / 420));
  const quietBandHeight = Math.max(6, Math.floor(canvas.width / 180));
  const maxTransitionsPerRow = Math.max(10, Math.floor((canvas.width / sampleStep) * 0.035));

  if (searchHeight < quietBandHeight) {
    return null;
  }

  let imageData: ImageData;
  try {
    imageData = context.getImageData(0, minEndY, canvas.width, searchHeight);
  } catch {
    return null;
  }

  const rowScores: number[] = [];
  for (let y = 0; y < searchHeight; y += 1) {
    let transitions = 0;
    let previousLum: number | null = null;

    for (let x = 0; x < canvas.width; x += sampleStep) {
      const index = ((y * canvas.width) + x) * 4;
      const alpha = imageData.data[index + 3];
      if (alpha < 20) {
        continue;
      }

      const lum = (
        imageData.data[index] * 0.299 +
        imageData.data[index + 1] * 0.587 +
        imageData.data[index + 2] * 0.114
      );

      if (previousLum !== null && Math.abs(lum - previousLum) > 34) {
        transitions += 1;
      }
      previousLum = lum;
    }

    rowScores.push(transitions);
  }

  for (let y = searchHeight - quietBandHeight; y >= 0; y -= 1) {
    const bandScore = rowScores
      .slice(y, y + quietBandHeight)
      .reduce((sum, score) => sum + score, 0);
    const averageTransitions = bandScore / quietBandHeight;

    if (averageTransitions <= maxTransitionsPerRow) {
      return minEndY + y + Math.floor(quietBandHeight / 2);
    }
  }

  return null;
}

function createPdfPageSlices(
  canvas: HTMLCanvasElement,
  pageWidthMm: number,
  pageHeightMm: number,
  options: { blockRanges?: VerticalRange[]; textRanges?: VerticalRange[] } = {}
): PdfPageSlice[] {
  const slices: PdfPageSlice[] = [];
  let sourceY = 0;

  while (sourceY < canvas.height) {
    const pageIndex = slices.length;
    const topMarginMm = pageIndex > 0 ? CONTINUATION_PAGE_TOP_MARGIN_MM : 0;
    const usablePageHeightMm = pageHeightMm - topMarginMm - PAGE_END_EMPTY_SPACE_MM;
    const pageHeightPx = getPdfPageHeightPx(canvas.width, pageWidthMm, usablePageHeightMm);

    if (pageHeightPx <= 0) {
      throw new Error('The resume preview could not be paginated.');
    }

    const remainingHeightPx = canvas.height - sourceY;
    if (remainingHeightPx <= pageHeightPx) {
      slices.push({ sourceY, heightPx: remainingHeightPx, topMarginMm });
      break;
    }

    const idealEndY = sourceY + pageHeightPx;
    const minEndY = sourceY + Math.floor(pageHeightPx * MIN_PDF_PAGE_FILL_RATIO);
    const guardPx = getPdfPageHeightPx(canvas.width, pageWidthMm, JOB_BLOCK_START_GUARD_MM);
    const blockCutY = findSafeCutBeforeBlocks(options.blockRanges || [], minEndY, idealEndY, pageHeightPx, guardPx);
    const quietCutY = blockCutY
      ?? findDomSafeCut([...(options.blockRanges || []), ...(options.textRanges || [])], minEndY, idealEndY)
      ?? findQuietHorizontalCut(canvas, minEndY, idealEndY);
    const cutY = quietCutY && quietCutY > sourceY ? quietCutY : idealEndY;

    slices.push({ sourceY, heightPx: cutY - sourceY, topMarginMm });
    sourceY = cutY;
  }

  return slices;
}

function addTemplateBackgroundToPage(
  context: CanvasRenderingContext2D,
  templateId: string | undefined,
  pageWidthPx: number,
  pageHeightPx: number
): void {
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, pageWidthPx, pageHeightPx);

  if (templateId === 'modern_tech') {
    context.fillStyle = MODERN_TECH_SIDEBAR_COLOR;
    context.fillRect(0, 0, Math.round(pageWidthPx * MODERN_TECH_SIDEBAR_RATIO), pageHeightPx);
  }
}

function addCanvasToPdfPages(
  pdf: any,
  canvas: HTMLCanvasElement,
  pageWidthMm: number,
  pageHeightMm: number,
  options: { templateId?: string; blockRanges?: VerticalRange[]; textRanges?: VerticalRange[] } = {}
): void {
  const pageSlices = createPdfPageSlices(canvas, pageWidthMm, pageHeightMm, {
    blockRanges: options.blockRanges,
    textRanges: options.textRanges,
  });
  const fullPageHeightPx = getPdfPageHeightPx(canvas.width, pageWidthMm, pageHeightMm);

  if (fullPageHeightPx <= 0) {
    throw new Error('The resume preview could not be paginated.');
  }

  pageSlices.forEach(({ sourceY, heightPx, topMarginMm }, pageIndex) => {
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = fullPageHeightPx;

    const context = pageCanvas.getContext('2d');
    if (!context) {
      throw new Error('The resume PDF page could not be prepared.');
    }

    const topMarginPx = Math.round((canvas.width * topMarginMm) / pageWidthMm);
    addTemplateBackgroundToPage(context, options.templateId, pageCanvas.width, pageCanvas.height);
    if (options.templateId === 'modern_tech' && pageIndex > 0) {
      const sidebarWidthPx = Math.round(canvas.width * MODERN_TECH_SIDEBAR_RATIO);
      context.drawImage(
        canvas,
        sidebarWidthPx,
        sourceY,
        canvas.width - sidebarWidthPx,
        heightPx,
        sidebarWidthPx,
        topMarginPx,
        canvas.width - sidebarWidthPx,
        heightPx
      );
    } else {
      context.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        heightPx,
        0,
        topMarginPx,
        canvas.width,
        heightPx
      );
    }
    const imageData = pageCanvas.toDataURL('image/jpeg', 0.98);

    if (pageIndex > 0) {
      pdf.addPage();
    }

    pdf.addImage(imageData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm);
  });
}

const ResumeInput: React.FC<ResumeInputProps> = ({ 
  onGenerate, 
  onImport,
  onTemplateChange,
  onNewResume,
  onDraftChange,
  isLoading, 
  role, 
  userPlan, 
  selectedTemplateId, 
  user, 
  initialTab = 'create',
  prefilledData,
  loadedResumeId = null,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showNewResumeConfirm, setShowNewResumeConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const resumeExportRef = useRef<HTMLDivElement>(null);
  
  // Saved resume (library) state
  const [savedResumeId, setSavedResumeId] = useState<string | null>(null);
  const [isSavingResume, setIsSavingResume] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [coverLetterMsg, setCoverLetterMsg] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Sync activeTab if initialTab changes (e.g. from parent navigation)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setSavedResumeId(loadedResumeId);
    setSaveMsg(null);
  }, [loadedResumeId]);

  // Personal Details State - Initialize with user data if available
  const [personalDetails, setPersonalDetails] = useState<PersonalDetails>(() => {
    // Split user name into first/last as default
    const nameParts = user.name ? user.name.split(' ') : [''];
    const initialFirst = nameParts[0] || '';
    const initialLast = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    return {
      firstName: initialFirst,
      lastName: initialLast,
      email: user.email || '',
      phone: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      summary: ''
    };
  });

  // Handle Prefilled Data (e.g. from Import)
  useEffect(() => {
    if (prefilledData) {
      if ('targetRole' in prefilledData) setTargetRole(prefilledData.targetRole || '');
      if (prefilledData.experienceItems) setExperiences(prefilledData.experienceItems);
      if (prefilledData.educationItems) setEducations(prefilledData.educationItems);
      if (prefilledData.skillItems) setSkills(prefilledData.skillItems);
      if (prefilledData.jobDescription) setJobDescription(prefilledData.jobDescription);
      if (prefilledData.jobUrl) setJobUrl(prefilledData.jobUrl);
      if (prefilledData.preferences) {
        setPreferences(prev => ({
          ...prev!,
          ...prefilledData.preferences,
        }));
      }
      if (prefilledData.personalDetails) {
         setPersonalDetails(prev => ({
             ...prev,
             ...prefilledData.personalDetails
         }));
      }
      if ('profileImageUrl' in prefilledData) setProfileImageUrl(prefilledData.profileImageUrl || undefined);
      if ('profileImageName' in prefilledData) setProfilePhotoName(prefilledData.profileImageName || null);
      if ('profileImageData' in prefilledData) setLegacyProfileImageData(prefilledData.profileImageData || undefined);
    }
  }, [prefilledData]);
  
  // Common State
  const [targetRole, setTargetRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [jobSourceMode, setJobSourceMode] = useState<JobSourceMode>('url');
  const [preferences, setPreferences] = useState<UserInputData['preferences']>({
    pages: '1-page',
    tone: 'modern',
    region: 'US',
    photo: false,
  });

  // Mode A State (Upload)
  const [currentResumeText, setCurrentResumeText] = useState('');
  const [fileData, setFileData] = useState<UserInputData['fileData'] | undefined>(undefined);
  const [fileName, setFileName] = useState<string | null>(null);

  // Profile Photo State
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(undefined);
  const [legacyProfileImageData, setLegacyProfileImageData] = useState<{ mimeType: string, data: string } | undefined>(undefined);
  const [profilePhotoName, setProfilePhotoName] = useState<string | null>(null);
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null);

  // Mode B State (Structured)
  const [experiences, setExperiences] = useState<ExperienceItem[]>([
    { id: '1', role: '', company: '', dates: '', description: '' }
  ]);
  const [educations, setEducations] = useState<EducationItem[]>([
    { id: '1', degree: '', school: '', dates: '' }
  ]);
  const [skills, setSkills] = useState<SkillItem[]>([
    { id: '1', category: '', items: '' }
  ]);

  const activeTemplate = AVAILABLE_TEMPLATES.find(t => t.id === selectedTemplateId);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingCountries(true);
        setLocationError(null);
        const list = await locationService.getCountries();
        if (alive) setCountries(list);
      } catch {
        if (alive) {
          setCountries([]);
          setLocationError('Location suggestions are unavailable. You can still enter them manually.');
        }
      } finally {
        if (alive) setLoadingCountries(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const country = personalDetails.country.trim();
    setStates([]);
    setCities([]);

    if (!country) {
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        setLoadingStates(true);
        const list = await locationService.getStates(country);
        if (alive) setStates(list);
      } catch {
        if (alive) setStates([]);
      } finally {
        if (alive) setLoadingStates(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [personalDetails.country]);

  useEffect(() => {
    let alive = true;
    const country = personalDetails.country.trim();
    const state = personalDetails.state.trim();
    setCities([]);

    if (!country || !state) {
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        setLoadingCities(true);
        const list = await locationService.getCities(country, state);
        if (alive) setCities(list);
      } catch {
        if (alive) setCities([]);
      } finally {
        if (alive) setLoadingCities(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [personalDetails.country, personalDetails.state]);

  // Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const mimeType = getImportDocumentMimeType(file);
      if (!mimeType) {
        alert("Supported formats: PDF, DOC, DOCX.");
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFileData({ mimeType, data: (reader.result as string).split(',')[1], name: file.name });
        setCurrentResumeText('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic'];
      if (!validTypes.includes(file.type)) {
        alert("Please upload a valid image file.");
        return;
      }

      setProfilePhotoError(null);
      setIsUploadingProfilePhoto(true);
      try {
        const imageData = await readProfileImageData(file);
        setLegacyProfileImageData(imageData);
        setProfilePhotoName(file.name || null);
        try {
          const uploaded = await uploadProfilePhoto(file);
          setProfileImageUrl(uploaded.url);
          setProfilePhotoName(file.name || uploaded.filename);
        } catch (uploadErr: any) {
          setProfileImageUrl(undefined);
          setProfilePhotoError(uploadErr?.message ? `Photo kept in this resume. Upload failed: ${uploadErr.message}` : 'Photo kept in this resume, but upload failed.');
        }
      } catch (err: any) {
        setProfilePhotoError(err?.message || 'Failed to load photo.');
        if (profilePhotoRef.current) profilePhotoRef.current.value = '';
      } finally {
        setIsUploadingProfilePhoto(false);
      }
    }
  };

  // Structured Data Handlers
  const addExperience = () => setExperiences([...experiences, { id: Math.random().toString(), role: '', company: '', dates: '', description: '' }]);
  const removeExperience = (id: string) => setExperiences(experiences.filter(i => i.id !== id));
  const updateExperience = (id: string, field: keyof ExperienceItem, value: string) => setExperiences(experiences.map(i => i.id === id ? { ...i, [field]: value } : i));

  const addEducation = () => setEducations([...educations, { id: Math.random().toString(), degree: '', school: '', dates: '' }]);
  const removeEducation = (id: string) => setEducations(educations.filter(i => i.id !== id));
  const updateEducation = (id: string, field: keyof EducationItem, value: string) => setEducations(educations.map(i => i.id === id ? { ...i, [field]: value } : i));

  const addSkill = () => setSkills([...skills, { id: Math.random().toString(), category: '', items: '' }]);
  const removeSkill = (id: string) => setSkills(skills.filter(i => i.id !== id));
  const updateSkill = (id: string, field: keyof SkillItem, value: string) => setSkills(skills.map(i => i.id === id ? { ...i, [field]: value } : i));

  const updatePersonalDetails = (field: keyof PersonalDetails, value: string) => {
    setPersonalDetails(prev => {
      if (field === 'country') {
        return { ...prev, country: value, state: '', city: '', postalCode: '' };
      }

      if (field === 'state') {
        return { ...prev, state: value, city: '' };
      }

      return { ...prev, [field]: value };
    });
    setValidationMsg(null);
  };

  const computeResumeTitle = (data: UserInputData) => {
    const fn = (data.personalDetails?.firstName || '').trim();
    const ln = (data.personalDetails?.lastName || '').trim();
    const name = [fn, ln].filter(Boolean).join(' ').trim();
    const rolePart = (data.targetRole || '').trim();
    const raw = name && rolePart ? `${name} - ${rolePart}` : name ? `${name} Resume` : rolePart ? `Resume - ${rolePart}` : 'Resume';
    return raw.slice(0, 200);
  };

  const handleDownloadPdf = async () => {
    const exportNode = resumeExportRef.current;
    if (!exportNode) {
      setPdfMsg('Resume preview is still loading. Try again in a moment.');
      return;
    }

    setIsDownloadingPdf(true);
    setPdfMsg(null);

    const resumePage = exportNode.querySelector<HTMLElement>('.resume-page');
    const previousInlineStyle = resumePage?.getAttribute('style') || '';

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      if (resumePage) {
        resumePage.style.boxShadow = 'none';
        resumePage.style.margin = '0';
        resumePage.style.transform = 'none';
        resumePage.style.width = '210mm';
        resumePage.style.maxWidth = '210mm';
        resumePage.style.minHeight = '297mm';
      }

      await waitForImages(exportNode);
      const keepTogetherRanges = collectBlockRanges(exportNode);
      const textLineRanges = collectTextLineRanges(exportNode);
      const exportWidth = Math.ceil(Math.max(
        exportNode.scrollWidth,
        resumePage?.scrollWidth || 0,
        exportNode.getBoundingClientRect().width
      ));
      const exportHeight = Math.ceil(Math.max(
        exportNode.scrollHeight,
        resumePage?.scrollHeight || 0,
        exportNode.getBoundingClientRect().height
      ));

      const canvas = await html2canvas(exportNode, {
        backgroundColor: '#ffffff',
        scale: Math.max(2, window.devicePixelRatio || 1),
        useCORS: true,
        logging: false,
        width: exportWidth,
        height: exportHeight,
        windowWidth: exportWidth,
        windowHeight: exportHeight,
      });

      if (!canvas.width || !canvas.height) {
        throw new Error('The resume preview could not be captured.');
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const canvasScale = canvas.width / exportWidth;
      addCanvasToPdfPages(pdf, canvas, pageWidth, pageHeight, {
        templateId: selectedTemplateId,
        blockRanges: scaleVerticalRanges(keepTogetherRanges, canvasScale),
        textRanges: scaleVerticalRanges(textLineRanges, canvasScale),
      });

      pdf.save(`${slugifyFilename(computeResumeTitle({ role, plan: userPlan, targetRole, personalDetails }))}.pdf`);
    } catch (err: any) {
      setPdfMsg(err?.message || 'Could not generate the resume PDF.');
    } finally {
      if (resumePage) {
        resumePage.setAttribute('style', previousInlineStyle);
      }
      setIsDownloadingPdf(false);
    }
  };

  const resetToNewResume = () => {
    // Reset ALL fields to a blank state (start from scratch with the selected template)
    setTargetRole('');
    setJobDescription('');
    setPreferences({
      pages: '1-page',
      tone: 'modern',
      region: 'US',
      photo: false,
    });

    setPersonalDetails({
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
    });

    // Clear profile photo
    setProfileImageUrl(undefined);
    setLegacyProfileImageData(undefined);
    setProfilePhotoName(null);
    setProfilePhotoError(null);
    setIsUploadingProfilePhoto(false);
    if (profilePhotoRef.current) profilePhotoRef.current.value = '';

    // Reset structured sections to blank starter items
    setExperiences([{ id: '1', role: '', company: '', dates: '', description: '' }]);
    setEducations([{ id: '1', degree: '', school: '', dates: '' }]);
    setSkills([{ id: '1', category: '', items: '' }]);

    // Clear import state (if any)
    setCurrentResumeText('');
    setFileData(undefined);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Clear save pointer so next save creates a new record
    setSavedResumeId(null);
    setSaveMsg(null);
  };

  const requestNewResume = () => {
    if (onNewResume) {
      onNewResume();
      return;
    }

    setShowNewResumeConfirm(true);
  };

  const hasText = (value?: string | null) => Boolean(value && value.trim().length > 0);

  const getMissingRequiredFields = () => {
    const missing: string[] = [];

    if (activeTab === 'upload') {
      if (!fileData) {
        missing.push('Resume PDF or Word document');
      }
      return missing;
    }

    if (!hasText(targetRole)) missing.push('Target role');

    if (activeTab === 'cover_letter') {
      if (jobSourceMode === 'url') {
        if (!/^https?:\/\//i.test(jobUrl.trim())) missing.push('Valid job posting URL');
      } else if (jobDescription.trim().length < 20) {
        missing.push('Target job description');
      }
      return missing;
    }

    if (!selectedTemplateId) missing.push('Template');

    const requiredDetails: Array<[keyof PersonalDetails, string]> = [
      ['firstName', 'First name'],
      ['lastName', 'Last name'],
      ['email', 'Email'],
      ['phone', 'Phone'],
      ['address', 'Street address'],
      ['country', 'Country'],
      ['state', 'State / region'],
      ['city', 'City'],
      ['postalCode', 'Zip / postal code'],
      ['summary', 'Professional summary'],
    ];

    requiredDetails.forEach(([field, label]) => {
      if (!hasText(personalDetails[field])) missing.push(label);
    });

    if (preferences?.photo && !profileImageUrl && !legacyProfileImageData) {
      missing.push('Profile photo');
    }

    experiences.forEach((exp, index) => {
      const prefix = `Employment ${index + 1}`;
      if (!hasText(exp.role)) missing.push(`${prefix} job title`);
      if (!hasText(exp.company)) missing.push(`${prefix} employer`);
      if (!hasText(exp.dates)) missing.push(`${prefix} dates`);
      if (!hasText(exp.description)) missing.push(`${prefix} description`);
    });

    educations.forEach((edu, index) => {
      const prefix = `Education ${index + 1}`;
      if (!hasText(edu.school)) missing.push(`${prefix} school`);
      if (!hasText(edu.degree)) missing.push(`${prefix} degree`);
      if (!hasText(edu.dates)) missing.push(`${prefix} dates`);
    });

    skills.forEach((skill, index) => {
      const prefix = `Skill ${index + 1}`;
      if (!hasText(skill.category)) missing.push(`${prefix} category`);
      if (!hasText(skill.items)) missing.push(`${prefix} items`);
    });

    return missing;
  };

  const validateRequiredFields = () => {
    setValidationMsg(null);

    if (formRef.current && !formRef.current.reportValidity()) {
      return false;
    }

    const missing = getMissingRequiredFields();
    if (missing.length === 0) return true;

    const visibleMissing = missing.slice(0, 6).join(', ');
    const suffix = missing.length > 6 ? ` and ${missing.length - 6} more` : '';
    setValidationMsg(`Please complete required fields: ${visibleMissing}${suffix}.`);
    return false;
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateRequiredFields()) {
      return;
    }

    const payload: UserInputData = {
      role,
      plan: userPlan,
      targetRole: activeTab === 'upload' ? '' : targetRole,
      jobDescription,
      jobUrl: jobUrl.trim() || undefined,
      preferences: activeTab === 'upload' ? { ...preferences!, photo: false } : preferences,
      profileImageUrl: activeTab === 'upload' ? undefined : profileImageUrl,
      profileImageName: activeTab === 'upload' ? undefined : profilePhotoName || undefined,
      profileImageData: activeTab === 'upload' ? undefined : legacyProfileImageData,
      templateId: selectedTemplateId,
      personalDetails
    };

    if (activeTab === 'upload') {
      // For Import tab, we default to "Import to Editor"
      payload.currentResumeText = currentResumeText;
      payload.fileData = fileData;
      onImport(payload);
      return;
    }

    // For Create & Cover Letter tabs, include structured blocks
    payload.experienceItems = experiences;
    payload.educationItems = educations;
    payload.skillItems = skills;

    if (activeTab === 'cover_letter') {
      setIsSavingResume(true);
      setCoverLetterMsg(null);
      setValidationMsg(null);
      try {
        const record = await generateCoverLetter({
          jobDescription: jobSourceMode === 'paste' ? jobDescription.trim() : undefined,
          jobUrl: jobSourceMode === 'url' ? jobUrl.trim() : undefined,
          templateId: selectedTemplateId,
          resumeJson: payload,
        });
        setCoverLetterMsg(`Created "${record.title}". Open the Cover Letters menu to view, download PDF, or delete it.`);
      } catch (err: any) {
        setValidationMsg(err?.message || 'Failed to generate cover letter.');
      } finally {
        setIsSavingResume(false);
      }
      return;
    }

    // Create tab => Save Resume (JSON) to library
    if (!selectedTemplateId) {
      alert('Select a template first.');
      return;
    }

    setIsSavingResume(true);
    setSaveMsg(null);
    try {
      const title = computeResumeTitle(payload);
      if (!savedResumeId) {
        const res = await saveResume({ templateId: selectedTemplateId, title, content: payload });
        setSavedResumeId(res.id);
      } else {
        await updateResume(savedResumeId, { templateId: selectedTemplateId, title, content: payload });
      }
      setSaveMsg('Saved');
      window.setTimeout(() => setSaveMsg(null), 2500);
    } catch (err: any) {
      setSaveMsg(err?.message ? `Save failed: ${err.message}` : 'Save failed');
    } finally {
      setIsSavingResume(false);
    }
  };

  // Construct current data object for preview
  const currentData: UserInputData = {
    role,
    plan: userPlan,
    targetRole,
    jobDescription,
    jobUrl,
    preferences,
    profileImageUrl,
    profileImageName: profilePhotoName || undefined,
    profileImageData: legacyProfileImageData,
    personalDetails,
    experienceItems: experiences,
    educationItems: educations,
    skillItems: skills
  };
  const profilePhotoSrc = imageDataUrlFromProfileData(legacyProfileImageData) || apiAssetUrl(profileImageUrl);

  // Autosave workspace draft while editing (debounced)
  useEffect(() => {
    if (!onDraftChange) return;
    if (activeTab !== 'create') return;
    if (isLoading) return;

    const t = window.setTimeout(() => {
      try {
        onDraftChange({ ...currentData, templateId: selectedTemplateId });
      } catch {
        // ignore autosave errors at this layer
      }
    }, 1200);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    isLoading,
    selectedTemplateId,
    targetRole,
    jobDescription,
    preferences,
    profileImageUrl,
    profilePhotoName,
    legacyProfileImageData,
    personalDetails,
    experiences,
    educations,
    skills
  ]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative items-start">
      
      {/* --- LEFT COLUMN: EDITOR FORM --- */}
      <div className="w-full lg:w-[52%] xl:w-[560px] 2xl:w-[640px] flex-shrink-0 no-print">
        <div className="w-full max-w-full min-w-0 flex flex-col sm:flex-row sm:flex-wrap xl:flex-nowrap sm:justify-between sm:items-stretch gap-3 mb-10 relative">
          <div className="bg-white p-1 rounded-full shadow-sm border border-slate-200 flex overflow-x-auto w-full min-w-0 sm:flex-[1_1_34rem] xl:min-w-[34rem]">
             <button
               type="button"
               onClick={() => setActiveTab('create')}
               className={`flex-1 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap text-center ${activeTab === 'create' ? 'bg-[#1a91f0] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               Live Editor
             </button>
             <button
               type="button"
               onClick={() => setActiveTab('upload')}
               className={`flex-1 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap text-center ${activeTab === 'upload' ? 'bg-[#1a91f0] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
             >
              Import File
             </button>
             <button
               type="button"
               onClick={() => setActiveTab('cover_letter')}
               className={`flex-1 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-1 text-center ${activeTab === 'cover_letter' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               <span>Cover Letter</span>
             </button>
          </div>

          <div className="relative z-20 w-full sm:w-auto sm:flex-shrink-0">
             <button 
                type="button"
                onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200 hidden sm:flex hover:border-blue-300 transition-colors"
              >
                {activeTemplate ? (
                    <>
                        <div className={`w-3 h-3 rounded-full ${activeTemplate.color}`}></div>
                        <span className="text-sm font-semibold text-slate-700 max-w-[100px] truncate">{activeTemplate.name}</span>
                    </>
                ) : (
                    <span className="text-sm font-semibold text-slate-700">Template</span>
                )}
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

             {showTemplateSelector && (
                 <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-fade-in-up">
                     <div className="text-xs font-bold text-slate-400 px-3 py-2 uppercase tracking-wide">Select Template</div>
                     {AVAILABLE_TEMPLATES.map(t => (
                         <button
                           key={t.id}
                           type="button"
                           onClick={() => {
                               onTemplateChange(t.id);
                               setShowTemplateSelector(false);
                           }}
                           className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${selectedTemplateId === t.id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50 border border-transparent'}`}
                         >
                            <div className={`w-8 h-8 rounded-full ${t.color} flex-shrink-0 border border-black/10`}></div>
                            <div className="overflow-hidden">
                                <div className={`text-sm font-bold truncate ${selectedTemplateId === t.id ? 'text-blue-700' : 'text-slate-800'}`}>{t.name}</div>
                                <div className="text-[10px] text-slate-500 truncate">{t.tag}</div>
                            </div>
                            {selectedTemplateId === t.id && <svg className="w-4 h-4 text-blue-500 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                         </button>
                     ))}
                 </div>
             )}
          </div>
        </div>

        <form ref={formRef} onSubmit={handleAction} className="space-y-6 pt-2">
          
          {activeTab !== 'upload' && (
            <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
               <h2 className="text-sm font-bold text-slate-800 mb-1 uppercase tracking-wide">Target Role</h2>
               <input
                  type="text"
                  className="w-full bg-[#f7f9fa] p-3 border-b-2 border-slate-200 focus:border-[#1a91f0] outline-none font-medium transition-colors"
                 placeholder="e.g. Senior Product Designer"
                 value={targetRole}
                 onChange={e => setTargetRole(e.target.value)}
                  required
               />
            </div>
          )}

          {activeTab === 'upload' && (
             <div className="bg-white rounded border border-slate-200 p-8 shadow-sm text-center">
               <div className="border-2 border-dashed border-slate-300 rounded-lg p-10 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept={IMPORT_DOCUMENT_ACCEPT} />
                  <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  {fileName ? (
                    <p className="font-semibold text-slate-800">{fileName}</p>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-700">Upload Resume (PDF, DOC, DOCX)</p>
                      <p className="text-sm text-slate-400 mt-1">Only PDF and Word documents are accepted</p>
                    </>
                  )}
               </div>
               <div className="mt-6 text-left rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                 The uploaded document is parsed securely, then mapped into the live editor fields for review and editing.
               </div>
             </div>
          )}

          {activeTab === 'create' && (
            <>
               {/* Personal Details */}
               <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide">Personal Details</h2>
                  <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-6 mb-2">
                          <div className="flex-shrink-0">
                             <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden relative">
                                {profilePhotoSrc ? (
                                  <img src={profilePhotoSrc} className="w-full h-full object-cover" alt="Profile" />
                                ) : (
                                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                )}
                             </div>
                          </div>
                          <div>
                              <input type="file" ref={profilePhotoRef} onChange={handleProfilePhotoUpload} className="hidden" accept="image/*"/>
                              <button type="button" onClick={() => profilePhotoRef.current?.click()} disabled={isUploadingProfilePhoto} className="text-[#1a91f0] font-medium text-sm hover:underline disabled:text-slate-400 disabled:no-underline">
                                  {isUploadingProfilePhoto ? 'Uploading...' : profilePhotoSrc ? 'Change Photo' : 'Upload Photo'}
                              </button>
                              {profilePhotoName && (
                                <div className="text-xs text-slate-400 mt-1 truncate max-w-[180px]">{profilePhotoName}</div>
                              )}
                              {profilePhotoError && (
                                <div className="text-xs text-red-500 mt-1 max-w-[220px]">{profilePhotoError}</div>
                              )}
                              <div className="mt-2 flex items-center gap-2">
                                 <input 
                                    type="checkbox" 
                                    id="includePhoto" 
                                    checked={preferences?.photo} 
                                    onChange={e => setPreferences({...preferences!, photo: e.target.checked})} 
                                    className="rounded text-[#1a91f0] focus:ring-[#1a91f0]"
                                  />
                                 <label htmlFor="includePhoto" className="text-sm text-slate-600">Include photo</label>
                              </div>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase">First Name</label>
                             <input value={personalDetails.firstName} onChange={e => updatePersonalDetails('firstName', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm font-medium" placeholder="First Name" autoComplete="given-name" required />
                          </div>
                          <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase">Last Name</label>
                             <input value={personalDetails.lastName} onChange={e => updatePersonalDetails('lastName', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm font-medium" placeholder="Last Name" autoComplete="family-name" required />
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
                            <input type="email" value={personalDetails.email} onChange={e => updatePersonalDetails('email', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="email@example.com" autoComplete="email" required />
                         </div>
                         <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                            <input value={personalDetails.phone} onChange={e => updatePersonalDetails('phone', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="+1 (555) 000-0000" autoComplete="tel" required />
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase">Street Address</label>
                             <input value={personalDetails.address} onChange={e => updatePersonalDetails('address', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="e.g. 123 Main St" autoComplete="street-address" required />
                          </div>
                          <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase">Country</label>
                             <input
                               list="country-options"
                               value={personalDetails.country}
                               onChange={e => updatePersonalDetails('country', e.target.value)}
                               className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm"
                               placeholder={loadingCountries ? 'Loading countries...' : 'e.g. United States'}
                               autoComplete="country-name"
                               required
                             />
                             <datalist id="country-options">
                               {countries.map(country => (
                                 <option key={country} value={country} />
                               ))}
                             </datalist>
                          </div>
                      </div>

                      {locationError && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
                          {locationError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase">State / Region</label>
                             <input
                               list="state-options"
                               value={personalDetails.state}
                               onChange={e => updatePersonalDetails('state', e.target.value)}
                               className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm"
                               placeholder={loadingStates ? 'Loading states...' : 'e.g. CA'}
                               autoComplete="address-level1"
                               required
                             />
                             <datalist id="state-options">
                               {states.map(state => (
                                 <option key={state} value={state} />
                               ))}
                             </datalist>
                         </div>
                         <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">City</label>
                            <input
                              list="city-options"
                              value={personalDetails.city}
                              onChange={e => updatePersonalDetails('city', e.target.value)}
                              className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm"
                              placeholder={loadingCities ? 'Loading cities...' : 'e.g. San Francisco'}
                              autoComplete="address-level2"
                              required
                            />
                            <datalist id="city-options">
                              {cities.map(city => (
                                <option key={city} value={city} />
                              ))}
                            </datalist>
                         </div>
                         <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase">Zip / Postal Code</label>
                             <input
                               value={personalDetails.postalCode}
                               onChange={e => updatePersonalDetails('postalCode', e.target.value)}
                               className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm"
                               placeholder="e.g. 94105"
                               autoComplete="postal-code"
                               required
                             />
                         </div>
                      </div>
                  </div>
               </div>
               
               {/* Professional Summary */}
               <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                   <h2 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide">Professional Summary</h2>
                   <textarea 
                     value={personalDetails.summary} 
                     onChange={e => updatePersonalDetails('summary', e.target.value)}
                     className="w-full h-32 bg-[#f7f9fa] p-3 border border-slate-300 rounded text-sm leading-relaxed" 
                     placeholder="A brief overview of your career history and key achievements..."
                     required
                   />
               </div>

               {/* Experience */}
               <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                  <div className="flex justify-between items-end mb-4">
                      <div>
                          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Employment History</h2>
                      </div>
                  </div>
                  <div className="space-y-4">
                     {experiences.map((exp, idx) => (
                        <div key={exp.id} className="bg-[#f7f9fa] p-4 rounded border border-slate-200 relative group">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Job Title</label>
                                  <input value={exp.role} onChange={e => updateExperience(exp.id, 'role', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm font-medium" required />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Employer</label>
                                  <input value={exp.company} onChange={e => updateExperience(exp.id, 'company', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm" required />
                              </div>
                              <div className="md:col-span-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Dates</label>
                                  <input value={exp.dates} onChange={e => updateExperience(exp.id, 'dates', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="e.g. Jan 2022 - Present" required />
                              </div>
                           </div>
                           <div className="mb-2">
                               <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
                               <textarea value={exp.description} onChange={e => updateExperience(exp.id, 'description', e.target.value)} className="w-full h-20 bg-white p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="Achievements, responsibilities..." required />
                           </div>
                           {idx > 0 && <button type="button" onClick={() => removeExperience(exp.id)} className="text-red-400 text-xs hover:text-red-600">Remove</button>}
                        </div>
                     ))}
                     <button type="button" onClick={addExperience} className="text-[#1a91f0] font-semibold text-sm flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded transition-colors w-full justify-center">
                        + Add Employment
                     </button>
                  </div>
               </div>

               {/* Education */}
               <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Education</h2>
                  <div className="space-y-4">
                     {educations.map((edu, idx) => (
                        <div key={edu.id} className="bg-[#f7f9fa] p-4 rounded border border-slate-200 relative">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">School / University</label>
                                  <input value={edu.school} onChange={e => updateEducation(edu.id, 'school', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm" required />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Degree</label>
                                  <input value={edu.degree} onChange={e => updateEducation(edu.id, 'degree', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm" required />
                              </div>
                               <div className="md:col-span-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Dates</label>
                                  <input value={edu.dates} onChange={e => updateEducation(edu.id, 'dates', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm" required />
                              </div>
                           </div>
                           {idx > 0 && <button type="button" onClick={() => removeEducation(edu.id)} className="text-red-400 text-xs mt-2">Remove</button>}
                        </div>
                     ))}
                     <button type="button" onClick={addEducation} className="text-[#1a91f0] font-semibold text-sm flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded transition-colors w-full justify-center">
                        + Add Education
                     </button>
                  </div>
               </div>

               {/* Skills */}
               <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Skills</h2>
                  <div className="space-y-4">
                     {skills.map((skill, idx) => (
                        <div key={skill.id} className="flex gap-4 items-start">
                           <input value={skill.category} onChange={e => updateSkill(skill.id, 'category', e.target.value)} className="w-1/3 bg-slate-50 p-2 border border-slate-200 rounded text-sm font-medium" placeholder="Category" required />
                           <input value={skill.items} onChange={e => updateSkill(skill.id, 'items', e.target.value)} className="flex-1 bg-slate-50 p-2 border border-slate-200 rounded text-sm" placeholder="List skills..." required />
                           {idx > 0 && <button type="button" onClick={() => removeSkill(skill.id)} className="text-slate-400 hover:text-red-500 px-2">×</button>}
                        </div>
                     ))}
                     <button type="button" onClick={addSkill} className="text-[#1a91f0] font-semibold text-sm flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded transition-colors w-full justify-center">
                        + Add Skill
                     </button>
                  </div>
               </div>
            </>
          )}

          {activeTab === 'cover_letter' && (
              <div className="bg-white rounded border border-slate-200 p-8 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-800 mb-1">Target Job</h2>
                  <p className="text-sm text-slate-500 mb-4">Share a job URL or paste the description. We will use your live editor data to create and save a tailored cover letter.</p>
                  <div className="inline-flex rounded border border-slate-200 bg-slate-50 p-1 mb-4">
                    <button
                      type="button"
                      onClick={() => setJobSourceMode('url')}
                      className={`px-4 py-2 rounded text-sm font-semibold ${jobSourceMode === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                    >
                      Job URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobSourceMode('paste')}
                      className={`px-4 py-2 rounded text-sm font-semibold ${jobSourceMode === 'paste' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                    >
                      Paste Description
                    </button>
                  </div>
                  {jobSourceMode === 'url' ? (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Job Posting URL</label>
                      <input
                        value={jobUrl}
                        onChange={e => setJobUrl(e.target.value)}
                        className="mt-1 w-full p-4 bg-slate-50 border border-slate-200 rounded focus:border-[#1a91f0] outline-none text-sm"
                        placeholder="https://company.com/careers/software-engineer"
                        required={activeTab === 'cover_letter' && jobSourceMode === 'url'}
                      />
                      <p className="text-xs text-slate-500 mt-2">If the URL cannot be processed, you will see an error and can paste the job description instead.</p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Job Description</label>
                      <textarea
                          value={jobDescription}
                          onChange={e => setJobDescription(e.target.value)}
                          className="mt-1 w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded focus:border-[#1a91f0] outline-none text-sm leading-relaxed"
                          placeholder="Paste job description here so AI can tailor your cover letter..."
                          required={activeTab === 'cover_letter' && jobSourceMode === 'paste'}
                      />
                    </div>
                  )}
                  <div className="mt-4 bg-blue-50 text-blue-800 p-3 rounded text-sm border border-blue-100 flex items-start gap-2">
                     <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     <p>Created letters are saved under the Cover Letters menu with PDF download and delete actions.</p>
                  </div>
              </div>
          )}

          {/* Action Buttons */}
          {validationMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {validationMsg}
            </div>
          )}
          {activeTab === 'cover_letter' && coverLetterMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {coverLetterMsg}
            </div>
          )}

          <div className="pt-4 pb-20 space-y-3">
             <button
               type="submit"
               disabled={isLoading || isSavingResume}
               className={`w-full bg-slate-800 text-white text-lg font-bold px-12 py-4 rounded-lg shadow-lg transform transition hover:-translate-y-1 hover:shadow-xl flex items-center justify-center gap-2 ${(isLoading || isSavingResume) ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-700'}`}
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                {activeTab === 'create' ? (isSavingResume ? 'Saving...' : 'Save Resume') : (
                  isLoading ? 'Processing...' : (
                     activeTab === 'upload' ? 'Import to Live Editor' :
                     activeTab === 'cover_letter' ? (isSavingResume ? 'Generating...' : 'Generate & Save Cover Letter') :
                     'Save Resume'
                  )
                )}
             </button>

             {activeTab === 'create' && (
               <button
                 type="button"
                 onClick={requestNewResume}
                 disabled={isLoading || isSavingResume}
                 className={`w-full bg-white border border-slate-300 text-slate-800 text-lg font-bold px-12 py-4 rounded-lg shadow-sm transition hover:-translate-y-1 hover:shadow-md flex items-center justify-center gap-2 ${(isLoading || isSavingResume) ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-50'}`}
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" /></svg>
                 New Resume
               </button>
             )}

             {activeTab === 'create' && saveMsg && (
               <div className="text-sm text-center text-slate-600">{saveMsg}</div>
             )}

             <p className="text-xs text-center text-slate-400 mt-2">
               {activeTab === 'upload' ? 'Parses a PDF or Word resume and fills the editor so you can verify and customize.' :
                 activeTab === 'cover_letter' ? 'Create a tailored cover letter and cold email based on your resume.' :
                 'Saves your resume JSON to your library. Click Save again to update the same record.'}
             </p>
          </div>

        </form>
      </div>

      {/* --- RIGHT COLUMN: LIVE PREVIEW --- */}
      <div className="flex-1 mt-[1in] lg:sticky lg:top-[calc(6rem+1in)] self-start">
         <div className="bg-slate-200/50 rounded-xl border-2 border-slate-200 p-4 lg:p-8 flex flex-col items-center h-[78vh] lg:h-[calc(100vh-7rem)] min-h-[560px] max-h-[920px] no-print relative">
            <div className="w-full flex justify-between items-center mb-6 max-w-[210mm] flex-shrink-0">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                 Live Preview
               </h3>
               <button 
                 type="button"
                 onClick={handleDownloadPdf}
                 disabled={isDownloadingPdf}
                 className={`bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 transition-colors ${isDownloadingPdf ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-700'}`}
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 {isDownloadingPdf ? 'Generating...' : 'Download PDF'}
               </button>
            </div>
            
            {/* The Resume Document Component - Wrapped in its own scroll viewport */}
            <div className="w-full flex-1 min-h-0 overflow-auto pb-4 flex justify-center custom-scrollbar">
                <div className="transform origin-top transition-transform duration-200 scale-[0.55] sm:scale-[0.7] md:scale-[0.85] xl:scale-100">
                    <LivePreview data={currentData} user={user} templateId={selectedTemplateId} />
                </div>
            </div>

            <div className="mt-4 text-[10px] text-slate-400 text-center max-w-md flex-shrink-0">
               {pdfMsg || 'Tip: This preview scrolls independently. The downloaded PDF is generated from the full-size A4 resume.'}
            </div>
         </div>
         
         {/* Full-size export target for client-side PDF generation. It is not displayed or printed. */}
         <div
            ref={resumeExportRef}
            aria-hidden="true"
            className="absolute top-0 bg-white pointer-events-none overflow-visible"
            style={{ left: '-10000px', width: '210mm', minHeight: '297mm', height: 'auto', overflow: 'visible' }}
         >
            <LivePreview data={currentData} user={user} templateId={selectedTemplateId} />
         </div>
      </div>
    {showNewResumeConfirm && (
      <ConfirmNewResumeModal
        onCancel={() => setShowNewResumeConfirm(false)}
        onConfirm={() => {
          setShowNewResumeConfirm(false);
          resetToNewResume();
        }}
      />
    )}

    </div>
  );
};

export default ResumeInput;
