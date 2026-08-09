import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ResumeInput from './components/ResumeInput';
import ResultsDisplay from './components/ResultsDisplay';
import ResumeLibraryPage from './components/ResumeLibraryPage';
import CoverLettersPage from './components/CoverLettersPage';
import ProfileSyncPage from './components/ProfileSyncPage';
import AdminActivityLogsPage from './components/AdminActivityLogsPage';
import AdminAgentUpdatesPage from './components/AdminAgentUpdatesPage';
import AdminContactMessagesPage from './components/AdminContactMessagesPage';
import AdminUsersPage from './components/AdminUsersPage';
import AdminResumesPage from './components/AdminResumesPage';
import AuthScreen from './components/AuthScreen';
import ContactPage from './components/ContactPage';
import AccountSettings from './components/AccountSettings';
import TemplateSelector from './components/TemplateSelector';
import CareerBlogPage from './components/CareerBlogPage';
import ResumeGuidePage from './components/ResumeGuidePage';
import ResumeExamplesPage from './components/ResumeExamplesPage';
import AgentReviewModal from './components/AgentReviewModal';
import ConfirmNewResumeModal from './components/ConfirmNewResumeModal';
import { generateResumeContent } from './services/geminiService';
import { authService } from './services/authService';
import { setSession, clearSession, SESSION_EXPIRED_EVENT } from './services/apiClient';
import { getOAuthBackendCallbackRedirect, isOAuthCallbackPath } from './services/oauthRedirect';
import { agentService } from './services/agentService';
import { saveDraft, getLatestDraft, getLatestResume, saveResume } from './services/resumeService';
import type { ResumeRecord } from './services/resumeService';
import { AppMode, UserInputData, ParsedResponse, UserRole, User, SubscriptionPlan, AgentUpdate, ExperienceItem, EducationItem, SkillItem, PersonalDetails } from './types';

const IMPORT_TEXT_CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

const cleanImportedText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(IMPORT_TEXT_CONTROL_CHARS, '').replace(/\u00a0/g, ' ').trim();
};

const firstImportedText = (...values: unknown[]): string => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = firstImportedText(...value);
      if (nested) return nested;
      continue;
    }
    const text = cleanImportedText(value);
    if (text) return text;
  }
  return '';
};

const normalizeImportedKey = (key: string): string => (
  key.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
);

const importedField = (source: any, keys: string[]): unknown => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }
  const normalizedKeys = new Set(keys.map(normalizeImportedKey));
  for (const [key, value] of Object.entries(source)) {
    if (normalizedKeys.has(normalizeImportedKey(key))) {
      return value;
    }
  }
  return undefined;
};

const importedObjectField = (source: any, keys: string[]): Record<string, unknown> => {
  const value = importedField(source, keys);
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
};

const IMPORTED_RECORD_VALUE_KEYS = [
  'role',
  'title',
  'position',
  'jobTitle',
  'job_title',
  'company',
  'employer',
  'degree',
  'qualification',
  'credential',
  'school',
  'institution',
  'category',
  'items',
  'bullet',
  'text',
  'description',
  'achievement',
  'responsibility',
];

const importedValues = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(/\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value && typeof value === 'object') {
    if (IMPORTED_RECORD_VALUE_KEYS.some((key) => importedField(value, [key]) !== undefined)) {
      return [value];
    }
    return Object.values(value);
  }
  return [];
};

const cleanImportedListItem = (value: unknown): string => {
  const source = value && typeof value === 'object'
    ? firstImportedText(
      importedField(value, [
        'bullet',
        'description',
        'text',
        'achievement',
        'responsibility',
        'duty',
        'name',
        'value',
        'skill',
        'item',
        'label',
        'items',
      ]),
    )
    : cleanImportedText(value);
  return source.replace(/^[\s,;\-*\u2022\u00b7]+/, '').replace(/[\s,;]+$/, '').trim();
};

const importedBulletLines = (...sources: unknown[]): string => {
  const lines = sources
    .flatMap(importedValues)
    .map(cleanImportedListItem)
    .filter(Boolean);

  if (lines.length > 0) {
    return lines.map((line) => `- ${line}`).join('\n');
  }

  return cleanImportedListItem(firstImportedText(...sources));
};

const importedDateRange = (value: any): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const explicit = firstImportedText(
    importedField(value, ['dates', 'dateRange', 'date_range', 'date range', 'period', 'date', 'years', 'duration', 'tenure'])
  );
  if (explicit) return explicit;

  const start = firstImportedText(importedField(value, ['start', 'startDate', 'start_date', 'start date', 'from']));
  const end = firstImportedText(importedField(value, ['end', 'endDate', 'end_date', 'end date', 'to', 'through']));
  return start && end ? `${start} - ${end}` : start || end;
};

const splitImportedCommaList = (items: unknown[]): string[] => {
  const values: string[] = [];
  items.forEach((item) => {
    const raw = cleanImportedListItem(item);
    raw
      .split(/[,|/]/)
      .map((part) => cleanImportedListItem(part))
      .filter(Boolean)
      .forEach((part) => {
        if (!values.includes(part)) values.push(part);
      });
  });
  return values;
};

type ImportedAddressParts = Pick<PersonalDetails, 'address' | 'city' | 'state' | 'country' | 'postalCode'>;

const EMPTY_IMPORTED_ADDRESS: ImportedAddressParts = {
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
};

const IMPORTED_POSTAL_CODE_RE = /\b([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{4,6}(?:-\d{4})?)\b/i;
const IMPORTED_STREET_RE = /(?:^\d+\s+|\b(?:apt|apartment|ave|avenue|blvd|boulevard|building|ct|court|dr|drive|floor|ln|lane|pkwy|parkway|pl|place|rd|road|ste|suite|st|street|unit|way)\b)/i;

const mergeImportedAddressParts = (...items: ImportedAddressParts[]): ImportedAddressParts => (
  items.reduce<ImportedAddressParts>((merged, item) => ({
    address: merged.address || item.address,
    city: merged.city || item.city,
    state: merged.state || item.state,
    country: merged.country || item.country,
    postalCode: merged.postalCode || item.postalCode,
  }), { ...EMPTY_IMPORTED_ADDRESS })
);

const parseImportedAddressObject = (value: unknown): ImportedAddressParts => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_IMPORTED_ADDRESS };
  const source = value as any;
  return {
    address: firstImportedText(
      importedField(source, ['streetAddress', 'street_address', 'addressLine1', 'address_line_1', 'address1', 'street'])
    ),
    city: firstImportedText(importedField(source, ['city', 'town', 'municipality'])),
    state: firstImportedText(importedField(source, ['state', 'province', 'region', 'stateRegion', 'state_region'])),
    country: firstImportedText(importedField(source, ['country'])),
    postalCode: firstImportedText(importedField(source, ['postalCode', 'postal_code', 'zip', 'zipCode', 'zip_code'])),
  };
};

const parseImportedAddressText = (value: unknown): ImportedAddressParts => {
  const addressText = cleanImportedText(value);
  if (!addressText) return { ...EMPTY_IMPORTED_ADDRESS };

  const parts = addressText.split(',').map((part) => part.trim()).filter(Boolean);
  const address = parts[0] && IMPORTED_STREET_RE.test(parts[0]) ? parts[0] : '';
  const locationParts = address ? parts.slice(1) : parts;

  if (locationParts.length === 0) {
    return { ...EMPTY_IMPORTED_ADDRESS, address };
  }

  if (locationParts.length === 1) {
    const single = locationParts[0];
    const postalMatch = single.match(IMPORTED_POSTAL_CODE_RE);
    const postalCode = postalMatch?.[1] || '';
    const withoutPostal = postalCode ? single.replace(postalCode, '').trim() : single;
    const cityStateMatch = withoutPostal.match(/^(.+?)\s+([A-Z]{2})$/i);

    if (cityStateMatch) {
      return {
        address,
        city: cityStateMatch[1].trim(),
        state: cityStateMatch[2].trim(),
        country: '',
        postalCode,
      };
    }

    return {
      address,
      city: IMPORTED_STREET_RE.test(single) ? '' : withoutPostal,
      state: '',
      country: '',
      postalCode,
    };
  }

  const city = locationParts[0] || '';
  const statePostal = locationParts[1] || '';
  const country = locationParts.length > 2 ? locationParts.slice(2).join(', ') : '';
  const postalMatch = statePostal.match(IMPORTED_POSTAL_CODE_RE);
  const postalCode = postalMatch?.[1] || '';
  const state = statePostal.replace(postalCode, '').trim();

  return { address, city, state, country, postalCode };
};

const parseImportedAddress = (value: unknown): ImportedAddressParts => (
  mergeImportedAddressParts(parseImportedAddressObject(value), parseImportedAddressText(value))
);

const DEFAULT_IMPORTED_TEMPLATE_ID = 'classic_pro';

const computeImportedResumeTitle = (content: Partial<UserInputData>): string => {
  const firstName = cleanImportedText(content.personalDetails?.firstName);
  const lastName = cleanImportedText(content.personalDetails?.lastName);
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  const role = cleanImportedText(content.targetRole) || cleanImportedText(content.experienceItems?.[0]?.role);

  const title = name && role
    ? `${name} - ${role}`
    : name
      ? `${name} Resume`
      : role
        ? `Resume - ${role}`
        : 'Imported Resume';

  return title.slice(0, 200);
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('workspace');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [results, setResults] = useState<ParsedResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatorTab, setGeneratorTab] = useState<'create' | 'upload' | 'cover_letter'>('create');

  // State to hold imported data for the editor
  const [editorData, setEditorData] = useState<Partial<UserInputData> | null>(null);
  const [loadedResumeId, setLoadedResumeId] = useState<string | null>(null);
  const [loadedResumeTitle, setLoadedResumeTitle] = useState<string | null>(null);
  const initialResumeLoadUserRef = useRef<string | null>(null);


  // Global handler: if API returns 401, disconnect user and return to home page.
  useEffect(() => {
    const onSessionExpired = () => {
      // Avoid calling backend logout here (token is invalid/expired). Just clear local state.
      try {
        clearSession();
      } catch {
        // ignore
      }
      setError(null);
      setResults(null);
      setEditorData(null);
      setLoadedResumeId(null);
      setLoadedResumeTitle(null);
      initialResumeLoadUserRef.current = null;
      setSelectedTemplateId(undefined);
      setAgentUpdates([]);
      setShowAgentModal(false);
      setShowNewResumeConfirm(false);
      setGeneratorTab('create');
      setActiveTab('workspace');
      // Force editor remount next time user logs in
      setWorkspaceResetKey((k) => k + 1);
      setCurrentUser(null);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired as any);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired as any);
    };
  }, []);

  // Agent State
  const [agentUpdates, setAgentUpdates] = useState<AgentUpdate[]>([]);
  const [showAgentModal, setShowAgentModal] = useState<boolean>(false);
  const [showNewResumeConfirm, setShowNewResumeConfirm] = useState(false);
  const [workspaceResetKey, setWorkspaceResetKey] = useState(0);

  const openResumeInWorkspace = (resume: ResumeRecord) => {
    const resumeContent = resume.content && typeof resume.content === 'object' && !Array.isArray(resume.content)
      ? resume.content as Partial<UserInputData>
      : {};

    setResults(null);
    setError(null);
    setSelectedTemplateId(resume.templateId);
    setEditorData({ ...resumeContent, templateId: resume.templateId });
    setLoadedResumeId(resume.id);
    setLoadedResumeTitle(resume.title);
    setGeneratorTab('create');
    setActiveTab('workspace');
    setWorkspaceResetKey((k) => k + 1);
  };

  const startNewResume = () => {
    setShowNewResumeConfirm(false);
    setResults(null);
    setError(null);
    setEditorData(null);
    setLoadedResumeId(null);
    setLoadedResumeTitle(null);
    setSelectedTemplateId(undefined);
    setGeneratorTab('create');
    setActiveTab('templates');
    setWorkspaceResetKey((k) => k + 1);
  };

  // Load the newest saved resume when a user lands in the editor.
  // If the user has no saved resume yet, fall back to the last autosaved draft.
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin') return;
    if (activeTab !== 'workspace') return;
    if (editorData) return;
    if (initialResumeLoadUserRef.current === currentUser.id) return;

    let cancelled = false;
    initialResumeLoadUserRef.current = currentUser.id;

    (async () => {
      try {
        const latestResume = await getLatestResume();
        if (cancelled) return;

        if (latestResume) {
          openResumeInWorkspace(latestResume);
          return;
        }

        const draft = await getLatestDraft(selectedTemplateId);
        if (cancelled) return;

        if (draft?.content) {
          const draftContent = draft.content && typeof draft.content === 'object' && !Array.isArray(draft.content)
            ? draft.content as Partial<UserInputData>
            : {};
          const templateId = draft.templateId || selectedTemplateId;
          setSelectedTemplateId(templateId);
          setEditorData({ ...draftContent, templateId });
          setLoadedResumeId(null);
          setLoadedResumeTitle(null);
          setWorkspaceResetKey((k) => k + 1);
        }
      } catch {
        // Workspace can still start empty if the saved-resume lookup fails.
        initialResumeLoadUserRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, activeTab, editorData, selectedTemplateId]);

  // Check for existing session on load
  useEffect(() => {
    const backendCallbackRedirect = getOAuthBackendCallbackRedirect(window.location);
    if (backendCallbackRedirect) {
      window.location.replace(backendCallbackRedirect);
      return;
    }

    // OAuth callback: backend redirects to frontend with ?token=JWT
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const templateIdFromOAuth = params.get('templateId') || undefined;
    if (token) {
      // cache token temporarily, then refresh user
      setSession(token, { id: '', name: '', email: '', role: 'user', plan: 'free', paidAmount: '$0.00', status: 'Active' });
      authService.refreshMe()
        .then((u) => {
          if (u) {
            setCurrentUser(u);
            if (templateIdFromOAuth) {
              setSelectedTemplateId(templateIdFromOAuth);
              setActiveTab('workspace');
              setGeneratorTab('create');
            }
            checkAgentUpdates();
          }
        })
        .finally(() => {
          const cleanPath = isOAuthCallbackPath(window.location.pathname) ? '/' : window.location.pathname;
          window.history.replaceState({}, document.title, cleanPath);
        });
      return;
    }

    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      // Simulate Agent checking for updates on load (simulate email link opening app)
      checkAgentUpdates();
    }
  }, []);

  const checkAgentUpdates = async () => {
    // In real world, this happens in bg, here we simulate a fetch
    const updates = await agentService.checkForUpdates();
    setAgentUpdates(updates);
  };

  const handleLogin = (user: User, initialTemplateId?: string) => {
    setCurrentUser(user);
    setResults(null);
    setEditorData(null);
    setLoadedResumeId(null);
    setLoadedResumeTitle(null);
    initialResumeLoadUserRef.current = null;
    if (user.role === 'admin') {
      setActiveTab('admin_logs');
      return;
    }
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId);
      setActiveTab('workspace');
      setGeneratorTab('create');
      return;
    }

    // Default landing for users is the editor.
    setActiveTab('workspace');
    // Trigger agent check after login
    checkAgentUpdates();
  };

  const handleLogout = () => {
    // Best-effort backend logout (audit), then clear local session.
    void authService.logout();
    setCurrentUser(null);
    setSelectedTemplateId(undefined);
    setResults(null);
    setEditorData(null);
    setLoadedResumeId(null);
    setLoadedResumeTitle(null);
    initialResumeLoadUserRef.current = null;
    setAgentUpdates([]);
    setWorkspaceResetKey((k) => k + 1);
  };

  const handlePlanUpdate = (newPlan: SubscriptionPlan) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, plan: newPlan });
    }
  };

  const handleGenerate = async (data: UserInputData, mode: AppMode) => {
    if (!currentUser) return;

    setIsLoading(true);
    setError(null);
    try {
      // Ensure workspace state is persisted before AI processing
      await saveDraft({ templateId: data.templateId || selectedTemplateId, content: { ...data, templateId: data.templateId || selectedTemplateId } });
      authService.logActivity(currentUser.id, currentUser.name, 'RESUME_GENERATE', `Mode: ${mode}, Template: ${data.templateId || 'None'}`);
      const parsedResults = await generateResumeContent(data, mode);
      setResults(parsedResults);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper to map JSON to State
  const mapJsonToState = (json: any): Partial<UserInputData> => {
      if (!json) return {};

      const parsedResumeJson = importedField(json, ['RESUME_JSON', 'resume_json', 'resumeJson', 'resume json', 'parsedResumeJson', 'parsed_resume_json', 'resume']);
      const resumeJson = parsedResumeJson && typeof parsedResumeJson === 'object' && !Array.isArray(parsedResumeJson)
        ? parsedResumeJson as Record<string, unknown>
        : json;
      const header = importedObjectField(resumeJson, [
        'header',
        'personalDetails',
        'personal_details',
        'personal',
        'candidate',
        'candidateInfo',
        'candidate_info',
        'contactDetails',
        'contact_details',
      ]);
      const headerContact = importedObjectField(header, ['contact', 'contactInfo', 'contact_info', 'contactDetails', 'contact_details']);
      const rootContact = importedObjectField(resumeJson, ['contact', 'contactInfo', 'contact_info', 'contactDetails', 'contact_details']);
      const contact = Object.keys(headerContact).length > 0 ? headerContact : rootContact;
      const experienceSource = importedValues(
        importedField(resumeJson, [
          'experience',
          'experiences',
          'workExperience',
          'work_experience',
          'work experience',
          'professionalExperience',
          'professional_experience',
          'professional experience',
          'employment',
          'employmentHistory',
          'employment_history',
          'workHistory',
          'work_history',
          'careerHistory',
          'career_history',
          'positions',
          'jobs',
        ])
      );
      const educationSource = importedValues(
        importedField(resumeJson, [
          'education',
          'educations',
          'academicBackground',
          'academic_background',
          'academic background',
          'educationAndTraining',
          'education_and_training',
          'schools',
          'training',
        ])
      );
      
      const experiences: ExperienceItem[] = experienceSource
        .map((exp: any) => ({
            id: Math.random().toString(),
            role: firstImportedText(importedField(exp, [
              'role',
              'title',
              'position',
              'positionTitle',
              'position_title',
              'jobTitle',
              'job_title',
              'job title',
              'designation',
            ])),
            company: firstImportedText(importedField(exp, [
              'company',
              'employer',
              'employerName',
              'employer_name',
              'organization',
              'organisation',
              'organizationName',
              'organization_name',
              'organisationName',
              'companyName',
              'company_name',
              'workplace',
              'client',
            ])),
            dates: importedDateRange(exp),
            description: importedBulletLines(
              importedField(exp, ['highlights', 'bullets', 'bullet_points', 'achievements', 'accomplishments']),
              importedField(exp, ['responsibilities', 'responsibility', 'duties']),
              importedField(exp, ['description', 'details', 'summary']),
            ),
        }))
        .filter((exp) => exp.role || exp.company || exp.dates || exp.description);

      const educations: EducationItem[] = educationSource
        .map((edu: any) => ({
            id: Math.random().toString(),
            degree: firstImportedText(importedField(edu, [
              'degree',
              'program',
              'qualification',
              'credential',
              'certificate',
              'course',
              'fieldOfStudy',
              'field_of_study',
              'title',
            ])),
            school: firstImportedText(importedField(edu, [
              'school',
              'institution',
              'institutionName',
              'institution_name',
              'university',
              'college',
              'organization',
              'organisation',
              'academy',
            ])),
            dates: importedDateRange(edu)
        }))
        .filter((edu) => edu.degree || edu.school || edu.dates);

      const skills: SkillItem[] = [];
      const skillSource = importedField(resumeJson, [
        'skills',
        'skillItems',
        'skill_items',
        'technicalSkills',
        'technical_skills',
        'technical skills',
        'coreCompetencies',
        'core_competencies',
        'competencies',
        'technologies',
        'tools',
        'toolsAndTechnologies',
        'tools_and_technologies',
      ]);
      const pushSkillGroup = (category: string, items: unknown) => {
        const cleanItems = splitImportedCommaList(importedValues(items));
        if (cleanItems.length === 0) return;
        const label = cleanImportedText(category).replace(/_/g, ' ');
        skills.push({
            id: Math.random().toString(),
            category: label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Core',
            items: cleanItems.join(', ')
        });
      };

      if (Array.isArray(skillSource) && skillSource.some((item) => item && typeof item === 'object' && !Array.isArray(item) && importedField(item, ['items', 'skills', 'values', 'technologies']))) {
        skillSource.forEach((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return;
          pushSkillGroup(
            firstImportedText(importedField(item, ['category', 'name', 'label', 'title'])) || 'Core',
            importedField(item, ['items', 'skills', 'values', 'technologies']),
          );
        });
      } else if (Array.isArray(skillSource) || typeof skillSource === 'string') {
        pushSkillGroup('Core', skillSource);
      } else if (skillSource && typeof skillSource === 'object') {
        const directSkillItems = importedField(skillSource, ['items', 'skills', 'values', 'technologies']);
        if (directSkillItems !== undefined) {
          pushSkillGroup(
            firstImportedText(importedField(skillSource, ['category', 'name', 'label', 'title'])) || 'Core',
            directSkillItems,
          );
        } else {
          Object.entries(skillSource).forEach(([category, items]) => pushSkillGroup(category, items));
        }
      }

      const location = mergeImportedAddressParts(
        parseImportedAddress(header),
        parseImportedAddress(resumeJson),
        parseImportedAddress(importedField(header, ['location', 'currentLocation', 'current_location', 'current location'])),
        parseImportedAddress(importedField(resumeJson, ['location', 'currentLocation', 'current_location', 'current location'])),
        parseImportedAddress(importedField(header, ['address', 'mailingAddress', 'mailing_address', 'mailing address'])),
        parseImportedAddress(importedField(resumeJson, ['address', 'mailingAddress', 'mailing_address', 'mailing address'])),
      );

      // Extract Name
      const fullName = firstImportedText(
        importedField(header, ['name', 'fullName', 'full_name', 'full name', 'candidateName', 'candidate_name']),
        importedField(contact, ['name', 'fullName', 'full_name', 'full name', 'candidateName', 'candidate_name']),
        importedField(resumeJson, ['name', 'fullName', 'full_name', 'full name', 'candidateName', 'candidate_name']),
      );
      const nameParts = fullName.split(' ').filter(Boolean);
      const firstName = firstImportedText(
        importedField(header, ['firstName', 'first_name', 'first name', 'givenName', 'given_name']),
        importedField(contact, ['firstName', 'first_name', 'first name', 'givenName', 'given_name']),
      ) || nameParts[0] || '';
      const lastName = firstImportedText(
        importedField(header, ['lastName', 'last_name', 'last name', 'familyName', 'family_name', 'surname']),
        importedField(contact, ['lastName', 'last_name', 'last name', 'familyName', 'family_name', 'surname']),
      ) || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
      const targetRole = firstImportedText(
        importedField(header, ['title', 'role', 'headline', 'professionalTitle', 'professional_title', 'jobTitle', 'job_title']),
        importedField(resumeJson, ['targetRole', 'target_role', 'target role', 'title', 'role', 'headline', 'professionalTitle', 'professional_title']),
        experiences[0]?.role,
      );

      const personalDetails: PersonalDetails = {
          firstName: firstName,
          lastName: lastName,
          email: firstImportedText(importedField(header, ['email', 'emailAddress', 'email_address']), importedField(contact, ['email', 'emailAddress', 'email_address']), importedField(resumeJson, ['email', 'emailAddress', 'email_address'])),
          phone: firstImportedText(importedField(header, ['phone', 'telephone', 'mobile', 'cell', 'cellPhone', 'cell_phone']), importedField(contact, ['phone', 'telephone', 'mobile', 'cell', 'cellPhone', 'cell_phone']), importedField(resumeJson, ['phone', 'telephone', 'mobile', 'cell', 'cellPhone', 'cell_phone'])),
          address: firstImportedText(
            importedField(header, ['streetAddress', 'street_address', 'street address', 'addressLine1', 'address_line_1', 'address 1']),
            importedField(contact, ['streetAddress', 'street_address', 'street address', 'addressLine1', 'address_line_1', 'address 1']),
            location.address,
          ),
          city: location.city,
          state: location.state,
          country: location.country,
          postalCode: location.postalCode,
          summary: firstImportedText(importedField(resumeJson, ['summary', 'profile', 'professionalSummary', 'professional_summary', 'professional summary', 'objective', 'about']))
      };

      return {
          targetRole,
          preferences: {
            pages: '1-page',
            tone: 'modern',
            region: 'US',
            photo: false,
          },
          profileImageUrl: undefined,
          profileImageName: undefined,
          profileImageData: undefined,
          personalDetails: personalDetails,
          experienceItems: experiences,
          educationItems: educations,
          skillItems: skills,
      };
  };

  const handleImport = async (data: UserInputData) => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
        authService.logActivity(currentUser.id, currentUser.name, 'RESUME_PARSE', 'Importing document to Editor');
        // We use FORMAT_EXISTING mode to parse the uploaded document.
        const parsedResults = await generateResumeContent(data, AppMode.FORMAT_EXISTING);
        
        if (parsedResults.json) {
            const mappedData = mapJsonToState(parsedResults.json);
            const templateId = selectedTemplateId || data.templateId || DEFAULT_IMPORTED_TEMPLATE_ID;
            const importedContent: UserInputData = {
              role: data.role,
              plan: data.plan,
              jobDescription: data.jobDescription,
              jobUrl: data.jobUrl,
              ...mappedData,
              templateId,
            };
            const importedTitle = computeImportedResumeTitle(importedContent);
            const saved = await saveResume({
              templateId,
              title: importedTitle,
              content: importedContent,
            });
            setSelectedTemplateId(templateId);
            setEditorData(mappedData);
            setLoadedResumeId(saved.id);
            setLoadedResumeTitle(importedTitle);
            setWorkspaceResetKey((k) => k + 1);
            // Persist imported result as the latest draft (workspace state)
            await saveDraft({
              templateId,
              content: importedContent,
            });
            // Switch to Create tab to show the editor
            setGeneratorTab('create');
            // Ensure no results overlay is showing
            setResults(null);
        } else {
            throw new Error("Could not parse resume data structure.");
        }
    } catch (err: any) {
        setError(err.message || "Failed to import resume.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setActiveTab('workspace');
    setGeneratorTab('create');
  };

  // Agent Modal Handlers
  const handleAgentApprove = (id: string) => {
    setAgentUpdates(prev => prev.map(u => u.id === id ? { ...u, status: 'approved' } : u));
    // In a real app, this would inject data into the ResumeInput state
    // For visual feedback only in this demo:
    alert("Content added to your profile! (Simulation)");
  };

  const handleAgentReject = (id: string) => {
    setAgentUpdates(prev => prev.map(u => u.id === id ? { ...u, status: 'rejected' } : u));
  };

  // If no user is logged in, show Auth Screen
  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const renderContent = () => {
    // NOTE: The editor is the primary resume creation experience.
    // Dashboard is kept for legacy/demo but not shown in user tabs.

    if (activeTab === 'templates') {
       return (
          <div className="max-w-7xl mx-auto py-12 px-6 text-center">
             <h2 className="text-3xl font-bold text-slate-800 mb-4">Choose a Template</h2>
             <p className="text-slate-500 mb-12">Select a style for your new resume.</p>
             <TemplateSelector onSelect={handleTemplateSelect} selectedId={selectedTemplateId} />
             <button 
               onClick={() => setActiveTab('workspace')} 
               className="mt-12 text-slate-400 hover:text-slate-600 underline"
             >
               Cancel
             </button>
          </div>
       );
    }

    if (activeTab === 'career_blog') {
      return <CareerBlogPage onBack={() => setActiveTab('workspace')} />;
    }

    if (activeTab === 'resume_guide') {
      return <ResumeGuidePage onBack={() => setActiveTab('workspace')} />;
    }

    if (activeTab === 'resume_examples') {
      return (
        <ResumeExamplesPage
          onBack={() => setActiveTab('workspace')}
          onChooseTemplate={(templateId) => {
            setSelectedTemplateId(templateId);
            setActiveTab('workspace');
            setGeneratorTab('create');
          }}
        />
      );
    }

    if (activeTab === 'cover_letters') {
      return (
        <div className="max-w-6xl mx-auto py-8 px-6">
          <CoverLettersPage />
        </div>
      );
    }

    if (activeTab === 'resumes') {
      return (
        <div className="max-w-6xl mx-auto py-8 px-6">
          <ResumeLibraryPage onLoadResume={openResumeInWorkspace} user={currentUser} />
        </div>
      );
    }

    if (activeTab === 'profile_sync') {
      return (
        <div className="max-w-6xl mx-auto py-8 px-6">
          <ProfileSyncPage />
        </div>
      );
    }

    if (activeTab === 'admin_logs') {
      return <AdminActivityLogsPage />;
    }
    if (activeTab === 'admin_agents') {
      return <AdminAgentUpdatesPage />;
    }
    if (activeTab === 'admin_contacts') {
      return <AdminContactMessagesPage />;
    }
    if (activeTab === 'admin_users') {
      return <AdminUsersPage />;
    }
    if (activeTab === 'admin_resumes') {
      return <AdminResumesPage />;
    }

    if (activeTab === 'contact') {
      return (
        <ContactPage user={currentUser} />
      );
    }

    if (activeTab === 'account') {
      return (
        <div className="max-w-4xl mx-auto py-8 px-6">
            <AccountSettings 
            user={currentUser} 
            onPlanUpdate={handlePlanUpdate} 
            />
        </div>
      );
    }

    if (results) {
      return <ResultsDisplay results={results} templateId={selectedTemplateId} onReset={() => setResults(null)} />;
    }

    if (activeTab !== 'workspace') {
      // Fallback to editor.
      setActiveTab('workspace');
      return null;
    }

    // Editor View - FULL WIDTH for Split Screen
    return (
      <div className="w-full px-4 lg:px-8 py-8 space-y-4">
        <ResumeInput 
          key={`resume-input-${workspaceResetKey}`}
          onGenerate={handleGenerate} 
          onImport={handleImport}
          onTemplateChange={setSelectedTemplateId}
          onNewResume={() => setShowNewResumeConfirm(true)}
          onDraftChange={async (draft) => {
            // Persist workspace edits as the user types
            await saveDraft({ templateId: draft.templateId ?? selectedTemplateId, content: draft });
          }}
          prefilledData={editorData}
          isLoading={isLoading} 
          role={currentUser.role}
          userPlan={currentUser.plan}
          selectedTemplateId={selectedTemplateId}
          user={currentUser}
          initialTab={generatorTab}
          loadedResumeId={loadedResumeId}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f9fa] flex flex-col font-sans text-slate-900">
      <Header 
        currentUser={currentUser} 
        onLogout={handleLogout}
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <main className="flex-1">
        {error && (
          <div className="max-w-4xl mx-auto mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-3">
             <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             {error}
          </div>
        )}
        {renderContent()}
      </main>

      {/* New Resume Confirmation Modal */}
      {showNewResumeConfirm && (
        <ConfirmNewResumeModal
          onCancel={() => setShowNewResumeConfirm(false)}
          onConfirm={startNewResume}
        />
      )}

      {/* Agent Review Modal */}
      {showAgentModal && (
        <AgentReviewModal 
          updates={agentUpdates} 
          onClose={() => setShowAgentModal(false)}
          onApprove={handleAgentApprove}
          onReject={handleAgentReject}
        />
      )}
    </div>
  );
};

export default App;
