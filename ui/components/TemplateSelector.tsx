import React from 'react';
import { AVAILABLE_TEMPLATES } from '../constants';

type CategoryPreviewIcon =
  | 'ats'
  | 'business'
  | 'finance'
  | 'healthcare'
  | 'product'
  | 'data'
  | 'sales'
  | 'operations'
  | 'education'
  | 'legal'
  | 'engineering'
  | 'marketing'
  | 'entry'
  | 'academic';

interface CategoryTemplatePreview {
  icon: CategoryPreviewIcon;
  layout: 'single' | 'sidebar' | 'split' | 'timeline';
  titleWidth: string;
  metaWidth: string;
}

const CATEGORY_TEMPLATE_PREVIEWS: Record<string, CategoryTemplatePreview> = {
  ats_single_column: {
    icon: 'ats',
    layout: 'single',
    titleWidth: '58%',
    metaWidth: '42%',
  },
  consulting_case: {
    icon: 'business',
    layout: 'split',
    titleWidth: '64%',
    metaWidth: '48%',
  },
  finance_ledger: {
    icon: 'finance',
    layout: 'timeline',
    titleWidth: '62%',
    metaWidth: '44%',
  },
  healthcare_clinical: {
    icon: 'healthcare',
    layout: 'sidebar',
    titleWidth: '66%',
    metaWidth: '50%',
  },
  product_manager: {
    icon: 'product',
    layout: 'split',
    titleWidth: '60%',
    metaWidth: '46%',
  },
  data_science: {
    icon: 'data',
    layout: 'sidebar',
    titleWidth: '61%',
    metaWidth: '42%',
  },
  sales_growth: {
    icon: 'sales',
    layout: 'timeline',
    titleWidth: '65%',
    metaWidth: '45%',
  },
  operations_lean: {
    icon: 'operations',
    layout: 'split',
    titleWidth: '59%',
    metaWidth: '50%',
  },
  teacher_education: {
    icon: 'education',
    layout: 'sidebar',
    titleWidth: '63%',
    metaWidth: '44%',
  },
  legal_associate: {
    icon: 'legal',
    layout: 'single',
    titleWidth: '57%',
    metaWidth: '38%',
  },
  engineering_systems: {
    icon: 'engineering',
    layout: 'sidebar',
    titleWidth: '67%',
    metaWidth: '46%',
  },
  marketing_brand: {
    icon: 'marketing',
    layout: 'split',
    titleWidth: '62%',
    metaWidth: '42%',
  },
  early_career: {
    icon: 'entry',
    layout: 'timeline',
    titleWidth: '55%',
    metaWidth: '40%',
  },
  academic_cv: {
    icon: 'academic',
    layout: 'single',
    titleWidth: '60%',
    metaWidth: '48%',
  },
};

const TemplatePreviewIcon: React.FC<{ icon: CategoryPreviewIcon }> = ({ icon }) => {
  const iconProps: React.SVGProps<SVGSVGElement> = {
    className: 'w-5 h-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
  };

  switch (icon) {
    case 'ats':
      return (
        <svg {...iconProps}>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v5h4" />
          <path d="M9 11h6M9 15h6M9 19h3" />
          <path d="m15 18 1.5 1.5 3-3.5" />
        </svg>
      );
    case 'business':
      return (
        <svg {...iconProps}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
          <path d="M3 12h18" />
        </svg>
      );
    case 'finance':
      return (
        <svg {...iconProps}>
          <path d="M4 19V5" />
          <path d="M4 19h17" />
          <path d="m7 15 4-4 3 3 5-7" />
          <path d="M17 7h2v2" />
        </svg>
      );
    case 'healthcare':
      return (
        <svg {...iconProps}>
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M12 9v7M8.5 12.5h7" />
          <path d="M9 5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case 'product':
      return (
        <svg {...iconProps}>
          <path d="m12 3 8 4.5-8 4.5-8-4.5z" />
          <path d="M4 7.5v9L12 21l8-4.5v-9" />
          <path d="M12 12v9" />
        </svg>
      );
    case 'data':
      return (
        <svg {...iconProps}>
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
          <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
      );
    case 'sales':
      return (
        <svg {...iconProps}>
          <path d="M3 17 9 11l4 4 7-8" />
          <path d="M14 7h6v6" />
          <path d="M4 21h16" />
        </svg>
      );
    case 'operations':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
          <path d="m5.6 5.6 2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </svg>
      );
    case 'education':
      return (
        <svg {...iconProps}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 1 4 16.5z" />
          <path d="M4 16.5A2.5 2.5 0 0 1 6.5 14H20" />
          <path d="M8 7h7" />
        </svg>
      );
    case 'legal':
      return (
        <svg {...iconProps}>
          <path d="M12 3v18M5 6h14" />
          <path d="m6 6-3 7h6zM18 6l-3 7h6z" />
          <path d="M8 21h8" />
        </svg>
      );
    case 'engineering':
      return (
        <svg {...iconProps}>
          <path d="M14.7 6.3a4 4 0 0 0-5.2 5.2L4 17l3 3 5.5-5.5a4 4 0 0 0 5.2-5.2l-2.9 2.9-3-3z" />
        </svg>
      );
    case 'marketing':
      return (
        <svg {...iconProps}>
          <path d="M4 11v3a2 2 0 0 0 2 2h2l3 4" />
          <path d="M8 11 20 5v15L8 14z" />
          <path d="M20 9h2M20 16h2" />
        </svg>
      );
    case 'entry':
      return (
        <svg {...iconProps}>
          <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" />
        </svg>
      );
    case 'academic':
      return (
        <svg {...iconProps}>
          <path d="m3 8 9-4 9 4-9 4z" />
          <path d="M7 10.5V15c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5" />
          <path d="M21 8v6" />
        </svg>
      );
    default:
      return null;
  }
};

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

    const renderCategoryPreview = (config: CategoryTemplatePreview) => {
      const accent = colorClass || 'bg-slate-700';
      const usesRail = config.layout === 'sidebar';
      const usesSplit = config.layout === 'split';
      const usesTimeline = config.layout === 'timeline';

      return (
        <div className="w-full h-48 bg-white border border-slate-100 rounded shadow-sm overflow-hidden flex pointer-events-none select-none">
          {usesRail && (
            <div className={`${accent} w-14 h-full text-white flex flex-col items-center py-4 gap-3`}>
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <TemplatePreviewIcon icon={config.icon} />
              </div>
              <div className="w-7 h-1 rounded bg-white/45 mt-2"></div>
              <div className="w-5 h-1 rounded bg-white/35"></div>
              <div className="w-7 h-1 rounded bg-white/35"></div>
            </div>
          )}

          <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className={`h-2.5 ${accent} rounded-sm`} style={{ width: config.titleWidth }}></div>
                <div className="h-1.5 bg-slate-300 rounded-sm" style={{ width: config.metaWidth }}></div>
              </div>
              {!usesRail && (
                <div className={`${accent} w-10 h-10 rounded-lg text-white flex items-center justify-center shrink-0`}>
                  <TemplatePreviewIcon icon={config.icon} />
                </div>
              )}
            </div>

            <div className={usesSplit ? 'grid grid-cols-[1.35fr_1fr] gap-3 flex-1' : 'flex-1 space-y-2'}>
              <div className="space-y-2">
                {usesTimeline ? (
                  <>
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="flex gap-2">
                        <div className={`${accent} w-2 h-2 rounded-full mt-0.5 shrink-0`}></div>
                        <div className="flex-1 space-y-1">
                          <TextLine w={item === 1 ? '72%' : '88%'} className="bg-slate-300" />
                          <TextLine w={item === 2 ? '54%' : '76%'} className="bg-slate-200" />
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className={`w-1/3 h-1.5 ${accent} rounded-sm opacity-80`}></div>
                    <TextLine w="100%" className="bg-slate-200" />
                    <TextLine w="92%" className="bg-slate-200" />
                    <TextLine w="84%" className="bg-slate-200" />
                    <div className={`w-1/4 h-1.5 ${accent} rounded-sm opacity-80 mt-2`}></div>
                    <TextLine w="96%" className="bg-slate-200" />
                  </>
                )}
              </div>

              {usesSplit && (
                <div className="space-y-2 border-l border-slate-100 pl-3">
                  <div className={`w-2/3 h-1.5 ${accent} rounded-sm opacity-80`}></div>
                  <TextLine w="88%" className="bg-slate-200" />
                  <TextLine w="78%" className="bg-slate-200" />
                  <div className="grid grid-cols-2 gap-1 pt-1">
                    <div className={`${accent} h-5 rounded opacity-15`}></div>
                    <div className={`${accent} h-5 rounded opacity-25`}></div>
                    <div className={`${accent} h-5 rounded opacity-25`}></div>
                    <div className={`${accent} h-5 rounded opacity-15`}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

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

    const categoryPreview = CATEGORY_TEMPLATE_PREVIEWS[id];
    if (categoryPreview) {
      return renderCategoryPreview(categoryPreview);
    }

    // Default Fallback
    return <div data-testid="template-preview-fallback" className="w-full h-48 bg-slate-50"></div>;
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

          <div className="p-4 bg-slate-50 border-b border-slate-100" data-testid={`template-preview-${template.id}`}>
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
