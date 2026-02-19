import React, { useMemo, useState } from 'react';
import { AVAILABLE_TEMPLATES } from '../constants';

interface ResumeExamplesPageProps {
  onBack?: () => void;
  onChooseTemplate?: (templateId: string) => void;
}

type Example = {
  templateId: string;
  title: string;
  name: string;
  headline: string;
  summary: string;
  highlights: string[];
  bestFor: string[];
};

const ResumeExamplesPage: React.FC<ResumeExamplesPageProps> = ({ onBack, onChooseTemplate }) => {
  const examples: Example[] = useMemo(() => (
    [
      {
        templateId: 'classic_pro',
        title: 'Finance Analyst',
        name: 'Jordan Lee',
        headline: 'FP&A | Budgeting | Forecasting | Stakeholder Reporting',
        summary: 'Finance analyst with 4+ years supporting forecasting, budgeting, and monthly close for SaaS and retail teams. Known for building clean models and translating numbers into decisions.',
        highlights: [
          'Built a rolling 12‑month forecast model adopted by 5 business units',
          'Reduced variance reporting cycle time from 3 days to 1 day',
          'Partnered with Sales to improve pipeline-to-revenue accuracy by 12%',
        ],
        bestFor: ['Finance', 'Accounting', 'Operations'],
      },
      {
        templateId: 'modern_tech',
        title: 'Full-Stack Software Engineer',
        name: 'Amina El Idrissi',
        headline: 'React | Node.js | PostgreSQL | AWS | Performance',
        summary: 'Full‑stack engineer with 5+ years shipping web apps end‑to‑end. Focused on UX performance, clean APIs, and reliable releases. Comfortable owning features from design to production.',
        highlights: [
          'Shipped a self‑serve onboarding flow that increased activation by 9%',
          'Optimized backend queries and caching; reduced p95 API latency by 40%',
          'Built CI checks and release automation; cut deployment time by 60%',
        ],
        bestFor: ['Software Engineering', 'Product Engineering', 'Startups'],
      },
      {
        templateId: 'creative_bold',
        title: 'Marketing Specialist',
        name: 'Riley Chen',
        headline: 'Campaigns | SEO | Content Strategy | Growth',
        summary: 'Marketing specialist with 3+ years running multi‑channel campaigns. Strong at turning insights into content and experiments that move growth metrics.',
        highlights: [
          'Grew organic traffic by 55% in 6 months through SEO + content clusters',
          'Launched 12 email journeys; improved CTR by 18% and reduced churn by 6%',
          'Owned paid search optimizations; decreased CAC by 14%',
        ],
        bestFor: ['Marketing', 'Content', 'Brand'],
      },
      {
        templateId: 'executive_lead',
        title: 'Operations Manager',
        name: 'Samira Hassan',
        headline: 'Operations | Process Improvement | Team Leadership | OKRs',
        summary: 'Operations leader with 8+ years scaling teams and improving delivery. Known for building processes that increase speed without sacrificing quality.',
        highlights: [
          'Led a 14‑person team supporting 3 regions and 120+ accounts',
          'Implemented SOPs and dashboards; improved on‑time delivery from 86% to 96%',
          'Negotiated vendor changes saving $180K annually',
        ],
        bestFor: ['Leadership', 'Operations', 'Program Management'],
      },
      {
        templateId: 'minimalist_clean',
        title: 'UX Designer',
        name: 'Noah Patel',
        headline: 'Product Design | Research | Prototyping | Design Systems',
        summary: 'UX designer with 4+ years creating user‑centered experiences for B2B and consumer apps. Strong in research synthesis and designing scalable systems.',
        highlights: [
          'Redesigned core workflow; reduced task completion time by 27%',
          'Built a design system used across 6 products; improved consistency and speed',
          'Partnered with engineering on accessibility improvements (WCAG)',
        ],
        bestFor: ['Design', 'UX/UI', 'Product'],
      },
      {
        templateId: 'compact_grid',
        title: 'Data Analyst',
        name: 'Diego Alvarez',
        headline: 'SQL | Tableau | Python | Experimentation | Dashboards',
        summary: 'Data analyst with 3+ years building dashboards and analysis for growth and operations. Focused on clear storytelling, fast iteration, and reliable metrics definitions.',
        highlights: [
          'Built executive dashboard used weekly by leadership across 4 functions',
          'Standardized KPI definitions; reduced conflicting metrics by 70%',
          'Led A/B test analysis; improved signup conversion by 4.2%',
        ],
        bestFor: ['Data', 'Analytics', 'Reporting'],
      },
    ]
  ), []);

  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Resume Examples</h1>
          <p className="text-slate-500 mt-2">
            Mock resume profiles that match our templates. Use these as inspiration for structure and bullet style.
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm font-semibold text-slate-600 hover:text-slate-800 underline"
          >
            Back
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {examples.map((ex) => {
          const template = AVAILABLE_TEMPLATES.find((t) => t.id === ex.templateId);
          const isOpen = openId === ex.templateId;
          return (
            <div key={ex.templateId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{template?.name ?? ex.templateId}</div>
                  <div className="text-xl font-bold text-slate-800 mt-1">{ex.title}</div>
                  <div className="text-sm text-slate-600 mt-1">{ex.name} • {ex.headline}</div>
                </div>
                <div className="flex gap-2">
                  {onChooseTemplate && (
                    <button
                      onClick={() => onChooseTemplate(ex.templateId)}
                      className="text-sm font-bold bg-[#1a91f0] text-white px-4 py-2 rounded-lg hover:bg-[#1170cd]"
                    >
                      Use this template
                    </button>
                  )}
                  <button
                    onClick={() => setOpenId((prev) => (prev === ex.templateId ? null : ex.templateId))}
                    className="text-sm font-semibold text-slate-700 px-4 py-2 rounded-lg border border-slate-300 hover:bg-white"
                  >
                    {isOpen ? 'Hide' : 'View'} details
                  </button>
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm text-slate-700 mb-4">{ex.summary}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {ex.bestFor.map((b) => (
                    <span key={b} className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                      {b}
                    </span>
                  ))}
                </div>

                <div className="text-sm font-semibold text-slate-800 mb-2">Impact highlights</div>
                <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
                  {ex.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>

                {isOpen && (
                  <div className="mt-6 bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-sm font-bold text-slate-800 mb-2">Mini mock-up (structure)</div>
                    <div className="text-sm text-slate-700">
                      <div className="font-bold">{ex.name}</div>
                      <div className="text-slate-600">{ex.headline}</div>
                      <div className="mt-3 font-semibold">Summary</div>
                      <div className="text-slate-600">{ex.summary}</div>
                      <div className="mt-3 font-semibold">Experience</div>
                      <ul className="text-slate-600 list-disc pl-5 space-y-1">
                        {ex.highlights.slice(0, 2).map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                      <div className="mt-3 font-semibold">Skills</div>
                      <div className="text-slate-600">[Add 8–12 skills matching the job description]</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResumeExamplesPage;
