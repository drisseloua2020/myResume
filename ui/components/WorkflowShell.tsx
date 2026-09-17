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
  blue: 'bg-blue-600',
  green: 'bg-emerald-600',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  teal: 'bg-teal-600',
};

export function WorkflowBadge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'teal' }) {
  const classes = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    teal: 'bg-teal-50 text-teal-700',
  };
  return <span className={`inline-flex rounded px-2.5 py-1 text-xs font-black ${classes[tone]}`}>{children}</span>;
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
    <div className="min-h-[calc(100vh-4rem)] bg-[#f5f7fa] px-4 py-6 lg:px-8">
      <div className="mx-auto grid max-w-[96rem] gap-5 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {showJourneyMenu && (
            <>
              <p className="text-xs font-black uppercase text-blue-700">Journey</p>
              <h2 className="mt-2 text-lg font-black text-slate-950">Career workflow</h2>
              <div className="mt-5 space-y-2">
                {steps.map((step) => (
                  <div
                    key={step.label}
                    className={[
                      'flex items-center justify-between rounded px-3 py-2 text-sm font-black',
                      step.active ? 'bg-blue-50 text-blue-700' : 'text-slate-600',
                    ].join(' ')}
                  >
                    <span>{step.label}</span>
                    <span className="text-xs">{step.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {metrics.length > 0 && (
            <div className={showJourneyMenu ? 'mt-6 border-t border-slate-200 pt-5' : ''}>
              <div className="space-y-4">
                {metrics.map((metric) => (
                  <div key={metric.label}>
                    <div className="flex items-center justify-between text-sm font-black text-slate-900">
                      <span>{metric.label}</span>
                      <span>{metric.value}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded bg-slate-100">
                      <div className={`h-full rounded ${toneClasses[metric.tone || 'blue']}`} style={{ width: metric.value.includes('%') ? metric.value : '58%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="min-w-0 space-y-5">
          <header className="rounded-lg bg-[#243449] px-6 py-5 text-white shadow-lg shadow-slate-950/10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-blue-200">{eyebrow}</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight">{title}</h1>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-200">{description}</p>
              </div>
              {primaryAction}
            </div>
          </header>
          {children}
        </main>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-700">{asideTitle}</p>
          {asideDescription && <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{asideDescription}</p>}
          <div className="mt-5">{aside}</div>
        </aside>
      </div>
    </div>
  );
}
