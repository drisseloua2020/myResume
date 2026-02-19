export enum AppMode {
  FORMAT_EXISTING = 'MODE_A',
  CREATE_SCRATCH = 'MODE_B',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum SubscriptionPlan {
  FREE = 'PLAN_FREE',
  MONTHLY = 'PLAN_MONTHLY',
  YEARLY = 'PLAN_YEARLY',
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // In a real app, never store plain text. This is a mock.
  role: UserRole;
  plan: SubscriptionPlan;
  status: 'Active' | 'Canceled';
  createdAt: string;
  paidAmount: string;
  authProvider?: 'email' | 'google' | 'linkedin' | 'microsoft' | 'github';
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  details?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  color: string;
  tag: string;
}

// Structured Inputs for Mode B
export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  dates: string;
  description: string;
}

export interface EducationItem {
  id: string;
  degree: string;
  school: string;
  dates: string;
}

export interface SkillItem {
  id: string;
  category: string; // e.g. "Languages", "Technical", "Soft Skills"
  items: string;
}

export interface PersonalDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  summary: string;
}

export interface UserInputData {
  role: UserRole;
  plan: SubscriptionPlan;
  templateId?: string; // Added template selection
  currentResumeText?: string;
  fileData?: {
    mimeType: string;
    data: string; // Base64 encoded string
  };
  // Profile Photo
  profileImageData?: {
    mimeType: string;
    data: string;
  };
  jobDescription?: string;
  targetRole?: string;
  
  // New specific personal details
  personalDetails?: PersonalDetails;

  // Structured Data for Mode B
  experienceItems?: ExperienceItem[];
  educationItems?: EducationItem[];
  skillItems?: SkillItem[];

  preferences?: {
    pages: '1-page' | '2-page';
    tone: 'conservative' | 'modern' | 'bold';
    region: 'US' | 'EU';
    photo: boolean;
  };
}

export interface ParsedResponse {
  json?: any;
  gapAndFix?: string[];
  resumeAts?: string;
  resumeHuman?: string;
  resumeTargeted?: string;
  resumePhoto?: string;
  coverLetterFull?: string;
  coverLetterShort?: string;
  coldEmail?: string;
  raw?: string;
}

export interface SectionContent {
  title: string;
  content: string;
}

// --- Agent / Auto-Update Types ---
export interface DataSource {
  id: string;
  name: 'LinkedIn' | 'GitHub' | 'Portfolio' | 'University Portal';
  icon: string;
  isConnected: boolean;
  lastSync: string | null;
}

export interface AgentUpdate {
  id: string;
  source: string;
  type: 'Education' | 'Project' | 'Certification' | 'Experience';
  title: string;
  description: string;
  dateFound: string;
  status: 'pending' | 'approved' | 'rejected';
}