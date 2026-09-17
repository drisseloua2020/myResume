import React from 'react';
import { User } from '../types';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

type Tab = { key: string; label: string };

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, activeTab, setActiveTab }) => {
  const isAdmin = currentUser.role === 'admin';

  const userTabs: Tab[] = [
    { key: 'resumes', label: 'All Resumes' },
    { key: 'workspace', label: 'Resume Editor' },
    { key: 'resume_improvements', label: 'Improvements' },
    { key: 'profile_analysis', label: 'Analysis' },
    { key: 'jobs_to_apply', label: 'Jobs' },
    { key: 'auto_apply_prep', label: 'Auto-Apply' },
    { key: 'human_approval', label: 'Approval' },
  ];

  const adminTabs: Tab[] = [
    { key: 'admin_overview', label: 'Overview' },
    { key: 'admin_users', label: 'Users' },
    { key: 'admin_features', label: 'Features' },
    { key: 'admin_automation', label: 'Automation' },
    { key: 'admin_audit', label: 'Audit and Privacy' },
  ];

  const tabs = isAdmin ? adminTabs : userTabs;
  const activeLabel = tabs.find((tab) => tab.key === activeTab)?.label || (activeTab === 'account' ? 'Account' : tabs[0].label);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#2e3d50] text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)]">
      <div className="mx-auto flex h-[62px] max-w-[100rem] items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-4 xl:gap-6">
          <button
            type="button"
            onClick={() => setActiveTab(tabs[0].key)}
            className="flex shrink-0 items-center gap-2.5 rounded-md px-1 py-1 text-left transition hover:bg-white/5"
            aria-label="Go to first workspace tab"
          >
            <span className="grid h-8 w-8 place-items-center rounded-md bg-white text-[13px] font-black text-[#2e3d50] shadow-sm">
              My
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-black tracking-normal">Resumes</span>
              <span className="hidden text-[11px] font-bold text-slate-300 sm:block">
                {isAdmin ? 'Admin CRM' : 'Career CRM'}
              </span>
            </span>
          </button>

          <nav className="hidden min-w-0 items-center gap-1 overflow-x-auto md:flex" aria-label="Primary navigation">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={[
                  'whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-extrabold transition',
                  activeTab === t.key
                    ? 'bg-white text-[#2e3d50] shadow-sm'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden h-9 w-[260px] items-center gap-2 rounded-md border border-white/10 bg-white/[0.08] px-3 text-slate-200 xl:flex">
            <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
            </svg>
            <span className="truncate text-[12px] font-bold">Search resumes, jobs, users</span>
          </div>

          <div className="hidden h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.08] px-3 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="max-w-[140px] truncate text-[12px] font-extrabold">{activeLabel}</span>
          </div>

          <div
            className="relative hidden h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.08] text-slate-100 transition hover:bg-white/[0.15] sm:grid"
            aria-hidden="true"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.25 18.75a2.25 2.25 0 01-4.5 0m8.25-6V10.5a6 6 0 10-12 0v2.25L4.5 15v1.5h15V15L18 12.75z" />
            </svg>
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-black leading-none text-[#2e3d50]">
              3
            </span>
          </div>

          <div className="relative group">
            <button
              type="button"
              className={[
                'flex h-9 items-center gap-2 rounded-md border px-1.5 pr-2 transition-colors',
                activeTab === 'account'
                  ? 'border-white/30 bg-white/[0.15] text-white'
                  : 'border-white/10 bg-white/[0.08] text-slate-100 hover:bg-white/[0.15]',
              ].join(' ')}
              aria-label="User account menu"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[12px] font-black text-[#2e3d50] shadow-inner">
                {currentUser.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block max-w-[120px] truncate text-[12px] font-extrabold">{currentUser.name}</span>
                <span className="block text-[11px] font-bold text-slate-300">{isAdmin ? 'Admin' : currentUser.plan}</span>
              </span>
              <svg className="h-4 w-4 text-slate-300 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div className="invisible absolute right-0 top-full z-50 mt-3 w-64 translate-y-1 rounded-md border border-slate-200 bg-white p-2 text-slate-800 opacity-0 shadow-2xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="border-b border-slate-100 px-3 py-3">
                <div className="truncate text-[13px] font-black text-slate-950">{currentUser.name}</div>
                <div className="truncate text-xs font-semibold text-slate-500">{currentUser.email}</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] font-extrabold text-slate-700 hover:bg-slate-50 hover:text-[#2e3d50]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 1115 0" />
                </svg>
                Account
              </button>
              <button
                type="button"
                disabled
                title="Payment settings will be available soon"
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] font-extrabold text-slate-400"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 8.25h19.5m-18 3.75h3m3 0h3M4.5 18.75h15a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0019.5 5.25h-15A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Payment Settings
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] font-extrabold text-red-600 hover:bg-red-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3H9.75m9 0l-3-3m3 3l-3 3" />
                </svg>
                Log Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
