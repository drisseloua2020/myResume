import { SubscriptionPlan, Template } from "./types";

export const AVAILABLE_TEMPLATES: Template[] = [
  {
    id: 'classic_pro',
    name: 'Classic Professional',
    description: 'Clean, traditional layout perfect for corporate, legal, and finance roles.',
    color: 'bg-slate-800',
    tag: 'Conservative'
  },
  {
    id: 'modern_tech',
    name: 'Modern Tech',
    description: 'Sleek, skill-focused design ideal for developers, designers, and startups.',
    color: 'bg-blue-600',
    tag: 'Modern'
  },
  {
    id: 'creative_bold',
    name: 'Creative Bold',
    description: 'Unique layout with accent colors for marketing, art, and media positions.',
    color: 'bg-purple-600',
    tag: 'Creative'
  },
  {
    id: 'executive_lead',
    name: 'Executive Lead',
    description: 'High-level hierarchy emphasizing leadership and results for management.',
    color: 'bg-emerald-700',
    tag: 'Leadership'
  },
  {
    id: 'minimalist_clean',
    name: 'Minimalist Clean',
    description: 'Simple, elegant, and easy to read. Focuses on content with ample whitespace.',
    color: 'bg-slate-400',
    tag: 'Simple'
  },
  {
    id: 'compact_grid',
    name: 'Compact Grid',
    description: 'Dense layout designed to fit maximum information on a single page.',
    color: 'bg-orange-600',
    tag: 'Technical'
  },
  {
    id: 'ats_single_column',
    name: 'ATS Single Column',
    description: 'Plain, recruiter-friendly structure optimized for applicant tracking systems.',
    color: 'bg-zinc-700',
    tag: 'ATS'
  },
  {
    id: 'consulting_case',
    name: 'Consulting Case',
    description: 'Crisp impact-first format for consulting, strategy, and business roles.',
    color: 'bg-cyan-700',
    tag: 'Business'
  },
  {
    id: 'finance_ledger',
    name: 'Finance Ledger',
    description: 'Polished layout with strong dates and metrics for finance and accounting.',
    color: 'bg-green-700',
    tag: 'Finance'
  },
  {
    id: 'healthcare_clinical',
    name: 'Healthcare Clinical',
    description: 'Clear credentials-first format for clinical, care, and health operations roles.',
    color: 'bg-teal-600',
    tag: 'Healthcare'
  },
  {
    id: 'product_manager',
    name: 'Product Manager',
    description: 'Balanced product, metrics, and stakeholder storytelling for PM roles.',
    color: 'bg-indigo-600',
    tag: 'Product'
  },
  {
    id: 'data_science',
    name: 'Data Science',
    description: 'Highlights tools, models, analysis, and measurable business outcomes.',
    color: 'bg-sky-700',
    tag: 'Data'
  },
  {
    id: 'sales_growth',
    name: 'Sales Growth',
    description: 'Revenue-focused layout for quota, pipeline, territory, and growth results.',
    color: 'bg-rose-600',
    tag: 'Sales'
  },
  {
    id: 'operations_lean',
    name: 'Operations Lean',
    description: 'Structured resume for process improvement, logistics, and delivery teams.',
    color: 'bg-lime-700',
    tag: 'Operations'
  },
  {
    id: 'teacher_education',
    name: 'Teacher Education',
    description: 'Warm academic format for teaching, curriculum, and student outcomes.',
    color: 'bg-amber-600',
    tag: 'Education'
  },
  {
    id: 'legal_associate',
    name: 'Legal Associate',
    description: 'Traditional legal format emphasizing matters, research, and writing.',
    color: 'bg-stone-700',
    tag: 'Legal'
  },
  {
    id: 'engineering_systems',
    name: 'Engineering Systems',
    description: 'Technical depth with projects, systems, reliability, and scale.',
    color: 'bg-fuchsia-700',
    tag: 'Engineering'
  },
  {
    id: 'marketing_brand',
    name: 'Marketing Brand',
    description: 'Campaign-focused layout for content, demand generation, and brand roles.',
    color: 'bg-pink-600',
    tag: 'Marketing'
  },
  {
    id: 'early_career',
    name: 'Early Career',
    description: 'Friendly structure for internships, student projects, and first roles.',
    color: 'bg-yellow-600',
    tag: 'Entry'
  },
  {
    id: 'academic_cv',
    name: 'Academic CV',
    description: 'Expandable academic format for research, publications, and teaching.',
    color: 'bg-violet-700',
    tag: 'Academic'
  }
];

export const PLAN_DETAILS = {
  [SubscriptionPlan.FREE]: {
    name: "Free",
    price: "Free",
    desc: "10 resumes/day + Ads",
    available: true
  },
  [SubscriptionPlan.MONTHLY]: {
    name: "Pro Monthly",
    price: "Coming soon",
    desc: "Full access plan in progress",
    available: false,
    badge: "Coming soon"
  },
  [SubscriptionPlan.YEARLY]: {
    name: "Pro Yearly",
    price: "Coming soon",
    desc: "Annual access plan in progress",
    available: false,
    badge: "Coming soon"
  }
};
