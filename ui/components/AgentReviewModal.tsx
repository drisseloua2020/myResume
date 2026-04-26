import React from 'react';
import { AgentUpdate } from '../types';

interface AgentReviewModalProps {
  updates: AgentUpdate[];
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const AgentReviewModal: React.FC<AgentReviewModalProps> = ({ updates, onClose, onApprove, onReject }) => {
  const pendingUpdates = updates.filter(u => u.status === 'pending');

  if (pendingUpdates.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden animate-fade-in-up">
        
        {/* Header with AI Gradient */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 flex justify-between items-center text-white">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Resume Agent Update</h2>
                <p className="text-xs text-indigo-100 opacity-90">Auto-detected changes from your connected feeds</p>
              </div>
           </div>
           <button onClick={onClose} className="text-white/70 hover:text-white">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>

        <div className="p-8 bg-slate-50">
           <p className="text-slate-600 mb-6 text-sm">
             We noticed new activity on your <strong>GitHub</strong> and <strong>LinkedIn</strong>. 
             Review these items to automatically update your resume.
           </p>

           <div className="space-y-4">
             {pendingUpdates.map(update => (
               <div key={update.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
                  {/* Icon */}
                  <div className={`p-3 rounded-full flex-shrink-0 ${update.source === 'GitHub' ? 'bg-slate-100 text-slate-800' : 'bg-blue-50 text-blue-600'}`}>
                     {update.source === 'GitHub' ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                     ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                     )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                     <div className="flex justify-between items-start">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 block">{update.type} • {update.source}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">New</span>
                     </div>
                     <h4 className="text-md font-bold text-slate-800">{update.title}</h4>
                     <p className="text-sm text-slate-600 mt-1">{update.description}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                     <button onClick={() => onReject(update.id)} className="px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-colors">
                        Ignore
                     </button>
                     <button onClick={() => onApprove(update.id)} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-md transition-colors flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Add
                     </button>
                  </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default AgentReviewModal;