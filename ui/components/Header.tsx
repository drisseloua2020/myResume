import React from 'react';
import { User } from '../types';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  demoProviders?: boolean;
}

const userTabs = [
  ['resumes', 'All Resumes'], ['workspace', 'Resume Editor'], ['resume_improvements', 'Improvements'],
  ['profile_analysis', 'Analysis'], ['cover_letters', 'Cover Letters'], ['career_tools', 'Career Tools'],
  ['jobs_to_apply', 'Jobs'], ['auto_apply_prep', 'Prepare Packets'], ['human_approval', 'Approval'],
  ['profile_sync', 'Profile Sources'], ['contact', 'Support'], ['account', 'Account'],
  ['career_blog', 'Career Blog'], ['resume_guide', 'Resume Guide'], ['resume_examples', 'Examples'],
];
const adminTabs = [
  ['admin_overview', 'Overview'], ['admin_users', 'Users'], ['admin_features', 'Features'],
  ['admin_automation', 'Automation'], ['admin_audit', 'Audit and Privacy'], ['admin_resumes', 'Resumes'],
  ['admin_logs', 'Activity Logs'], ['admin_contacts', 'Support'], ['account', 'Account'],
];

export default function Header({ currentUser, onLogout, activeTab, setActiveTab, demoProviders = false }: HeaderProps) {
  const tabs = [...(currentUser.role === 'admin' ? adminTabs : userTabs), ...(demoProviders ? [['provider_demo', 'Provider Demo']] : [])];
  return <header className="sticky top-0 z-50 border-b border-slate-200 bg-white text-slate-900">
    <div className="mx-auto flex max-w-[100rem] items-center justify-between gap-3 px-4 py-3">
      <button className="shrink-0 text-xl font-bold" onClick={() => setActiveTab(tabs[0][0])}>MyResumes</button>
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <button className="max-w-40 truncate font-semibold" onClick={() => setActiveTab('account')}>{currentUser.name}</button>
        <button className="shrink-0 rounded border border-slate-300 px-3 py-2" onClick={onLogout}>Log Out</button>
      </div>
    </div>
    <nav aria-label="Primary navigation" className="mx-auto hidden max-w-[100rem] gap-1 overflow-x-auto px-4 md:flex">
      {tabs.map(([key, label]) => <button key={key} aria-current={activeTab === key ? 'page' : undefined}
        onClick={() => setActiveTab(key)} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${activeTab === key ? 'border-blue-700 text-blue-700' : 'border-transparent hover:bg-slate-50'}`}>{label}</button>)}
    </nav>
    <div className="px-4 pb-3 md:hidden"><select aria-label="Navigate workspace" value={tabs.some(([key]) => key === activeTab) ? activeTab : 'workspace'} onChange={e => setActiveTab(e.target.value)} className="w-full rounded border border-slate-300 bg-white p-2 text-sm">
      {tabs.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></div>
  </header>;
}
