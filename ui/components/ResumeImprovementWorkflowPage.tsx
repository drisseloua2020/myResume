import React, { useEffect, useMemo, useState } from 'react';
import type { UserInputData } from '../types';
import { listResumes, type ResumeListItem } from '../services/resumeService';
import WorkflowShell, { WorkflowBadge, WorkflowMetric, WorkflowStep } from './WorkflowShell';

const steps: WorkflowStep[] = [
  { label: 'All resumes', status: 'Library' },
  { label: 'Resume editor', status: 'Edit' },
  { label: 'Improvements', status: 'Now', active: true },
  { label: 'Analysis', status: 'Ready' },
  { label: 'Jobs', status: 'Next' },
  { label: 'Auto-apply', status: 'Prep' },
  { label: 'Approval', status: 'Gate' },
];

type ScoreTone = 'blue' | 'green' | 'amber' | 'red' | 'teal';

type ProgressPoint = {
  label: string;
  value: number;
};

type WorkbenchTab = 'fixes' | 'keywords' | 'sections' | 'batch';

type ImprovementAction = {
  title: string;
  detail: string;
  impact: 'High' | 'Medium' | 'Low';
  effort: 'Quick' | 'Focused' | 'Deep';
  status: string;
  tone: ScoreTone;
};

type KeywordInsight = {
  keyword: string;
  present: boolean;
  priority: 'Core' | 'Helpful';
};

type SectionHealth = {
  label: string;
  score: number;
  detail: string;
};

type PreflightCheck = {
  label: string;
  ready: boolean;
};

const scoreColors: Record<ScoreTone, string> = {
  blue: '#2563eb',
  green: '#059669',
  amber: '#f59e0b',
  red: '#ef4444',
  teal: '#0d9488',
};

const scoreText: Record<ScoreTone, string> = {
  blue: 'text-blue-700',
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
  teal: 'text-teal-700',
};

function resumeName(data?: UserInputData | null) {
  const details = data?.personalDetails;
  const name = [details?.firstName, details?.lastName].filter(Boolean).join(' ').trim();
  return name || 'Your resume';
}

function hasText(value?: string | null) {
  return Boolean(value?.trim());
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreFromChecks(checks: boolean[]) {
  if (checks.length === 0) return 0;
  return clampScore((checks.filter(Boolean).length / checks.length) * 100);
}

function scoreTone(value: number): ScoreTone {
  if (value >= 85) return 'green';
  if (value >= 70) return 'teal';
  if (value >= 45) return 'amber';
  return 'red';
}

function splitSkills(data?: UserInputData | null) {
  return data?.skillItems
    ?.flatMap((item) => item.items.split(/[,|;]/).map((skill) => skill.trim()).filter(Boolean)) || [];
}

function hasMeasurableProof(data?: UserInputData | null) {
  return Boolean(data?.experienceItems?.some((item) => /(\d|%|\$|saved|increased|reduced|improved|handled|resolved)/i.test(item.description || '')));
}

function buildSuggestedTargets(data?: UserInputData | null) {
  const skills = splitSkills(data).join(' ').toLowerCase();
  const targetRole = data?.targetRole?.trim();
  const targets = [
    targetRole,
    skills.match(/sql|api|ticket|support|troubleshoot/) ? 'Application Support Analyst' : undefined,
    skills.match(/customer|support|documentation|help/) ? 'Technical Support Specialist' : undefined,
    skills.match(/qa|test|bug|automation/) ? 'Junior QA Analyst' : undefined,
    'Customer Support Engineer',
  ].filter(Boolean) as string[];

  return Array.from(new Set(targets)).slice(0, 4);
}

function resumeSearchText(data?: UserInputData | null) {
  return [
    data?.targetRole,
    data?.jobDescription,
    data?.personalDetails?.summary,
    ...(data?.skillItems || []).flatMap((item) => [item.category, item.items]),
    ...(data?.experienceItems || []).flatMap((item) => [item.role, item.company, item.description]),
    ...(data?.educationItems || []).flatMap((item) => [item.degree, item.school]),
    ...(data?.certificationItems || []).flatMap((item) => [item.name, item.issuer, item.details]),
    ...(data?.additionalSections || []).flatMap((item) => [item.title, item.items]),
  ].filter(Boolean).join(' ').toLowerCase();
}

function buildKeywordInsights(data?: UserInputData | null, suggestedTargets: string[] = []) {
  const text = resumeSearchText(data);
  const targetText = [data?.targetRole, ...suggestedTargets].join(' ').toLowerCase();
  const roleKeywords = [
    'customer support',
    'technical support',
    'troubleshooting',
    'ticketing',
    'documentation',
    'api',
    'sql',
    'crm',
    'sla',
    'escalation',
    'quality',
    'remote collaboration',
  ];

  const technicalKeywords = targetText.match(/software|engineer|developer|cloud|data/)
    ? ['python', 'javascript', 'react', 'cloud', 'testing', 'automation']
    : [];
  const qaKeywords = targetText.match(/qa|quality|test/)
    ? ['test cases', 'bug reports', 'regression testing', 'automation']
    : [];

  return Array.from(new Set([...roleKeywords, ...technicalKeywords, ...qaKeywords])).slice(0, 16).map((keyword, index) => ({
    keyword,
    present: text.includes(keyword.toLowerCase()),
    priority: index < 8 ? 'Core' as const : 'Helpful' as const,
  }));
}

function buildSectionHealth({
  data,
  hasContact,
  hasSummary,
  hasTarget,
  proofReady,
  completeExperience,
  skills,
  education,
}: {
  data?: UserInputData | null;
  hasContact: boolean;
  hasSummary: boolean;
  hasTarget: boolean;
  proofReady: boolean;
  completeExperience: number;
  skills: string[];
  education: NonNullable<UserInputData['educationItems']>;
}) {
  const details = data?.personalDetails;
  const experiences = data?.experienceItems || [];

  return [
    {
      label: 'Profile identity',
      score: scoreFromChecks([hasText(details?.firstName), hasText(details?.lastName), hasContact]),
      detail: hasContact ? 'Name and contact are usable.' : 'Add email or phone before applying.',
    },
    {
      label: 'Professional summary',
      score: scoreFromChecks([hasSummary, hasTarget]),
      detail: hasSummary ? 'Summary has enough substance.' : 'Write a sharper role-focused summary.',
    },
    {
      label: 'Experience proof',
      score: scoreFromChecks([experiences.length > 0, completeExperience > 0, proofReady]),
      detail: proofReady ? 'At least one measurable result is visible.' : 'Add numbers, volume, speed, or quality outcomes.',
    },
    {
      label: 'Skill coverage',
      score: clampScore(Math.min(skills.length, 8) / 8 * 100),
      detail: skills.length >= 5 ? 'Skills are visible enough to tune.' : 'Add more role-matched skills.',
    },
    {
      label: 'Education and extras',
      score: scoreFromChecks([education.length > 0, Boolean(data?.certificationItems?.length || data?.additionalSections?.length)]),
      detail: education.length ? 'Education is present.' : 'Add education, certifications, or projects.',
    },
    {
      label: 'Application targeting',
      score: scoreFromChecks([hasTarget, Boolean(data?.jobDescription || data?.jobUrl)]),
      detail: data?.jobDescription || data?.jobUrl ? 'A target job signal is attached.' : 'Attach a job post for tighter matching.',
    },
  ];
}

function buildImprovementActions({
  hasContact,
  hasSummary,
  hasTarget,
  proofReady,
  skills,
  education,
  missingKeywords,
}: {
  hasContact: boolean;
  hasSummary: boolean;
  hasTarget: boolean;
  proofReady: boolean;
  skills: string[];
  education: NonNullable<UserInputData['educationItems']>;
  missingKeywords: KeywordInsight[];
}) {
  const actions: ImprovementAction[] = [
    {
      title: proofReady ? 'Promote the strongest proof point' : 'Add one measurable outcome',
      detail: proofReady
        ? 'Move the best metric into the first visible experience bullet.'
        : 'Add volume, time saved, response speed, quality lift, or customer impact.',
      impact: 'High',
      effort: 'Quick',
      status: proofReady ? 'Ready to polish' : 'Needs evidence',
      tone: proofReady ? 'green' : 'amber',
    },
    {
      title: hasTarget ? 'Tune the resume to the target role' : 'Choose a target role',
      detail: hasTarget
        ? 'Align summary, skills, and top bullets around the selected job family.'
        : 'Pick one role family so the app can prioritize keywords and examples.',
      impact: 'High',
      effort: 'Focused',
      status: hasTarget ? 'Ready to tune' : 'Needs direction',
      tone: hasTarget ? 'teal' : 'red',
    },
    {
      title: skills.length >= 5 ? 'Group and rank skills' : 'Expand role-matched skills',
      detail: skills.length >= 5
        ? 'Put the strongest tools and support skills first.'
        : `Add missing terms such as ${missingKeywords.slice(0, 3).map((item) => item.keyword).join(', ') || 'role keywords'}.`,
      impact: 'Medium',
      effort: 'Quick',
      status: skills.length >= 5 ? 'Ready to reorder' : 'Needs keywords',
      tone: skills.length >= 5 ? 'blue' : 'amber',
    },
    {
      title: hasSummary ? 'Sharpen the headline summary' : 'Write a profile summary',
      detail: hasSummary
        ? 'Make the first sentence name the target role, strongest proof, and domain.'
        : 'Add a concise summary that states role direction, strengths, and proof.',
      impact: 'Medium',
      effort: 'Focused',
      status: hasSummary ? 'Ready to refine' : 'Missing',
      tone: hasSummary ? 'teal' : 'amber',
    },
    {
      title: education.length ? 'Check education placement' : 'Add education or certification proof',
      detail: education.length
        ? 'Keep education compact so experience and proof stay visible.'
        : 'Add education, certification, coursework, or a project if formal education is not available.',
      impact: 'Low',
      effort: 'Quick',
      status: education.length ? 'Present' : 'Optional gap',
      tone: education.length ? 'green' : 'blue',
    },
    {
      title: hasContact ? 'Confirm application contact details' : 'Add contact details',
      detail: hasContact
        ? 'Verify email, phone, city, and links before creating application packets.'
        : 'Add email or phone so applications are not blocked.',
      impact: hasContact ? 'Low' : 'High',
      effort: 'Quick',
      status: hasContact ? 'Ready' : 'Blocked',
      tone: hasContact ? 'green' : 'red',
    },
  ];

  return actions.sort((a, b) => {
    const impactRank = { High: 0, Medium: 1, Low: 2 };
    return impactRank[a.impact] - impactRank[b.impact];
  });
}

function buildImprovementModel(data?: UserInputData | null, savedResumes: ResumeListItem[] = []) {
  const details = data?.personalDetails;
  const skills = splitSkills(data);
  const experiences = data?.experienceItems || [];
  const education = data?.educationItems || [];
  const certifications = data?.certificationItems || [];
  const additionalSections = data?.additionalSections || [];
  const hasContact = Boolean(hasText(details?.email) || hasText(details?.phone));
  const proofReady = hasMeasurableProof(data);
  const hasSummary = Boolean((details?.summary || '').trim().length >= 60);
  const hasTarget = hasText(data?.targetRole);
  const completeExperience = experiences.filter((item) => hasText(item.role) && hasText(item.company) && hasText(item.description)).length;

  const profileCompletion = scoreFromChecks([
    hasText(details?.firstName),
    hasText(details?.lastName),
    hasContact,
    hasText(details?.city) || hasText(details?.state) || hasText(details?.country),
    hasTarget,
    hasSummary,
    skills.length >= 3,
    experiences.length > 0,
    education.length > 0,
    certifications.length > 0 || additionalSections.length > 0 || hasText(details?.links),
  ]);

  const resumeCompletion = scoreFromChecks([
    hasText(data?.templateId),
    hasText(details?.firstName) && hasText(details?.lastName),
    hasContact,
    hasSummary,
    hasTarget,
    completeExperience > 0,
    experiences.length >= 2 || proofReady,
    skills.length >= 5,
    education.length > 0,
    Boolean(data?.preferences),
  ]);

  const outcomeSignal = experiences.length
    ? clampScore((experiences.filter((item) => hasText(item.description)).length / experiences.length) * 70 + (proofReady ? 30 : 0))
    : 0;
  const applicationReadiness = scoreFromChecks([
    profileCompletion >= 70,
    resumeCompletion >= 70,
    hasTarget,
    skills.length >= 5,
    completeExperience > 0,
    proofReady,
    hasContact,
    Boolean(data?.jobDescription || data?.jobUrl),
  ]);
  const readiness = clampScore(applicationReadiness * 0.6 + resumeCompletion * 0.25 + profileCompletion * 0.15);
  const suggestedTargets = buildSuggestedTargets(data);
  const keywordInsights = buildKeywordInsights(data, suggestedTargets);
  const missingKeywords = keywordInsights.filter((item) => !item.present);
  const hasCurrentInput = Boolean(
    hasText(details?.firstName) ||
    hasText(details?.lastName) ||
    hasText(data?.targetRole) ||
    experiences.length ||
    skills.length,
  );
  const sectionHealth = buildSectionHealth({
    data,
    hasContact,
    hasSummary,
    hasTarget,
    proofReady,
    completeExperience,
    skills,
    education,
  });
  const preflightChecks: PreflightCheck[] = [
    { label: 'Profile above 70%', ready: profileCompletion >= 70 },
    { label: 'Resume above 70%', ready: resumeCompletion >= 70 },
    { label: 'Target role selected', ready: hasTarget },
    { label: 'Measurable proof visible', ready: proofReady },
    { label: 'Contact details present', ready: hasContact },
    { label: 'Job post attached', ready: Boolean(data?.jobDescription || data?.jobUrl) },
  ];
  const blockingChecks = preflightChecks.filter((item) => !item.ready);

  return {
    profileCompletion,
    resumeCompletion,
    applicationReadiness: readiness,
    skills,
    experiences,
    education,
    savedResumeCount: savedResumes.length,
    latestResumeTitle: savedResumes[0]?.title || resumeName(data),
    suggestedTargets,
    keywordInsights,
    missingKeywords,
    sectionHealth,
    improvementActions: buildImprovementActions({
      hasContact,
      hasSummary,
      hasTarget,
      proofReady,
      skills,
      education,
      missingKeywords,
    }),
    preflightChecks,
    applicationBatch: {
      size: readiness >= 80 ? '8-10 roles' : readiness >= 65 ? '3-5 roles' : 'Hold',
      mode: readiness >= 80 ? 'Controlled apply batch' : readiness >= 65 ? 'Small test batch' : 'Improve before applying',
      detail: readiness >= 80
        ? 'The resume has enough structure for a focused application run.'
        : readiness >= 65
          ? 'Apply only to close-fit roles while tightening proof and keywords.'
          : 'Keep applications paused until the top readiness blockers are resolved.',
      blockers: blockingChecks.map((item) => item.label),
    },
    overviewItems: [
      { label: 'Target role', value: data?.targetRole?.trim() || 'Add a target role' },
      { label: 'Saved resumes', value: String(savedResumes.length || (hasCurrentInput ? 1 : 0)) },
      { label: 'Experience entries', value: String(experiences.length) },
      { label: 'Visible skills', value: String(skills.length) },
      { label: 'Education', value: education.length ? education.map((item) => item.school).filter(Boolean).slice(0, 2).join(', ') : 'Add education' },
      { label: 'Contact readiness', value: hasContact ? 'Contact details present' : 'Add email or phone' },
    ],
    resumeCreationProgress: [
      { label: 'Identity', value: scoreFromChecks([hasText(details?.firstName), hasText(details?.lastName), hasContact]) },
      { label: 'Direction', value: scoreFromChecks([hasTarget, hasSummary]) },
      { label: 'Experience', value: scoreFromChecks([experiences.length > 0, completeExperience > 0, proofReady]) },
      { label: 'Skills', value: clampScore(Math.min(skills.length, 8) / 8 * 100) },
      { label: 'Ready', value: resumeCompletion },
    ],
    improvementProgress: [
      { label: 'Base', value: clampScore(Math.max(30, resumeCompletion - 24)) },
      { label: 'Profile', value: profileCompletion },
      { label: 'Resume', value: resumeCompletion },
      { label: 'Proof', value: outcomeSignal },
      { label: 'Apply', value: readiness },
    ],
    priorities: [
      proofReady ? 'Turn the strongest proof point into the first bullet.' : 'Add one measurable result to the top experience bullet.',
      skills.length >= 5 ? 'Group the strongest skills around the target role.' : 'Add at least five role-matched skills.',
      hasTarget ? 'Tailor the next version to one target role family.' : 'Choose a target role before tailoring the resume.',
    ],
  };
}

function ScoreCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  tone: ScoreTone;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase text-blue-700">{label}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{description}</p>
        </div>
        <div
          className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(${scoreColors[tone]} ${value * 3.6}deg, #e2e8f0 0deg)` }}
        >
          <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-xl font-black text-slate-950">{value}%</div>
        </div>
      </div>
    </section>
  );
}

function ProgressChart({
  title,
  description,
  points,
  tone = 'blue',
}: {
  title: string;
  description: string;
  points: ProgressPoint[];
  tone?: ScoreTone;
}) {
  const width = 420;
  const height = 170;
  const padding = 28;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const coords = points.map((point, index) => {
    const x = padding + (points.length <= 1 ? 0 : (index / (points.length - 1)) * innerWidth);
    const y = padding + (1 - point.value / 100) * innerHeight;
    return { ...point, x, y };
  });
  const polyline = coords.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase text-blue-700">{title}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{description}</p>
        </div>
        <WorkflowBadge tone={tone}>{coords[coords.length - 1]?.value || 0}%</WorkflowBadge>
      </div>
      <svg className="mt-5 h-44 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} chart`}>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padding + (1 - tick / 100) * innerHeight;
          return <line key={tick} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
        })}
        <polyline fill="none" points={polyline} stroke={scoreColors[tone]} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
        {coords.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="6" fill="#ffffff" stroke={scoreColors[tone]} strokeWidth="4" />
            <text x={point.x} y={height - 6} textAnchor="middle" className="fill-slate-500 text-[11px] font-bold">{point.label}</text>
          </g>
        ))}
      </svg>
    </section>
  );
}

type ImprovementModel = ReturnType<typeof buildImprovementModel>;

const workbenchTabs: Array<{ key: WorkbenchTab; label: string }> = [
  { key: 'fixes', label: 'Fix plan' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'sections', label: 'Sections' },
  { key: 'batch', label: 'Batch' },
];

function MeterRow({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: ScoreTone;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{label}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{detail}</p>
        </div>
        <span className={`text-sm font-black ${scoreText[tone]}`}>{value}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded bg-slate-100">
        <div className="h-full rounded" style={{ width: `${value}%`, backgroundColor: scoreColors[tone] }} />
      </div>
    </div>
  );
}

function ImprovementWorkbench({
  model,
  activeTab,
  onTabChange,
  onOpenEditor,
  onOpenAnalysis,
}: {
  model: ImprovementModel;
  activeTab: WorkbenchTab;
  onTabChange: (tab: WorkbenchTab) => void;
  onOpenEditor: () => void;
  onOpenAnalysis: () => void;
}) {
  const keywordCoverage = model.keywordInsights.length
    ? scoreFromChecks(model.keywordInsights.map((item) => item.present))
    : 0;
  const coveredKeywords = model.keywordInsights.filter((item) => item.present);
  const missingKeywords = model.keywordInsights.filter((item) => !item.present);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-blue-700">Improvement workbench</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Plan, tune, check, and batch.</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 sm:flex">
          {workbenchTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={[
                'rounded px-3 py-2 text-sm font-black transition',
                activeTab === tab.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-950',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'fixes' && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {model.improvementActions.map((action) => (
            <article key={action.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black text-slate-950">{action.title}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{action.detail}</p>
                </div>
                <WorkflowBadge tone={action.tone}>{action.status}</WorkflowBadge>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <WorkflowBadge tone={action.impact === 'High' ? 'red' : action.impact === 'Medium' ? 'amber' : 'blue'}>{action.impact} impact</WorkflowBadge>
                  <WorkflowBadge>{action.effort}</WorkflowBadge>
                </div>
                <button type="button" onClick={onOpenEditor} className="rounded bg-white px-4 py-2 text-sm font-black text-blue-700 shadow-sm ring-1 ring-slate-200">
                  Fix
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'keywords' && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase text-blue-700">Keyword coverage</p>
            <div className="mt-4 text-4xl font-black text-slate-950">{keywordCoverage}%</div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {coveredKeywords.length} covered, {missingKeywords.length} missing from the current target set.
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded bg-white">
              <div className="h-full rounded bg-blue-600" style={{ width: `${keywordCoverage}%` }} />
            </div>
          </div>
          <div>
            <p className="text-sm font-black text-slate-950">Target terms</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {model.keywordInsights.map((item) => (
                <WorkflowBadge key={item.keyword} tone={item.present ? 'green' : item.priority === 'Core' ? 'amber' : 'slate'}>
                  {item.keyword}
                </WorkflowBadge>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-black text-slate-950">Best next keyword move</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {missingKeywords.length
                  ? `Add ${missingKeywords.slice(0, 3).map((item) => item.keyword).join(', ')} where it is true and supported by experience.`
                  : 'Coverage is strong. Spend the next pass improving proof and clarity instead of adding more keywords.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sections' && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {model.sectionHealth.map((section) => (
            <div key={section.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <MeterRow
                label={section.label}
                value={section.score}
                detail={section.detail}
                tone={scoreTone(section.score)}
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'batch' && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase text-blue-700">Recommended batch</p>
            <div className="mt-4 text-3xl font-black text-slate-950">{model.applicationBatch.size}</div>
            <p className="mt-2 font-black text-slate-950">{model.applicationBatch.mode}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{model.applicationBatch.detail}</p>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {model.preflightChecks.map((check) => (
                <div key={check.label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
                  <span className="text-sm font-black text-slate-950">{check.label}</span>
                  <WorkflowBadge tone={check.ready ? 'green' : 'amber'}>{check.ready ? 'Ready' : 'Fix'}</WorkflowBadge>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onOpenEditor} className="rounded bg-blue-700 px-5 py-3 text-sm font-black text-white">
                Fix blockers
              </button>
              <button type="button" onClick={onOpenAnalysis} className="rounded border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800">
                Review analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ResumeImprovementWorkflowPage({
  currentResume,
  onOpenEditor,
  onOpenAnalysis,
}: {
  currentResume?: UserInputData | null;
  onOpenEditor: () => void;
  onOpenAnalysis: () => void;
}) {
  const [savedResumes, setSavedResumes] = useState<ResumeListItem[]>([]);
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<WorkbenchTab>('fixes');

  useEffect(() => {
    let isCurrent = true;
    listResumes()
      .then((resumes) => {
        if (isCurrent) setSavedResumes(resumes);
      })
      .catch(() => {
        if (isCurrent) setSavedResumes([]);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const model = useMemo(() => buildImprovementModel(currentResume, savedResumes), [currentResume, savedResumes]);
  const visibleSkills = model.skills.slice(0, 8);
  const metrics: WorkflowMetric[] = [
    { label: 'Profile', value: `${model.profileCompletion}%`, tone: scoreTone(model.profileCompletion) },
    { label: 'Resume', value: `${model.resumeCompletion}%`, tone: scoreTone(model.resumeCompletion) },
    { label: 'Application', value: `${model.applicationReadiness}%`, tone: scoreTone(model.applicationReadiness) },
  ];

  return (
    <WorkflowShell
      eyebrow="Resume improvements"
      title="Improve the profile, resume, and application readiness."
      description="A focused overview of what is complete, what still needs proof, and how close the user is to applying with confidence."
      steps={steps}
      showJourneyMenu={false}
      metrics={metrics}
      primaryAction={
        <button type="button" onClick={onOpenEditor} className="rounded bg-white px-5 py-3 text-sm font-black text-[#243449]">
          Fix
        </button>
      }
      asideTitle="Application readiness"
      asideDescription="Use this score to decide whether to apply, tailor, or pause for more evidence."
      aside={
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
              style={{ background: `conic-gradient(${scoreColors[scoreTone(model.applicationReadiness)]} ${model.applicationReadiness * 3.6}deg, #e2e8f0 0deg)` }}
            >
              <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-2xl font-black text-slate-950">{model.applicationReadiness}</div>
            </div>
            <p className="text-sm font-semibold leading-6 text-slate-600">
              {model.applicationReadiness >= 75
                ? 'Ready for a controlled batch. Review the suggested targets before sending packets forward.'
                : 'Needs a stronger resume signal before broad applications. Fix the highest-impact gaps first.'}
            </p>
          </div>
          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-black text-slate-950">Suggested job targets</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {model.suggestedTargets.map((target, index) => (
                <WorkflowBadge key={target} tone={index === 0 ? 'blue' : 'slate'}>{target}</WorkflowBadge>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-black text-slate-950">Top fix priorities</p>
            <div className="mt-3 space-y-3">
              {model.priorities.map((priority, index) => (
                <div key={priority} className="flex gap-3 text-sm font-semibold leading-6 text-slate-600">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-blue-50 text-xs font-black text-blue-700">{index + 1}</span>
                  <span>{priority}</span>
                </div>
              ))}
            </div>
          </div>
          <button type="button" onClick={onOpenAnalysis} className="w-full rounded bg-blue-700 px-5 py-3 text-sm font-black text-white">
            Open profile analysis
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <ScoreCard
            label="Profile completion"
            value={model.profileCompletion}
            tone={scoreTone(model.profileCompletion)}
            description="Identity, contact, target direction, summary, skills, and career evidence."
          />
          <ScoreCard
            label="Resume completion"
            value={model.resumeCompletion}
            tone={scoreTone(model.resumeCompletion)}
            description="Required resume sections, structure, role focus, and visible proof."
          />
          <ScoreCard
            label="Application"
            value={model.applicationReadiness}
            tone={scoreTone(model.applicationReadiness)}
            description="How close this profile is to a safe first application batch."
          />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-blue-700">High-level profile overview</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">{resumeName(currentResume)}</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                {currentResume?.personalDetails?.summary?.trim() || 'Add a summary to give the improvement engine a clearer profile narrative.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <WorkflowBadge tone="blue">{model.latestResumeTitle}</WorkflowBadge>
              <WorkflowBadge tone={scoreTone(model.applicationReadiness)}>{model.applicationReadiness}% ready</WorkflowBadge>
            </div>
          </div>
          <div className="mt-5 grid gap-0 overflow-hidden rounded-lg border border-slate-200 md:grid-cols-2 xl:grid-cols-3">
            {model.overviewItems.map((item) => (
              <div key={item.label} className="border-b border-r border-slate-200 p-4 last:border-r-0">
                <p className="text-xs font-black uppercase text-slate-500">{item.label}</p>
                <p className="mt-2 text-sm font-black text-slate-950">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <p className="text-xs font-black uppercase text-blue-700">Visible skills</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(visibleSkills.length ? visibleSkills : ['Add role-matched skills']).map((skill) => (
                <WorkflowBadge key={skill}>{skill}</WorkflowBadge>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <ProgressChart
            title="Cumulative resume creation"
            description="Tracks how the profile moves from identity details to a complete application-ready resume."
            points={model.resumeCreationProgress}
            tone="blue"
          />
          <ProgressChart
            title="Cumulative improvement"
            description="Shows the lift from baseline content into proof, keywords, and application readiness."
            points={model.improvementProgress}
            tone="teal"
          />
        </div>

        <ImprovementWorkbench
          model={model}
          activeTab={activeWorkbenchTab}
          onTabChange={setActiveWorkbenchTab}
          onOpenEditor={onOpenEditor}
          onOpenAnalysis={onOpenAnalysis}
        />

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-blue-700">Next fixes</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Move the weakest signal first.</h2>
            </div>
            <button type="button" onClick={onOpenEditor} className="rounded bg-blue-700 px-5 py-3 text-sm font-black text-white">
              Fix
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {model.priorities.map((priority, index) => (
              <div key={priority} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase text-blue-700">Priority {index + 1}</p>
                  <span className={`text-sm font-black ${scoreText[scoreTone([model.profileCompletion, model.resumeCompletion, model.applicationReadiness][index] || 0)]}`}>
                    {[model.profileCompletion, model.resumeCompletion, model.applicationReadiness][index] || 0}%
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{priority}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </WorkflowShell>
  );
}
