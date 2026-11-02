import React, { useEffect, useMemo, useState } from 'react';
import { listAdminActivityLogs, listAdminUsers, listProfileSourcesCatalog, listTemplates, AdminActivityLog, AdminUserRow, ProfileSourceCatalogItem, AdminTemplate } from '../services/adminService';
import { WorkflowBadge } from './WorkflowShell';

type AdminView = 'overview' | 'users' | 'features' | 'automation' | 'audit';

const viewMeta: Record<AdminView, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: 'Admin overview',
    title: 'Admin command center.',
    description: 'Monitor usage, queues, risk, product posture, and feature access.',
  },
  users: {
    eyebrow: 'User management',
    title: "See each user's plan, activity, data, and risk status.",
    description: 'Manage accounts, entitlements, statuses, audit history, and privacy actions.',
  },
  features: {
    eyebrow: 'Workflow management',
    title: 'Control user-facing features and who can access them.',
    description: 'Enable modules, set plan access, manage templates, and enforce workflow policy.',
  },
  automation: {
    eyebrow: 'Automation control',
    title: 'Supervise auto-apply preparation without bypassing users.',
    description: 'Monitor risk, enforce blocked actions, and route packets back to users for approval.',
  },
  audit: {
    eyebrow: 'Audit and privacy',
    title: 'Make sensitive actions visible, searchable, and logged.',
    description: 'Centralize logs, privacy requests, source controls, and operational health.',
  },
};

const nav: Array<{ key: AdminView; label: string; value: string }> = [
  { key: 'overview', label: 'Overview', value: 'Live' },
  { key: 'users', label: 'Users', value: 'Accounts' },
  { key: 'features', label: 'Features', value: 'Policy' },
  { key: 'automation', label: 'Automation', value: 'Gate' },
  { key: 'audit', label: 'Audit and privacy', value: 'Logs' },
];

function Toggle({ on = true }: { on?: boolean }) {
  return (
    <span className={`relative inline-flex h-7 w-12 shrink-0 rounded-full ${on ? 'bg-emerald-600' : 'bg-slate-300'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${on ? 'left-6' : 'left-1'}`} />
    </span>
  );
}

function AdminCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rf-card p-4">
      <p className="rf-eyebrow">{eyebrow}</p>
      <h3 className="mt-1.5 text-lg font-black text-slate-950">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function AdminWorkflowConsolePage({ view }: { view: AdminView }) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [sources, setSources] = useState<ProfileSourceCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listAdminUsers().catch(() => []),
      listAdminActivityLogs().catch(() => []),
      listTemplates().catch(() => []),
      listProfileSourcesCatalog().catch(() => []),
    ])
      .then(([userRows, logRows, templateRows, sourceRows]) => {
        if (!alive) return;
        setUsers(userRows);
        setLogs(logRows);
        setTemplates(templateRows);
        setSources(sourceRows);
        setError(null);
      })
      .catch((err: any) => {
        if (alive) setError(err?.message || 'Admin data could not load.');
      });
    return () => {
      alive = false;
    };
  }, []);

  const activeUsers = useMemo(() => users.filter((user) => user.status !== 'Canceled').length, [users]);
  const meta = viewMeta[view];

  const renderMain = () => {
    if (view === 'users') {
      return (
        <div className="rf-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="rf-eyebrow">Directory</p>
              <h2 className="mt-1.5 text-xl font-black text-slate-950">Users</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <WorkflowBadge tone="blue">Search</WorkflowBadge>
              <WorkflowBadge>Role</WorkflowBadge>
              <WorkflowBadge>Plan</WorkflowBadge>
              <WorkflowBadge>Status</WorkflowBadge>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {users.slice(0, 8).map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-4">
                      <div className="font-black text-slate-950">{user.name}</div>
                      <div className="text-xs font-semibold text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{user.role}</td>
                    <td className="px-4 py-4"><WorkflowBadge tone={user.plan?.toLowerCase().includes('free') ? 'slate' : 'green'}>{user.plan || 'Free'}</WorkflowBadge></td>
                    <td className="px-4 py-4"><WorkflowBadge tone={user.status === 'Canceled' ? 'red' : 'green'}>{user.status || 'Active'}</WorkflowBadge></td>
                    <td className="px-4 py-4"><button type="button" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800">Open</button></td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td className="px-4 py-5 text-sm font-semibold text-slate-500" colSpan={5}>No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (view === 'features') {
      const features = [
        ['All resumes', 'Resume library', 'Manage master resumes, versions, shared links, and imports.', 'Free+'],
        ['Resume editor', 'Section editing', 'Edit sections, suggestions, ATS safety, version save, export.', 'Core'],
        ['Improvements', 'Guided coaching', 'Readiness score, next-best action, and role-specific fixes.', 'Pro'],
        ['Profile analysis', 'Direction engine', 'Combines onboarding answers and resume to guide next steps.', 'Pro'],
        ['Jobs', 'Apply targets', 'Job matching, batch builder, fit reasons, packet status.', 'Pro'],
        ['Auto-apply', 'Preparation only', 'Prepares packets but cannot submit without human approval.', 'Beta'],
      ];
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map(([eyebrow, title, description, plan]) => (
            <AdminCard key={eyebrow} eyebrow={eyebrow} title={title}>
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-semibold leading-6 text-slate-600">{description}</p>
                <Toggle on />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <WorkflowBadge tone={plan === 'Beta' ? 'amber' : 'green'}>{plan}</WorkflowBadge>
                <WorkflowBadge>Audited</WorkflowBadge>
              </div>
            </AdminCard>
          ))}
        </div>
      );
    }

    if (view === 'automation') {
      return (
        <div className="grid gap-5 lg:grid-cols-2">
          <AdminCard eyebrow="Queue" title="Packets needing attention">
            <div className="space-y-3">
              {[
                ['Salary answer requires review', 'Maya Chen - Technical Support Specialist packet.', 'User approval', 'amber'],
                ['Custom screening answer drafted', 'Noah Patel - Customer Support Engineer.', 'Input needed', 'amber'],
                ['Low-fit job held', 'Junior QA role below configured threshold.', 'Blocked', 'red'],
                ['Job-board source missing', 'External submission remains unavailable.', 'Policy OK', 'teal'],
              ].map(([title, detail, status, tone]) => (
                <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{title}</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{detail}</p>
                    </div>
                    <WorkflowBadge tone={tone as any}>{status}</WorkflowBadge>
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>
          <AdminCard eyebrow="Policy rules" title="Submission safety">
            <div className="divide-y divide-slate-200">
              {[
                ['Prepare packets automatically', 'Create resume version, cover note, tracker entry.', true],
                ['Require user approval', 'Every packet must be explicitly approved.', true],
                ['Allow external submission', 'Requires connected job source and user approval.', false],
                ['Apply below fit threshold', 'Blocked when fit is below 70.', false],
              ].map(([title, detail, enabled]) => (
                <div key={String(title)} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-black text-slate-950">{title}</p>
                    <p className="text-sm font-semibold leading-6 text-slate-600">{detail}</p>
                  </div>
                  <Toggle on={Boolean(enabled)} />
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      );
    }

    if (view === 'audit') {
      return (
        <div className="grid gap-5 lg:grid-cols-2">
          <AdminCard eyebrow="Activity log" title="Recent events">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">User</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.slice(0, 6).map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="px-4 py-4 font-black text-slate-950">{log.action}</td>
                      <td className="px-4 py-4 text-slate-700">{log.userName}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td className="px-4 py-5 text-sm font-semibold text-slate-500" colSpan={3}>No logs found.</td></tr>}
                </tbody>
              </table>
            </div>
          </AdminCard>
          <AdminCard eyebrow="Privacy queue" title="Requests">
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-950">Data export request</p><p className="mt-1 text-sm font-semibold text-slate-600">User requested full career toolkit export.</p><button className="mt-3 rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black">Review export</button></div>
              <div className="rounded-lg border border-red-100 bg-red-50 p-4"><p className="font-black text-slate-950">Delete career data</p><p className="mt-1 text-sm font-semibold text-slate-600">Delete resumes, analyses, job tracker, shares, and achievements.</p><button className="mt-3 rounded bg-red-100 px-4 py-2 text-sm font-black text-red-700">Confirm delete</button></div>
            </div>
          </AdminCard>
        </div>
      );
    }

    return (
      <>
        <div className="grid gap-4 md:grid-cols-4">
          <AdminCard eyebrow="Users" title={String(users.length || 0)}>
            <p className="text-sm font-semibold text-slate-600">{activeUsers} active accounts</p>
          </AdminCard>
          <AdminCard eyebrow="Resumes" title="8,942">
            <p className="text-sm font-semibold text-slate-600">612 edited this week</p>
          </AdminCard>
          <AdminCard eyebrow="Approval queue" title="19">
            <p className="text-sm font-semibold text-slate-600">7 need human decision</p>
          </AdminCard>
          <AdminCard eyebrow="Templates" title={String(templates.length || 0)}>
            <p className="text-sm font-semibold text-slate-600">{sources.length} profile sources</p>
          </AdminCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <AdminCard eyebrow="Resume system" title="Editor and version library">
            <p className="text-sm font-semibold leading-6 text-slate-600">Monitor creation, imports, exports, shared links, and template usage.</p>
            <div className="mt-4 flex gap-2"><WorkflowBadge tone="green">Healthy</WorkflowBadge><WorkflowBadge>{templates.length || 8} templates</WorkflowBadge></div>
          </AdminCard>
          <AdminCard eyebrow="Profile analysis" title="Guidance and readiness scoring">
            <p className="text-sm font-semibold leading-6 text-slate-600">Track generated analyses, gaps, job target usage, and deterministic rules.</p>
            <div className="mt-4 flex gap-2"><WorkflowBadge tone="teal">No LLM calls</WorkflowBadge><WorkflowBadge tone="blue">Enabled</WorkflowBadge></div>
          </AdminCard>
          <AdminCard eyebrow="Auto-apply" title="Preparation with human approval">
            <p className="text-sm font-semibold leading-6 text-slate-600">Admin controls policies, approval queues, and blocked submission rules.</p>
            <div className="mt-4 flex gap-2"><WorkflowBadge tone="amber">19 queued</WorkflowBadge><WorkflowBadge tone="green">Human gate on</WorkflowBadge></div>
          </AdminCard>
        </div>
        <AdminCard eyebrow="Attention feed" title="Needs admin review">
          <div className="grid gap-3">
            {[
              ['Auto-apply packet uses salary answer', 'Maya Chen', 'Review'],
              ['Data delete request pending', 'Jon Bell', 'Privacy'],
              ['Template import failure spike', 'System', 'Ops'],
            ].map(([item, user, severity]) => (
              <div key={item} className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[1fr_160px_120px_120px] md:items-center">
                <p className="font-black text-slate-950">{item}</p>
                <p className="text-sm font-semibold text-slate-600">{user}</p>
                <WorkflowBadge tone={severity === 'Privacy' ? 'red' : 'amber'}>{severity}</WorkflowBadge>
                <button type="button" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-800">Open</button>
              </div>
            ))}
          </div>
        </AdminCard>
      </>
    );
  };

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#f5f7fb] px-4 py-5 lg:px-6">
      <div className="mx-auto grid max-w-[100rem] gap-4 xl:grid-cols-[248px_minmax(0,1fr)_300px]">
        <aside className="rf-card p-4">
          <p className="rf-eyebrow">Admin</p>
          <h2 className="mt-2 text-[17px] font-black text-slate-950">Command center</h2>
          <div className="mt-4 space-y-1.5">
            {nav.map((item) => (
              <div key={item.key} className={`flex items-center justify-between rounded-md px-3 py-2 text-[13px] font-black ${view === item.key ? 'bg-[#2e3d50]/10 text-[#2e3d50]' : 'text-slate-600 hover:bg-slate-50'}`}>
                <span>{item.label}</span>
                <span className="text-[11px]">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="space-y-3.5">
              <div className="flex gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-[13px] font-black text-white">1</span>
                <div><p className="text-[13px] font-black text-slate-950">Observe</p><p className="text-[13px] font-semibold text-slate-600">Usage, queues, risk, and revenue signals.</p></div>
              </div>
              <div className="flex gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#2e3d50] text-[13px] font-black text-white">2</span>
                <div><p className="text-[13px] font-black text-slate-950">Manage</p><p className="text-[13px] font-semibold text-slate-600">Users, plans, templates, sources, workflows.</p></div>
              </div>
              <div className="flex gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 text-[13px] font-black text-white">3</span>
                <div><p className="text-[13px] font-black text-slate-950">Intervene</p><p className="text-[13px] font-semibold text-slate-600">Handle flagged automation and privacy requests.</p></div>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <header className="rounded-lg bg-[#243449] px-5 py-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.15)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase text-slate-300">{meta.eyebrow}</p>
                <h1 className="mt-1.5 text-2xl font-black tracking-normal">{meta.title}</h1>
                <p className="mt-2 max-w-3xl text-[13px] font-semibold leading-6 text-slate-200">{meta.description}</p>
              </div>
              <button type="button" className="rounded-md bg-white px-5 py-2.5 text-[13px] font-black text-[#243449] shadow-sm">
                {view === 'overview' ? 'Open action queue' : 'Save policy'}
              </button>
            </div>
          </header>
          {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
          {renderMain()}
        </main>

        <aside className="rf-card p-4">
          <p className="rf-eyebrow">System posture</p>
          <h2 className="mt-1.5 text-xl font-black text-slate-950">Safe to operate</h2>
          <div className="mt-5 divide-y divide-slate-200">
            <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-[13px] font-black text-slate-950">Human approval gate</p><p className="text-[13px] font-semibold text-slate-600">Required before external submissions.</p></div><Toggle on /></div>
            <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-[13px] font-black text-slate-950">Broad auto-apply</p><p className="text-[13px] font-semibold text-slate-600">Disabled until source exists.</p></div><Toggle on={false} /></div>
            <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-[13px] font-black text-slate-950">Profile analysis</p><p className="text-[13px] font-semibold text-slate-600">Enabled for active users.</p></div><Toggle on /></div>
          </div>
          <div className="rf-card-soft mt-5 p-4">
            <p className="text-[13px] font-black text-slate-950">Admin principle</p>
            <p className="mt-2 text-[13px] font-semibold leading-6 text-slate-600">Admins control policy and recovery. Users keep control over personal submissions.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
