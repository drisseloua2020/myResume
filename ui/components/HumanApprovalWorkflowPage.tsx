import React, { useState } from 'react';
import WorkflowShell, { WorkflowBadge, WorkflowStep } from './WorkflowShell';

const steps: WorkflowStep[] = [
  { label: 'All resumes', status: 'Library' },
  { label: 'Resume editor', status: 'Edit' },
  { label: 'Improvements', status: 'Ready' },
  { label: 'Analysis', status: 'Done' },
  { label: 'Jobs', status: 'Selected' },
  { label: 'Auto-apply', status: 'Prepared' },
  { label: 'Approval', status: 'Now', active: true },
];

const queue = [
  { title: 'Technical Support Specialist', company: 'BrightLayer SaaS', status: 'Safe', tone: 'green' as const },
  { title: 'Application Support Analyst', company: 'Northstar Health', status: 'Check', tone: 'amber' as const },
  { title: 'Customer Support Engineer', company: 'Helpdesk Cloud', status: 'Input', tone: 'amber' as const },
  { title: 'Junior QA Analyst', company: 'ProductWorks', status: 'Risk', tone: 'red' as const },
];

export default function HumanApprovalWorkflowPage() {
  const [selected, setSelected] = useState(queue[0]);

  return (
    <WorkflowShell
      eyebrow="Human approval"
      title="Review exactly what will be submitted before the system acts."
      description="The user can approve, edit, hold, or reject every prepared job packet. Nothing is submitted silently."
      steps={steps}
      primaryAction={
        <div className="flex gap-2">
          <button type="button" className="rounded bg-white px-5 py-3 text-sm font-black text-[#243449]">Approve selected</button>
          <button type="button" className="rounded bg-emerald-600 px-5 py-3 text-sm font-black text-white">Approve all safe</button>
        </div>
      }
      asideTitle="Trust rule"
      asideDescription="Every automation output must show source, change summary, risk, and approval controls."
      aside={
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-950">Needs approval</p>
            <div className="mt-1 text-3xl font-black text-slate-950">5</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-950">Human gate active</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">External submission remains unavailable until the user approves the exact packet.</p>
          </div>
          <div className="grid gap-2">
            <button type="button" className="rounded bg-blue-700 px-5 py-3 text-sm font-black text-white">Approve this packet</button>
            <button type="button" className="rounded border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800">Edit packet</button>
            <button type="button" className="rounded bg-red-50 px-5 py-3 text-sm font-black text-red-700">Reject</button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-700">Queue</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Packets awaiting review</h2>
          <div className="mt-4 space-y-3">
            {queue.map((item) => (
              <button
                type="button"
                key={item.title}
                onClick={() => setSelected(item)}
                className={`w-full rounded-lg border p-4 text-left transition ${selected.title === item.title ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{item.company}. Packet ready for review.</p>
                  </div>
                  <WorkflowBadge tone={item.tone}>{item.status}</WorkflowBadge>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-blue-700">Selected packet</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">{selected.title} at {selected.company}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Prepared from the current support resume. No external submission yet.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <WorkflowBadge tone="green">82 fit</WorkflowBadge>
              <WorkflowBadge tone="blue">Remote</WorkflowBadge>
              <WorkflowBadge tone={selected.tone}>{selected.status}</WorkflowBadge>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-blue-700">Resume changes</p>
              <h3 className="mt-2 text-lg font-black text-slate-950">Tailored summary and bullets</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Added technical support headline, moved API troubleshooting higher, and inserted support volume metric placeholder.</p>
              <div className="mt-4 h-2 w-4/5 rounded bg-blue-100" />
              <div className="mt-2 h-2 w-full rounded bg-slate-200" />
              <div className="mt-2 h-2 w-3/4 rounded bg-slate-200" />
              <div className="mt-4"><WorkflowBadge tone="amber">One placeholder needs confirmation</WorkflowBadge></div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-blue-700">Application answers</p>
              <h3 className="mt-2 text-lg font-black text-slate-950">Reusable answers detected</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Work authorization confirmed. Salary expectation requires approval before reuse.</p>
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-black text-slate-950">Salary expectation</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Draft: Open to market range based on role scope and total compensation.</p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-blue-700">Risk check</p>
                <h3 className="mt-2 text-lg font-black text-slate-950">Nothing will be submitted until approved</h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">The approval screen defines the interaction contract even before any job-board connector exists.</p>
              </div>
              <WorkflowBadge tone="green">Human gate active</WorkflowBadge>
            </div>
          </div>
        </section>
      </div>
    </WorkflowShell>
  );
}
