import React from 'react';

export type WorkflowMetric = {
  label: string;
  value: string;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'teal';
};

export type WorkflowStep = {
  label: string;
  status: string;
  active?: boolean;
};

type WorkflowShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: React.ReactNode;
  steps: WorkflowStep[];
  showJourneyMenu?: boolean;
  metrics?: WorkflowMetric[];
  asideTitle?: string;
  asideDescription?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
};

const toneClasses: Record<NonNullable<WorkflowMetric['tone']>, string> = {
  blue: 'bg-[#2e3d50]',
  green: 'bg-emerald-600',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  teal: 'bg-teal-600',
};

export function WorkflowBadge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'teal' }) {
  const classes = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-[#2e3d50]/10 text-[#2e3d50]',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    teal: 'bg-teal-50 text-teal-700',
  };
  return <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-black leading-none ${classes[tone]}`}>{children}</span>;
}

export default function WorkflowShell({
  eyebrow,
  title,
  description,
  primaryAction,
  steps,
  showJourneyMenu = true,
  metrics = [],
  asideTitle = 'Workflow',
  asideDescription,
  aside,
  children,
}: WorkflowShellProps) {
  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#f5f7fb] px-4 py-5 lg:px-6">
      <div className="mx-auto grid max-w-[100rem] gap-4 xl:grid-cols-[248px_minmax(0,1fr)_300px]">
        <aside className="rf-card p-4">
          {showJourneyMenu && (
            <>
              <p className="rf-eyebrow">Journey</p>
              <h2 className="mt-2 text-[17px] font-black text-slate-950">Career workflow</h2>
              <div className="mt-4 space-y-1.5">
                {steps.map((step) => (
                  <div
                    key={step.label}
                    className={[
                      'flex items-center justify-between rounded-md px-3 py-2 text-[13px] font-black',
                      step.active ? 'bg-[#2e3d50]/10 text-[#2e3d50]' : 'text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span>{step.label}</span>
                    <span className="text-[11px]">{step.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {metrics.length > 0 && (
            <div className={showJourneyMenu ? 'mt-5 border-t border-slate-200 pt-4' : ''}>
              {!showJourneyMenu && <p className="rf-eyebrow">Scores</p>}
              <div className="space-y-3.5">
                {metrics.map((metric) => (
                  <div key={metric.label} className={!showJourneyMenu ? 'mt-4' : ''}>
                    <div className="flex items-center justify-between text-[13px] font-black text-slate-900">
                      <span>{metric.label}</span>
                      <span>{metric.value}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-100">
                      <div className={`h-full rounded ${toneClasses[metric.tone || 'blue']}`} style={{ width: metric.value.includes('%') ? metric.value : '58%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!showJourneyMenu && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="rf-eyebrow">Review mode</p>
              <p className="mt-3 text-[13px] font-semibold leading-6 text-slate-600">
                Completion metrics stay pinned while fixes, targets, and readiness update from the current resume.
              </p>
              <WorkflowBadge tone="teal">Focused review</WorkflowBadge>
            </div>
          )}
        </aside>

        <main className="min-w-0 space-y-4">
          <header className="rounded-lg bg-[#243449] px-5 py-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.15)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase text-slate-300">{eyebrow}</p>
                <h1 className="mt-1.5 text-2xl font-black tracking-normal">{title}</h1>
                <p className="mt-2 max-w-3xl text-[13px] font-semibold leading-6 text-slate-200">{description}</p>
              </div>
              {primaryAction}
            </div>
          </header>
          {children}
        </main>

        <aside className="rf-card p-4">
          <p className="rf-eyebrow">{asideTitle}</p>
          {asideDescription && <p className="mt-2 text-[13px] font-semibold leading-6 text-slate-600">{asideDescription}</p>}
          <div className="mt-4">{aside}</div>
        </aside>
      </div>
    </div>
  );
}
