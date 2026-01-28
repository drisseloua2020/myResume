import React from 'react';
import { User, UserRole } from '../types';

interface SidebarProps {
  currentUser: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, onLogout, activeTab, setActiveTab }) => {
  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-blue-500">⚡</span> ResumeForge
        </h1>
        <p className="text-xs text-slate-400 mt-1">AI-Powered Career Tools</p>
      </div>

      <div className="flex-1 py-6 px-4 space-y-2">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
          Tools
        </div>
        <button
          onClick={() => setActiveTab('generator')}
          className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
            activeTab === 'generator' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Resume Generator
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
            activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          My Documents
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
            activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Account Settings
        </button>

        <button
          onClick={() => setActiveTab('contact')}
          className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
            activeTab === 'contact' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Contact Support
        </button>

        {currentUser.role === UserRole.ADMIN && (
          <>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-2">
              Admin
            </div>
            <button
              onClick={() => setActiveTab('admin_users')}
              className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
                activeTab === 'admin_users' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('admin_audit')}
              className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
                activeTab === 'admin_audit' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Audit & Billing
            </button>
          </>
        )}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-medium truncate">{currentUser.name}</div>
            <div className="text-xs text-slate-400 truncate capitalize">{currentUser.role}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;