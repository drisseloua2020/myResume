import React from 'react';
import { AVAILABLE_TEMPLATES } from '../constants';

interface TemplateSelectorProps {
  onSelect: (templateId: string) => void;
  selectedId?: string;
  className?: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ onSelect, selectedId, className = '' }) => {
  
  // Render a detailed CSS-only preview of the specific template layout
  const renderPreview = (id: string, colorClass: string) => {
    // Common text line helper
    const TextLine = ({ w, className = '' }: { w: string, className?: string }) => (
      <div className={`h-1 rounded-[1px] ${className}`} style={{ width: w }}></div>
    );

    // --- CLASSIC PROFESSIONAL ---
    if (id === 'classic_pro') {
      return (
        <div className="w-full h-48 bg-white border border-slate-100 rounded shadow-sm p-4 relative overflow-hidden flex flex-col gap-2 pointer-events-none select-none">
           {/* Classic Header: Centered */}
           <div className="flex flex-col items-center border-b-2 border-slate-800 pb-2 mb-1">
              <div className="w-1/2 h-2 bg-slate-800 mb-1"></div>
              <div className="w-1/3 h-1 bg-slate-400"></div>
           </div>
           {/* Body: Single Column */}
           <div className="space-y-2 pt-1">
              <div className="flex justify-between items-end">
                 <div className="w-1/4 h-1.5 bg-slate-700"></div>
                 <div className="w-1/6 h-1 bg-slate-400"></div>
              </div>
              <TextLine w="100%" className="bg-slate-200" />
              <TextLine w="90%" className="bg-slate-200" />
              <TextLine w="95%" className="bg-slate-200" />
              
              <div className="flex justify-between items-end mt-2">
                 <div className="w-1/4 h-1.5 bg-slate-700"></div>
                 <div className="w-1/6 h-1 bg-slate-400"></div>
              </div>
              <TextLine w="100%" className="bg-slate-200" />
              <TextLine w="85%" className="bg-slate-200" />
           </div>
        </div>
      );
    }

    // --- MODERN TECH ---
    if (id === 'modern_tech') {
      return (
        <div className="w-full h-48 bg-white border border-slate-100 rounded shadow-sm flex overflow-hidden pointer-events-none select-none">
           {/* Sidebar */}
           <div className="w-1/3 bg-slate-100 h-full p-2 flex flex-col gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-300 mb-2 self-center"></div>
              <div className="w-full h-1 bg-slate-300 mt-2"></div>
              <div className="w-2/3 h-1 bg-slate-300"></div>
              <div className="w-full h-1 bg-slate-300 mt-4"></div>
              <div className="w-4/5 h-1 bg-slate-300"></div>
              <div className="w-3/4 h-1 bg-slate-300"></div>
           </div>
           {/* Main */}
           <div className="flex-1 p-3 flex flex-col gap-2">
              <div className="flex flex-col gap-1 mb-2">
                 <div className={`w-3/4 h-2.5 ${colorClass.replace('bg-', 'bg-') || 'bg-blue-600'}`}></div>
                 <div className="w-1/2 h-1.5 bg-slate-400"></div>
              </div>
              <div className="w-1/4 h-1.5 bg-slate-700 mt-1"></div>
              <TextLine w="100%" className="bg-slate-200" />
              <TextLine w="95%" className="bg-slate-200" />
              <TextLine w="90%" className="bg-slate-200" />

              <div className="w-1/3 h-1.5 bg-slate-700 mt-2"></div>
              <TextLine w="100%" className="bg-slate-200" />
              <TextLine w="80%" className="bg-slate-200" />
           </div>
        </div>
      );
    }

    // --- CREATIVE BOLD ---
    if (id === 'creative_bold') {
       return (
        <div className="w-full h-48 bg-white border border-slate-100 rounded shadow-sm relative overflow-hidden flex flex-col pointer-events-none select-none">
           {/* Header Banner */}
           <div className={`h-12 w-full ${colorClass || 'bg-purple-600'} p-3 flex items-center justify-between`}>
              <div className="w-1/2 h-2.5 bg-white/90"></div>
              <div className="w-8 h-8 rounded-full bg-white/30"></div>
           </div>
           {/* Body */}
           <div className="flex-1 p-3 grid grid-cols-2 gap-3">
              <div className="space-y-2">
                 <div className={`w-1/2 h-1.5 ${colorClass} opacity-60`}></div>
                 <TextLine w="100%" className="bg-slate-200" />
                 <TextLine w="80%" className="bg-slate-200" />
                 <TextLine w="90%" className="bg-slate-200" />
                 <div className={`w-1/3 h-1.5 ${colorClass} opacity-60 mt-2`}></div>
                 <TextLine w="100%" className="bg-slate-200" />
                 <TextLine w="70%" className="bg-slate-200" />
              </div>
              <div className="space-y-2">
                 <div className="bg-slate-50 p-1 rounded">
                    <div className={`w-1/2 h-1.5 ${colorClass} opacity-60 mb-1`}></div>
                    <TextLine w="100%" className="bg-slate-200" />
                 </div>
                 <div className="bg-slate-50 p-1 rounded">
                    <div className={`w-1/2 h-1.5 ${colorClass} opacity-60 mb-1`}></div>
                    <TextLine w="100%" className="bg-slate-200" />
                 </div>
              </div>
           </div>
        </div>
       );
    }

    // --- EXECUTIVE LEAD ---
    if (id === 'executive_lead') {
       return (
        <div className="w-full h-48 bg-white border border-slate-100 rounded shadow-sm p-4 relative overflow-hidden flex flex-col gap-2 pointer-events-none select-none">
           {/* Top Thick Border */}
           <div className={`absolute top-0 left-0 right-0 h-2 ${colorClass || 'bg-emerald-700'}`}></div>
           
           {/* Header */}
           <div className="mt-2 flex justify-between items-end border-b border-slate-200 pb-2 mb-1">
              <div className="space-y-1">
                 <div className="w-24 h-2.5 bg-slate-800"></div>
                 <div className="w-16 h-1.5 bg-emerald-600"></div>
              </div>
              <div className="w-12 h-12 border border-slate-200 bg-slate-50"></div>
           </div>

           {/* Content */}
           <div className="space-y-2">
              <div className="flex items-center gap-2">
                 <div className="w-1/4 h-1.5 bg-slate-700 uppercase tracking-widest"></div>
                 <div className="flex-1 h-[1px] bg-slate-200"></div>
              </div>
              <TextLine w="100%" className="bg-slate-200" />
              <TextLine w="100%" className="bg-slate-200" />
              
              <div className="flex items-center gap-2 mt-2">
                 <div className="w-1/4 h-1.5 bg-slate-700 uppercase tracking-widest"></div>
                 <div className="flex-1 h-[1px] bg-slate-200"></div>
              </div>
              <div className="flex justify-between">
                 <div className="w-1/3 h-1 bg-slate-800 font-bold"></div>
                 <div className="w-1/5 h-1 bg-slate-400"></div>
              </div>
              <TextLine w="100%" className="bg-slate-200" />
           </div>
        </div>
       );
    }
    
    // --- MINIMALIST CLEAN ---
    if (id === 'minimalist_clean') {
        return (
            <div className="w-full h-48 bg-white border border-slate-100 rounded shadow-sm p-6 flex flex-col gap-3 pointer-events-none select-none">
               <div className="flex flex-col items-center gap-1 mb-2">
                  <div className="w-1/2 h-2.5 bg-slate-900 rounded-sm"></div>
                  <div className="w-3/4 h-1 bg-slate-400"></div>
               </div>
               <div className="space-y-2">
                   <div className="w-1/5 h-1.5 bg-slate-700 uppercase tracking-widest"></div>
                   <div className="flex justify-between">
                       <div className="w-1/3 h-1.5 bg-slate-800 font-bold"></div>
                       <div className="w-1/5 h-1 bg-slate-400"></div>
                   </div>
                   <TextLine w="100%" className="bg-slate-200" />
                   <TextLine w="90%" className="bg-slate-200" />
                   
                   <div className="w-1/5 h-1.5 bg-slate-700 uppercase tracking-widest mt-2"></div>
                   <div className="flex justify-between">
                       <div className="w-1/4 h-1.5 bg-slate-800 font-bold"></div>
                       <div className="w-1/5 h-1 bg-slate-400"></div>
                   </div>
                   <TextLine w="100%" className="bg-slate-200" />
               </div>
            </div>
        );
    }
    
    // --- COMPACT GRID ---
    if (id === 'compact_grid') {
        return (
            <div className="w-full h-48 bg-white border border-slate-100 rounded shadow-sm p-4 flex flex-col pointer-events-none select-none">
                <div className="flex justify-between items-center border-b-2 border-orange-500 pb-2 mb-2">
                    <div className="w-1/3 h-3 bg-slate-900"></div>
                    <div className="w-1/4 h-1.5 bg-slate-500"></div>
                </div>
                <div className="flex gap-2 h-full">
                    <div className="w-2/3 space-y-2">
                        <div className="w-1/3 h-1.5 bg-orange-600 font-bold"></div>
                        <TextLine w="100%" className="bg-slate-200" />
                        <TextLine w="90%" className="bg-slate-200" />
                        <div className="w-1/3 h-1.5 bg-orange-600 font-bold mt-1"></div>
                        <TextLine w="100%" className="bg-slate-200" />
                        <TextLine w="85%" className="bg-slate-200" />
                    </div>
                    <div className="w-1/3 space-y-2 border-l border-slate-100 pl-2">
                        <div className="w-1/2 h-1.5 bg-orange-600 font-bold"></div>
                        <TextLine w="80%" className="bg-slate-200" />
                        <TextLine w="70%" className="bg-slate-200" />
                        <div className="w-1/2 h-1.5 bg-orange-600 font-bold mt-2"></div>
                        <TextLine w="90%" className="bg-slate-200" />
                    </div>
                </div>
            </div>
        );
    }

    // Default Fallback
    return <div className="w-full h-48 bg-slate-50"></div>;
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {AVAILABLE_TEMPLATES.map((template) => (
        <div 
          key={template.id}
          onClick={() => onSelect(template.id)}
          className={`group relative bg-white rounded-xl transition-all duration-200 cursor-pointer overflow-hidden border-2 flex flex-col text-left ${
            selectedId === template.id 
              ? 'border-[#1a91f0] shadow-xl ring-2 ring-[#1a91f0]/20 transform scale-[1.02]' 
              : 'border-transparent shadow-md hover:shadow-lg hover:border-slate-300 hover:-translate-y-1'
          }`}
        >
          {/* Badge */}
          <div className="absolute top-3 right-3 z-10">
             <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/90 text-slate-700 shadow-sm border border-slate-100`}>
                {template.tag}
             </span>
          </div>

          <div className="p-4 bg-slate-50 border-b border-slate-100">
             {renderPreview(template.id, template.color)}
          </div>

          <div className="p-5 flex-1 flex flex-col">
             <h3 className="font-bold text-slate-800 text-lg mb-2 group-hover:text-[#1a91f0] transition-colors">
               {template.name}
             </h3>
             <p className="text-sm text-slate-500 leading-relaxed mb-4 flex-1">
               {template.description}
             </p>
             <button className={`w-full py-2 rounded font-bold text-sm transition-colors ${
               selectedId === template.id 
                 ? 'bg-[#1a91f0] text-white' 
                 : 'bg-slate-100 text-slate-600 group-hover:bg-[#1a91f0] group-hover:text-white'
             }`}>
               {selectedId === template.id ? 'Selected' : 'Use Template'}
             </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TemplateSelector;