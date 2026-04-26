import React, { useState } from 'react';
import { ParsedResponse } from '../types';
import { saveResume } from '../services/resumeService';
import { AVAILABLE_TEMPLATES } from '../constants';

interface ResultsDisplayProps {
  results: ParsedResponse;
  templateId?: string;
  onReset: () => void;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, templateId, onReset }) => {
  const [activeTab, setActiveTab] = useState<string>('ats');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Order of tabs for the viewer
  const tabs = [
    { id: 'ats', label: 'ATS Optimized', content: results.resumeAts },
    { id: 'human', label: 'Human Readable', content: results.resumeHuman },
    { id: 'targeted', label: 'Targeted', content: results.resumeTargeted },
    { id: 'cl_full', label: 'Cover Letter', content: results.coverLetterFull },
    { id: 'gap', label: 'Analysis', content: results.gapAndFix },
  ];

  const activeContent = tabs.find(t => t.id === activeTab)?.content;

  const downloadContent = () => {
    if (!activeContent) return;
    const blob = new Blob([typeof activeContent === 'object' ? JSON.stringify(activeContent, null, 2) : activeContent.toString()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume_forge_${activeTab}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveToLibrary = async () => {
    if (!templateId) {
      alert('Select a template first');
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const tName = AVAILABLE_TEMPLATES.find(t => t.id === templateId)?.name || templateId;
      const title = results.json?.header?.title || `Resume (${tName})`;
      await saveResume({ templateId, title, content: results });
      setSaveMsg('Saved to your library');
    } catch (e: any) {
      setSaveMsg(e?.message ? `Save failed: ${e.message}` : 'Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#525659] z-50 flex flex-col h-screen">
      {/* Viewer Header */}
      <div className="bg-[#323639] h-16 flex items-center justify-between px-6 shadow-md shrink-0">
        <div className="flex items-center gap-4">
           <button 
             onClick={onReset}
             className="text-slate-300 hover:text-white flex items-center gap-2 text-sm font-medium"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             Back to Editor
           </button>
           <div className="h-6 w-[1px] bg-slate-600 mx-2"></div>
           <span className="text-white font-semibold tracking-wide">Resume Preview</span>
        </div>

        <div className="flex bg-[#424649] rounded p-1">
           {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-black/40 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
           ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveToLibrary}
            disabled={saving}
            className="bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 text-white px-4 py-2 rounded font-medium text-sm flex items-center gap-2 shadow"
          >
            {saving ? 'Saving…' : 'Save to Library'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </button>
          <button
            onClick={downloadContent}
            className="bg-[#1a91f0] hover:bg-[#1170cd] text-white px-4 py-2 rounded font-medium text-sm flex items-center gap-2 shadow"
          >
            Download TXT
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
          {saveMsg && <span className="text-xs text-slate-200 ml-2">{saveMsg}</span>}
        </div>
      </div>

      {/* Document Viewer Area */}
      <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-[#525659]">
        <div className="bg-white shadow-2xl w-full max-w-[800px] min-h-[1100px] p-[60px] text-slate-800 text-sm leading-relaxed font-sans relative">
           {activeTab === 'gap' ? (
             <div className="space-y-6">
                <h3 className="text-2xl font-bold text-slate-800 border-b pb-4 mb-6">Gap Analysis & Improvements</h3>
                <div className="space-y-4">
                    {Array.isArray(activeContent) && activeContent.map((item, idx) => (
                        <div key={idx} className="flex gap-4 p-4 bg-red-50 border-l-4 border-red-400 text-slate-700">
                             <div className="text-red-500 mt-1">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                             </div>
                             <div>{item}</div>
                        </div>
                    ))}
                     {(!activeContent || (Array.isArray(activeContent) && activeContent.length === 0)) && (
                        <p className="text-green-600 font-medium">Great job! No critical gaps detected.</p>
                     )}
                </div>
             </div>
           ) : (
             <div className="whitespace-pre-wrap font-mono text-xs md:text-sm">
                {activeContent as string || "Generating content..."}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default ResultsDisplay;
