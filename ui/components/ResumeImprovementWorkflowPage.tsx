import React from 'react';
import type { UserInputData } from '../types';
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

const metrics: WorkflowMetric[] = [
  { label: 'Profile', value: '100%', tone: 'teal' },
  { label: 'Resume', value: '74%', tone: 'amber' },
  { label: 'Apply', value: '0%', tone: 'red' },
];

function resumeName(data?: UserInputData | null) {
  const details = data?.personalDetails;
  const name = [details?.firstName, details?.lastName].filter(Boolean).join(' ').trim();
  return name || 'Your resume';
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
  const skills = currentResume?.skillItems?.flatMap((item) => item.items.split(/[,|;]/).map((skill) => skill.trim()).filter(Boolean)).slice(0, 6) || [
    'SQL',
    'API troubleshooting',
    'Documentation',
  ];

  return (
    <WorkflowShell
      eyebrow="Resume improvements"
      title="Improve the resume before broad applications."
      description="Focus the user on one next-best action, then move them back into the editor or forward into profile analysis."
      steps={steps}
      showJourneyMenu={false}
      metrics={metrics}
      primaryAction={
        <button type="button" onClick={onOpenEditor} className="rounded bg-white px-5 py-3 text-sm font-black text-[#243449]">
          Start guided fix
        </button>
      }
      asideTitle="Application readiness"
      asideDescription="Raise readiness before applying broadly. The system should recommend controlled batches until the resume is stronger."
      aside={
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-emerald-500 bg-white text-3xl font-black text-slate-950">74</div>
            <p className="text-sm font-semibold leading-6 text-slate-600">Almost ready. Add measurable support outcomes and one stronger tool example.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">Suggested job targets</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <WorkflowBadge tone="blue">Technical Support</WorkflowBadge>
              <WorkflowBadge>Application Support</WorkflowBadge>
              <WorkflowBadge>Junior QA</WorkflowBadge>
            </div>
          </div>
          <button type="button" onClick={onOpenAnalysis} className="w-full rounded bg-blue-700 px-5 py-3 text-sm font-black text-white">
            Open profile analysis
          </button>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-700">Current resume</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">{resumeName(currentResume)}</h2>
          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-8 shadow-inner">
            <div className="text-3xl font-black text-slate-950">{resumeName(currentResume)}</div>
            <div className="mt-4 h-2 w-1/2 rounded bg-blue-100" />
            <div className="mt-2 h-2 w-2/3 rounded bg-slate-200" />
            <div className="mt-8 border-b border-slate-200 pb-2 text-xs font-black uppercase text-blue-900">Experience</div>
            {(currentResume?.experienceItems || []).slice(0, 3).map((item) => (
              <div key={item.id} className="mt-4 flex gap-3 text-sm font-semibold leading-6 text-slate-700">
                <span className="mt-2 h-2 w-2 rounded-full bg-slate-400" />
                <span>{item.description || `${item.role || 'Role'} at ${item.company || 'Company'} needs a measurable outcome.`}</span>
              </div>
            ))}
            {(!currentResume?.experienceItems || currentResume.experienceItems.length === 0) && (
              <p className="mt-4 text-sm font-semibold text-slate-600">Add experience bullets in the editor to unlock stronger improvement guidance.</p>
            )}
            <div className="mt-8 border-b border-slate-200 pb-2 text-xs font-black uppercase text-blue-900">Visible skills</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {skills.map((skill) => <WorkflowBadge key={skill}>{skill}</WorkflowBadge>)}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase text-blue-700">Live guidance</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Resume checks</h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-black text-slate-950">Missing outcome</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Add a number, time saved, volume handled, or quality improvement.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-black text-slate-950">Keyword fit</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Your visible skills should match the selected job family.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-black text-slate-950">Next version</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Create one tailored resume before preparing applications.</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onOpenEditor} className="w-full rounded bg-blue-700 px-5 py-3 text-sm font-black text-white">
            Create tailored version
          </button>
        </section>
      </div>
    </WorkflowShell>
  );
}
