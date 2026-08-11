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
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  isPresent?: boolean;
  description: string;
}

export interface EducationItem {
  id: string;
  degree: string;
  school: string;
  location?: string;
  dates: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
}

export interface SkillItem {
  id: string;
  category: string; // e.g. "Languages", "Technical", "Soft Skills"
  items: string;
}

export interface AdditionalSectionItem {
  id: string;
  title: string;
  items: string;
}

export interface PersonalDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  links?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  summary: string;
}

export interface UserInputData {
  role: UserRole;
  plan: SubscriptionPlan;
  templateId?: string; // Added template selection
  importFormat?: 'ats';
  currentResumeText?: string;
  fileData?: {
    mimeType: string;
    data: string; // Base64 encoded string
    name?: string;
  };
  // Profile Photo
  profileImageUrl?: string;
  profileImageName?: string;
  profileImageData?: {
    mimeType: string;
    data: string;
  };
  jobDescription?: string;
  jobUrl?: string;
  targetRole?: string;
  
  // New specific personal details
  personalDetails?: PersonalDetails;

  // Structured Data for Mode B
  experienceItems?: ExperienceItem[];
  educationItems?: EducationItem[];
  skillItems?: SkillItem[];
  additionalSections?: AdditionalSectionItem[];

  preferences?: {
    pages: '1-page' | '2-page';
    tone: 'conservative' | 'modern' | 'bold';
    region: 'US' | 'EU';
    photo: boolean;
  };
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
