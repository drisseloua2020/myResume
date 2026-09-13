import React from 'react';
import WorkflowShell, { WorkflowBadge, WorkflowStep } from './WorkflowShell';

const steps: WorkflowStep[] = [
  { label: 'All resumes', status: 'Library' },
  { label: 'Resume editor', status: 'Edit' },
  { label: 'Improvements', status: 'Ready' },
  { label: 'Analysis', status: 'Done' },
  { label: 'Jobs', status: 'Selected' },
  { label: 'Auto-apply', status: 'Now', active: true },
  { label: 'Approval', status: 'Next' },
];

const packets = [
  { title: 'Technical Support Specialist', detail: 'Resume version, cover note, tracker entry, and answer draft ready.', status: 'Ready', tone: 'green' as const },
  { title: 'Application Support Analyst', detail: 'Resume needs SQL proof added before final review.', status: 'Tailoring', tone: 'amber' as const },
  { title: 'Customer Support Engineer', detail: 'API troubleshooting example required.', status: 'Needs input', tone: 'amber' as const },
];

const questions = [
  { title: 'Salary expectation', detail: 'Ask the user once, then save reusable answer with editable range.' },
  { title: 'Work authorization', detail: 'Use profile default, but require confirmation before first use.' },
  { title: 'Custom screening question', detail: 'Draft available. Needs human approval because it uses personal experience.' },
];

export default function AutoApplyPrepWorkflowPage({ onOpenApproval }: { onOpenApproval: () => void }) {
  return (
    <WorkflowShell
      eyebrow="Auto-apply preparation"
      title="Prepare every packet and stop before submission."
      description="Automation can prepare packets and answer drafts, but the human approval gate stays visible before anything leaves the product."
      steps={steps}
      primaryAction={
        <button type="button" onClick={onOpenApproval} className="rounded bg-white px-5 py-3 text-sm font-black text-[#243449]">
          Send to approval
        </button>
      }
      asideTitle="Human in the loop"
      asideDescription="Automation prepares. The user approves. Admins can set policy, but personal submissions still need user approval."
      aside={
        <div className="space-y-4">
          {[
            ['1', 'Prepare only', 'Generate packets and drafts without applying.', 'bg-emerald-600'],
            ['2', 'Require approval', 'Each packet needs explicit human review.', 'bg-amber-500'],
            ['3', 'Submit after approval', 'Submission can run only for approved items.', 'bg-slate-950'],
          ].map(([num, title, detail, tone]) => (
            <div key={title} className="flex gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded text-sm font-black text-white ${tone}`}>{num}</span>
              <div>
                <p className="font-black text-slate-950">{title}</p>
                <p className="text-sm font-semibold leading-6 text-slate-600">{detail}</p>
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-950">Blocked actions</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">No salary guesses, no custom answers sent without review, and no submission without connection and approval.</p>
          </div>
          <button type="button" onClick={onOpenApproval} className="w-full rounded bg-blue-700 px-5 py-3 text-sm font-black text-white">
            Open approval queue
          </button>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-700">Step 1</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Prepare packets</h2>
          <div className="mt-4 space-y-3">
            {packets.map((packet) => (
              <div key={packet.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-black text-slate-950">{packet.title}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{packet.detail}</p>
                <div className="mt-3"><WorkflowBadge tone={packet.tone}>{packet.status}</WorkflowBadge></div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-700">Step 2</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Resolve questions</h2>
          <div className="mt-4 space-y-3">
            {questions.map((question) => (
              <div key={question.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-black text-slate-950">{question.title}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{question.detail}</p>
                <button type="button" className="mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-800">Review</button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-700">Step 3</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Approval staging</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-950">Batch 01</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">5 jobs, 5 packets, 3 answer drafts, 0 submissions.</p>
              <div className="mt-3"><WorkflowBadge tone="blue">Awaiting approval</WorkflowBadge></div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-950">Safety rules</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">No external application is submitted until the user approves.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-950">Audit trail</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Show what changed, source resume, answers used, and submission target.</p>
            </div>
          </div>
        </section>
      </div>
    </WorkflowShell>
  );
}
