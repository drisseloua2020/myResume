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
    { key: 'resumes', label: 'View Resume' },
    { key: 'cover_letters', label: 'Cover Letters' },
    { key: 'workspace', label: 'Editor' },
  ];

  const adminTabs: Tab[] = [
    { key: 'admin_logs', label: 'Activity Logs' },
    { key: 'admin_agents', label: 'Agent Updates' },
    { key: 'admin_contacts', label: 'Contact Messages' },
    { key: 'admin_users', label: 'Users' },
    { key: 'admin_resumes', label: 'Resumes' },
  ];

  const tabs = isAdmin ? adminTabs : userTabs;

  return (
    <nav className="bg-[#2e3d50] text-white h-16 flex items-center justify-between px-6 lg:px-12 shadow-md z-50 sticky top-0">
      <div className="flex items-center gap-8">
        <div onClick={() => setActiveTab(tabs[0].key)} className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold text-lg">
            My
          </div>
          <span className="font-bold text-xl tracking-tight">Resumes</span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`hover:text-white transition-colors ${activeTab === t.key ? 'text-white' : ''}`}
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
              ? 'border-blue-300 bg-white/15 text-white'
              : 'border-white/10 bg-slate-700/60 text-slate-100 hover:bg-slate-700'
          }`}
          aria-label="User account menu"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-cyan-300 text-sm font-black text-slate-900 shadow-inner">
            {currentUser.name?.charAt(0)?.toUpperCase() || 'U'}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-[130px] truncate text-sm font-semibold">{currentUser.name}</span>
            <span className="block text-xs text-slate-300">{isAdmin ? 'Admin' : currentUser.plan}</span>
          </span>
          <svg className="h-4 w-4 text-slate-300 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
