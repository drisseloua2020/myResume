import React, { useEffect, useState } from 'react';
import { CareerJob, listCareerJobs } from '../services/careerService';
import WorkflowShell, { WorkflowBadge, WorkflowMetric, WorkflowStep } from './WorkflowShell';

const steps: WorkflowStep[] = [
  { label: 'All resumes', status: 'Library' },
  { label: 'Resume editor', status: 'Edit' },
  { label: 'Improvements', status: 'Ready' },
  { label: 'Analysis', status: 'Done' },
  { label: 'Jobs', status: 'Now', active: true },
  { label: 'Auto-apply', status: 'Next' },
  { label: 'Approval', status: 'Gate' },
];

const metrics: WorkflowMetric[] = [
  { label: 'Average fit', value: '78%', tone: 'green' },
  { label: 'Ready now', value: '5', tone: 'blue' },
];

const fallbackJobs = [
  { title: 'Technical Support Specialist', company: 'BrightLayer SaaS', fit: 82, status: 'Ready packet', tone: 'green' as const },
  { title: 'Application Support Analyst', company: 'Northstar Health', fit: 76, status: 'Tailor first', tone: 'amber' as const },
  { title: 'Customer Support Engineer', company: 'Helpdesk Cloud', fit: 72, status: 'Needs API proof', tone: 'amber' as const },
  { title: 'Junior QA Analyst', company: 'ProductWorks', fit: 68, status: 'Hold', tone: 'red' as const },
];

export default function JobsToApplyWorkflowPage({ onPrepareAutoApply }: { onPrepareAutoApply: () => void }) {
  const [jobs, setJobs] = useState<CareerJob[]>([]);

  useEffect(() => {
    let alive = true;
    listCareerJobs()
      .then((res) => {
        if (alive) setJobs(res.jobs);
      })
      .catch(() => {
        if (alive) setJobs([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const visibleJobs = jobs.length
    ? jobs.slice(0, 4).map((job, index) => ({
      title: job.title,
      company: job.company || 'Saved job',
      fit: Math.max(68, 84 - index * 5),
      status: index < 2 ? 'Selected' : 'Review',
      tone: index < 2 ? 'green' as const : 'amber' as const,
    }))
    : fallbackJobs;

  return (
    <WorkflowShell
      eyebrow="Jobs to apply"
      title="Choose jobs with a clear fit reason before automation starts."
      description="Jobs are ranked, explained, and selected in controlled batches so the user knows why each role belongs."
      steps={steps}
      metrics={metrics}
      primaryAction={
        <button type="button" onClick={onPrepareAutoApply} className="rounded bg-white px-5 py-3 text-sm font-black text-[#243449]">
          Build apply batch
        </button>
      }
      asideTitle="Batch builder"
      asideDescription="Controlled batches reduce risk and make feedback useful. The app should not apply broadly until the user approves."
      aside={
        <div className="space-y-4">
          <div>
            <div className="text-3xl font-black text-slate-950">5 roles</div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Selected for the first controlled batch.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-950">Selection rule</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Only include roles above 75 fit or with clear resume edits available.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-950">Next approval</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">The user reviews final packets before any external submission.</p>
          </div>
          <button type="button" onClick={onPrepareAutoApply} className="w-full rounded bg-blue-700 px-5 py-3 text-sm font-black text-white">
            Prepare auto-apply batch
          </button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {visibleJobs.map((job, index) => (
          <article key={`${job.title}-${index}`} className={`rounded-lg border bg-white p-5 shadow-sm ${index < 2 ? 'border-blue-200 ring-2 ring-blue-50' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-blue-700">{index < 2 ? 'Selected' : index === 2 ? 'Review' : 'Hold'}</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{job.title}</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{job.company}. Match reason should connect directly to resume evidence and profile direction.</p>
              </div>
              <div className={`rounded px-3 py-2 text-lg font-black ${job.fit >= 80 ? 'bg-emerald-50 text-emerald-700' : job.fit >= 72 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{job.fit}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <WorkflowBadge tone={job.tone}>{job.status}</WorkflowBadge>
              <WorkflowBadge>SQL</WorkflowBadge>
              <WorkflowBadge>Support</WorkflowBadge>
              {index === 0 && <WorkflowBadge tone="blue">Remote</WorkflowBadge>}
            </div>
          </article>
        ))}
      </div>
    </WorkflowShell>
  );
}
