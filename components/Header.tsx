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
    // User navigation (requested naming)
    { key: 'workspace', label: 'WorkSpace' },
    { key: 'resumes', label: 'Resumes' },
    { key: 'cover_letters', label: 'Cover Letters' },
    { key: 'profile_sync', label: 'Profile Sync' },
    { key: 'account', label: 'Account' },
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
            R
          </div>
          <span className="font-bold text-xl tracking-tight">MyResume</span>
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

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-slate-200">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold">
            {currentUser.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">{currentUser.name}</div>
            <div className="text-xs text-slate-300">{isAdmin ? 'Admin' : currentUser.plan}</div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded transition-colors"
        >
          Log Out
        </button>
      </div>
    </nav>
  );
};

export default Header;
