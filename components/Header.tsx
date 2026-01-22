import React from 'react';
import { User } from '../types';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, activeTab, setActiveTab }) => {
  return (
    <nav className="bg-[#2e3d50] text-white h-16 flex items-center justify-between px-6 lg:px-12 shadow-md z-50 sticky top-0">
      <div className="flex items-center gap-8">
        <div 
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2 cursor-pointer"
        >
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold text-lg text-white">
              My
            </div>

          <span className="font-bold text-xl tracking-tight">Resume</span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`hover:text-white transition-colors ${activeTab === 'dashboard' ? 'text-white' : ''}`}
          >
            Resumes
          </button>
          <button 
             onClick={() => setActiveTab('cover_letter_dashboard')}
             className={`hover:text-white transition-colors ${activeTab === 'cover_letter_dashboard' ? 'text-white' : ''}`}
          >
            Cover Letters
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => setActiveTab('settings')}
          className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block"
        >
          Account
        </button>
        <div className="h-4 w-[1px] bg-slate-600 hidden sm:block"></div>
        <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
                <span className="text-sm font-medium">{currentUser.name}</span>
            </div>
            <button
                onClick={onLogout}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded transition-colors"
            >
                Log Out
            </button>
        </div>
      </div>
    </nav>
  );
};

export default Header;
