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

  return (
    <nav className="sticky top-0 z-50 flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-6">
        <div onClick={() => setActiveTab(tabs[0].key)} className="flex shrink-0 cursor-pointer items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">
            RF
          </div>
          <span className="font-black text-xl tracking-tight">{isAdmin ? 'Admin Console' : 'ResumeForge'}</span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto md:justify-center">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={[
                'shrink-0 rounded px-3 py-2 text-sm font-black transition-colors',
                activeTab === t.key
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative group">
        <button
          type="button"
          className={`flex items-center gap-3 rounded-full border px-2 py-1.5 pr-4 transition-colors ${
            activeTab === 'account'
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          aria-label="User account menu"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-300 text-sm font-black text-slate-950 shadow-inner">
            {currentUser.name?.charAt(0)?.toUpperCase() || 'U'}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-[130px] truncate text-sm font-semibold">{currentUser.name}</span>
            <span className="block text-xs text-slate-500">{isAdmin ? 'Admin' : currentUser.plan}</span>
          </span>
          <svg className="h-4 w-4 text-slate-400 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className="invisible absolute right-0 top-full z-50 mt-3 w-64 translate-y-1 rounded-lg border border-slate-200 bg-white p-2 text-slate-800 opacity-0 shadow-2xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <div className="border-b border-slate-100 px-3 py-3">
            <div className="truncate text-sm font-bold text-slate-900">{currentUser.name}</div>
            <div className="truncate text-xs text-slate-500">{currentUser.email}</div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className="mt-2 flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
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
            className="flex w-full cursor-not-allowed items-center gap-3 rounded px-3 py-2 text-left text-sm font-semibold text-slate-400"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 8.25h19.5m-18 3.75h3m3 0h3M4.5 18.75h15a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0019.5 5.25h-15A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Payment Settings
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="mt-1 flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3H9.75m9 0l-3-3m3 3l-3 3" />
            </svg>
            Log Out
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Header;
