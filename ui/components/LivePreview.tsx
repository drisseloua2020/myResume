import React from 'react';
import { UserInputData, User } from '../types';
import { apiAssetUrl } from '../services/apiClient';

interface LivePreviewProps {
  data: UserInputData;
  user: User;
  templateId?: string;
}

type CategoryResumeLayout = 'single' | 'sidebar' | 'split' | 'timeline';

type CategoryResumeTemplate = {
  label: string;
  accent: string;
  soft: string;
  layout: CategoryResumeLayout;
  summaryLabel: string;
  experienceLabel: string;
  skillsLabel: string;
  educationLabel: string;
};

const CATEGORY_RESUME_TEMPLATES: Record<string, CategoryResumeTemplate> = {
  ats_single_column: {
    label: 'ATS',
    accent: '#3f3f46',
    soft: '#f4f4f5',
    layout: 'single',
    summaryLabel: 'Professional Summary',
    experienceLabel: 'Professional Experience',
    skillsLabel: 'Skills',
    educationLabel: 'Education',
  },
  consulting_case: {
    label: 'Consulting',
    accent: '#0e7490',
    soft: '#ecfeff',
    layout: 'split',
    summaryLabel: 'Consultant Profile',
    experienceLabel: 'Selected Impact',
    skillsLabel: 'Capabilities',
    educationLabel: 'Education',
  },
  finance_ledger: {
    label: 'Finance',
    accent: '#15803d',
    soft: '#f0fdf4',
    layout: 'timeline',
    summaryLabel: 'Finance Profile',
    experienceLabel: 'Experience & Results',
    skillsLabel: 'Technical Strengths',
    educationLabel: 'Credentials',
  },
  healthcare_clinical: {
    label: 'Healthcare',
    accent: '#0d9488',
    soft: '#f0fdfa',
    layout: 'sidebar',
    summaryLabel: 'Clinical Profile',
    experienceLabel: 'Clinical Experience',
    skillsLabel: 'Clinical Skills',
    educationLabel: 'Credentials',
  },
  product_manager: {
    label: 'Product',
    accent: '#4f46e5',
    soft: '#eef2ff',
    layout: 'split',
    summaryLabel: 'Product Profile',
    experienceLabel: 'Product Impact',
    skillsLabel: 'Product Toolkit',
    educationLabel: 'Education',
  },
  data_science: {
    label: 'Data',
    accent: '#0369a1',
    soft: '#f0f9ff',
    layout: 'sidebar',
    summaryLabel: 'Data Profile',
    experienceLabel: 'Analytics Experience',
    skillsLabel: 'Models, Tools & Data',
    educationLabel: 'Education',
  },
  sales_growth: {
    label: 'Sales',
    accent: '#e11d48',
    soft: '#fff1f2',
    layout: 'timeline',
    summaryLabel: 'Revenue Profile',
    experienceLabel: 'Sales Performance',
    skillsLabel: 'Growth Skills',
    educationLabel: 'Education',
  },
  operations_lean: {
    label: 'Operations',
    accent: '#4d7c0f',
    soft: '#f7fee7',
    layout: 'split',
    summaryLabel: 'Operations Profile',
    experienceLabel: 'Operational Improvements',
    skillsLabel: 'Process Strengths',
    educationLabel: 'Education',
  },
  teacher_education: {
    label: 'Education',
    accent: '#d97706',
    soft: '#fffbeb',
    layout: 'sidebar',
    summaryLabel: 'Teaching Profile',
    experienceLabel: 'Teaching Experience',
    skillsLabel: 'Instructional Skills',
    educationLabel: 'Education & Licensure',
  },
  legal_associate: {
    label: 'Legal',
    accent: '#44403c',
    soft: '#fafaf9',
    layout: 'single',
    summaryLabel: 'Legal Profile',
    experienceLabel: 'Legal Experience',
    skillsLabel: 'Practice Strengths',
    educationLabel: 'Education',
  },
  engineering_systems: {
    label: 'Engineering',
    accent: '#a21caf',
    soft: '#fdf4ff',
    layout: 'sidebar',
    summaryLabel: 'Engineering Profile',
    experienceLabel: 'Systems Experience',
    skillsLabel: 'Technical Stack',
    educationLabel: 'Education',
  },
  marketing_brand: {
    label: 'Marketing',
    accent: '#db2777',
    soft: '#fdf2f8',
    layout: 'split',
    summaryLabel: 'Brand Profile',
    experienceLabel: 'Campaign Impact',
    skillsLabel: 'Marketing Skills',
    educationLabel: 'Education',
  },
  early_career: {
    label: 'Early Career',
    accent: '#ca8a04',
    soft: '#fefce8',
    layout: 'timeline',
    summaryLabel: 'Career Objective',
    experienceLabel: 'Experience & Projects',
    skillsLabel: 'Skills',
    educationLabel: 'Education',
  },
  academic_cv: {
    label: 'Academic',
    accent: '#6d28d9',
    soft: '#f5f3ff',
    layout: 'single',
    summaryLabel: 'Academic Profile',
    experienceLabel: 'Research & Teaching',
    skillsLabel: 'Areas of Expertise',
    educationLabel: 'Education',
  },
};

const LivePreview: React.FC<LivePreviewProps> = ({ data, user, templateId = 'classic_pro' }) => {
  const { experienceItems, educationItems, skillItems, additionalSections, targetRole, preferences, personalDetails } = data;

  // Helper to format full address
  const fullAddress = [
      personalDetails?.address, 
      personalDetails?.city, 
      personalDetails?.state,
      personalDetails?.postalCode,
      personalDetails?.country
  ].filter(Boolean).join(', ');

  const firstName = personalDetails?.firstName || user.name.split(' ')[0] || '';
  const lastName = personalDetails?.lastName || user.name.split(' ').slice(1).join(' ') || '';
  const displayName = `${firstName} ${lastName}`.trim() || user.name;
  
  // Use editable email or fallback to user account email
  const displayEmail = personalDetails?.email || user.email;

  const phoneNumber = personalDetails?.phone || '';
  const summaryText = personalDetails?.summary || data.jobDescription || "Experienced professional with a proven track record of success in delivering high-quality results. Skilled in adapting to new challenges and utilizing industry best practices to drive efficiency and growth.";
  const profileImageSrc = data.profileImageData
    ? `data:${data.profileImageData.mimeType};base64,${data.profileImageData.data}`
    : apiAssetUrl(data.profileImageUrl);

  const categoryTemplate = CATEGORY_RESUME_TEMPLATES[templateId];
  const linkItems = (personalDetails?.links || '')
    .split(/\n|,|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
  const contactItems = [displayEmail, phoneNumber, ...linkItems, fullAddress || preferences?.region].filter(Boolean);
  const skillTokens = (skillItems || [])
    .flatMap((skill) => skill.items.split(',').map((item) => item.trim()).filter(Boolean));
  const visibleAdditionalSections = (additionalSections || [])
    .filter((section) => section.title?.trim() || section.items?.trim());

  const SectionTitle: React.FC<{ children: React.ReactNode; subtle?: boolean }> = ({ children, subtle }) => (
    <h3
      className={`text-xs font-black uppercase tracking-[0.18em] mb-3 ${subtle ? 'text-white/80' : ''}`}
      style={subtle ? undefined : { color: categoryTemplate?.accent }}
    >
      {children}
    </h3>
  );

  const ExperienceList: React.FC<{ compact?: boolean; timeline?: boolean }> = ({ compact = false, timeline = false }) => (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {experienceItems && experienceItems.length > 0 ? experienceItems.map((exp, i) => (
        <div key={i} data-pdf-block className={timeline ? 'relative pl-6' : ''}>
          {timeline && (
            <>
              <span className="absolute left-0 top-1.5 h-full w-px" style={{ backgroundColor: categoryTemplate?.soft }}></span>
              <span className="absolute left-[-5px] top-1.5 h-3 w-3 rounded-full border-2 bg-white" style={{ borderColor: categoryTemplate?.accent }}></span>
            </>
          )}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div className={compact ? 'text-sm font-bold text-slate-900' : 'text-base font-bold text-slate-900'}>
              {exp.role || 'Job Title'}
            </div>
            <div className="text-xs font-semibold text-slate-500">{exp.dates}</div>
          </div>
          <div className="text-sm font-semibold mb-2" style={{ color: categoryTemplate?.accent }}>
            {exp.company || 'Company'}
          </div>
          <p className={`${compact ? 'text-xs' : 'text-sm'} leading-relaxed text-slate-700 whitespace-pre-wrap`}>
            {exp.description}
          </p>
        </div>
      )) : (
        <div className="text-sm text-slate-400 italic">No experience added yet.</div>
      )}
    </div>
  );

  const EducationList: React.FC<{ subtle?: boolean }> = ({ subtle = false }) => (
    <div className="space-y-3">
      {educationItems && educationItems.map((edu, i) => (
        <div key={i} data-pdf-block>
          <div className={`text-sm font-bold ${subtle ? 'text-white' : 'text-slate-900'}`}>{edu.degree}</div>
          <div className={`text-xs ${subtle ? 'text-white/75' : 'text-slate-600'}`}>{edu.school}</div>
          <div className={`text-xs ${subtle ? 'text-white/55' : 'text-slate-400'}`}>{edu.dates}</div>
        </div>
      ))}
    </div>
  );

  const SkillList: React.FC<{ pills?: boolean; subtle?: boolean }> = ({ pills = false, subtle = false }) => {
    if (pills) {
      return (
        <div className="flex flex-wrap gap-2">
          {skillTokens.map((skill, i) => (
            <span key={i} className="rounded-full px-2 py-1 text-xs font-semibold" style={{ backgroundColor: categoryTemplate?.soft, color: categoryTemplate?.accent }}>
              {skill}
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {skillItems && skillItems.map((skill, i) => (
          <div key={i}>
            <div className={`text-xs font-bold uppercase tracking-wide ${subtle ? 'text-white/80' : 'text-slate-500'}`}>{skill.category}</div>
            <div className={`text-xs leading-relaxed ${subtle ? 'text-white/70' : 'text-slate-700'}`}>{skill.items}</div>
          </div>
        ))}
      </div>
    );
  };

  const AdditionalSectionsList: React.FC<{ subtle?: boolean; compact?: boolean }> = ({ subtle = false, compact = false }) => {
    if (visibleAdditionalSections.length === 0) return null;

    return (
      <div className={compact ? 'space-y-3' : 'space-y-5'}>
        {visibleAdditionalSections.map((section, i) => {
          const lines = (section.items || '')
            .split(/\n|;/)
            .map((item) => item.trim())
            .filter(Boolean);

          return (
            <section key={`${section.title}-${i}`} data-pdf-block>
              <div className={`${compact ? 'text-xs' : 'text-sm'} font-bold uppercase tracking-wide mb-2 ${subtle ? 'text-white/80' : 'text-slate-700'}`}>
                {section.title || 'Additional Section'}
              </div>
              <div className={`space-y-1 ${compact ? 'text-xs' : 'text-sm'} leading-relaxed ${subtle ? 'text-white/70' : 'text-slate-700'}`}>
                {lines.length > 0 ? lines.map((line, idx) => (
                  <div key={idx}>{line}</div>
                )) : (
                  <div>{section.items}</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const renderCategoryResumeTemplate = (config: CategoryResumeTemplate) => {
    if (config.layout === 'sidebar') {
      return (
        <div
          data-testid={`live-preview-${templateId}`}
          className="resume-page bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl flex text-slate-900 font-sans print:shadow-none"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          <aside className="w-[32%] p-7 text-white flex flex-col gap-6" style={{ backgroundColor: config.accent }}>
            {preferences?.photo && profileImageSrc && (
              <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white/30 bg-white/20">
                <img src={profileImageSrc} className="h-full w-full object-cover" />
              </div>
            )}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-3">{config.label}</div>
              <h1 className="text-3xl font-black uppercase leading-tight">{displayName}</h1>
              <div className="mt-2 text-sm font-semibold text-white/75">{targetRole || 'Target Role'}</div>
            </div>
            <div className="space-y-1.5 text-xs text-white/75">
              {contactItems.map((item, i) => <div key={i} className="break-words">{item}</div>)}
            </div>
            <section>
              <SectionTitle subtle>{config.skillsLabel}</SectionTitle>
              <SkillList subtle />
            </section>
            <section>
              <SectionTitle subtle>{config.educationLabel}</SectionTitle>
              <EducationList subtle />
            </section>
          </aside>
          <main className="flex-1 p-9 space-y-8">
            <section>
              <SectionTitle>{config.summaryLabel}</SectionTitle>
              <p className="text-sm leading-7 text-slate-700">{summaryText}</p>
            </section>
            <section>
              <SectionTitle>{config.experienceLabel}</SectionTitle>
              <ExperienceList />
            </section>
            {visibleAdditionalSections.length > 0 && (
              <section>
                <SectionTitle>Additional Sections</SectionTitle>
                <AdditionalSectionsList />
              </section>
            )}
          </main>
        </div>
      );
    }

    if (config.layout === 'split') {
      return (
        <div
          data-testid={`live-preview-${templateId}`}
          className="resume-page bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[20mm] text-slate-900 font-sans print:shadow-none"
          style={{ fontFamily: "'Inter', sans-serif", borderTop: `8px solid ${config.accent}` }}
        >
          <header className="mb-8 grid grid-cols-[1.4fr_1fr] gap-8 items-end">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: config.accent }}>{config.label}</div>
              <h1 className="text-4xl font-black text-slate-950 uppercase leading-tight">{displayName}</h1>
              <div className="mt-2 text-lg font-semibold text-slate-600">{targetRole || 'Target Role'}</div>
            </div>
            <div className="rounded-sm p-4 text-xs leading-relaxed" style={{ backgroundColor: config.soft }}>
              {contactItems.map((item, i) => <div key={i}>{item}</div>)}
            </div>
          </header>

          <div className="grid grid-cols-[1.55fr_0.9fr] gap-8">
            <main className="space-y-7">
              <section>
                <SectionTitle>{config.summaryLabel}</SectionTitle>
                <p className="text-sm leading-7 text-slate-700">{summaryText}</p>
              </section>
              <section>
                <SectionTitle>{config.experienceLabel}</SectionTitle>
                <ExperienceList />
              </section>
            </main>
            <aside className="space-y-7 border-l border-slate-100 pl-6">
              <section>
                <SectionTitle>{config.skillsLabel}</SectionTitle>
                <SkillList pills />
              </section>
              <section>
                <SectionTitle>{config.educationLabel}</SectionTitle>
                <EducationList />
              </section>
              {visibleAdditionalSections.length > 0 && (
                <section>
                  <SectionTitle>Additional Sections</SectionTitle>
                  <AdditionalSectionsList compact />
                </section>
              )}
            </aside>
          </div>
        </div>
      );
    }

    if (config.layout === 'timeline') {
      return (
        <div
          data-testid={`live-preview-${templateId}`}
          className="resume-page bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[21mm] text-slate-900 font-sans print:shadow-none"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          <header className="mb-8 pb-6 border-b" style={{ borderColor: config.soft }}>
            <div className="flex justify-between gap-8">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: config.accent }}>{config.label}</div>
                <h1 className="text-4xl font-black uppercase leading-tight">{displayName}</h1>
                <div className="mt-2 text-base font-semibold text-slate-600">{targetRole || 'Target Role'}</div>
              </div>
              <div className="text-right text-xs leading-relaxed text-slate-500">
                {contactItems.map((item, i) => <div key={i}>{item}</div>)}
              </div>
            </div>
          </header>

          <section className="mb-7">
            <SectionTitle>{config.summaryLabel}</SectionTitle>
            <p className="text-sm leading-7 text-slate-700">{summaryText}</p>
          </section>
          <section className="mb-7">
            <SectionTitle>{config.experienceLabel}</SectionTitle>
            <ExperienceList timeline />
          </section>
          <div className="grid grid-cols-2 gap-8">
            <section>
              <SectionTitle>{config.skillsLabel}</SectionTitle>
              <SkillList pills />
            </section>
            <section>
              <SectionTitle>{config.educationLabel}</SectionTitle>
              <EducationList />
            </section>
          </div>
          {visibleAdditionalSections.length > 0 && (
            <section className="mt-7">
              <SectionTitle>Additional Sections</SectionTitle>
              <AdditionalSectionsList compact />
            </section>
          )}
        </div>
      );
    }

    return (
      <div
        data-testid={`live-preview-${templateId}`}
        className="resume-page bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[24mm] text-slate-900 font-serif print:shadow-none"
        style={{ fontFamily: "'Merriweather', serif", borderTop: `6px solid ${config.accent}` }}
      >
        <header className="text-center pb-6 mb-7 border-b border-slate-200">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: config.accent }}>{config.label}</div>
          <h1 className="text-3xl font-bold uppercase tracking-wide mb-2">{displayName}</h1>
          <div className="text-sm font-semibold text-slate-700">{targetRole || 'Target Role'}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {contactItems.map((item, i) => <span key={i}>{item}</span>)}
          </div>
        </header>
        <section className="mb-6">
          <SectionTitle>{config.summaryLabel}</SectionTitle>
          <p className="text-sm leading-7 text-slate-700">{summaryText}</p>
        </section>
        <section className="mb-6">
          <SectionTitle>{config.experienceLabel}</SectionTitle>
          <ExperienceList />
        </section>
        <div className="grid grid-cols-2 gap-8">
          <section>
            <SectionTitle>{config.educationLabel}</SectionTitle>
            <EducationList />
          </section>
          <section>
            <SectionTitle>{config.skillsLabel}</SectionTitle>
            <SkillList />
          </section>
        </div>
        {visibleAdditionalSections.length > 0 && (
          <section className="mt-7">
            <SectionTitle>Additional Sections</SectionTitle>
            <AdditionalSectionsList compact />
          </section>
        )}
      </div>
    );
  };

  if (categoryTemplate) {
    return renderCategoryResumeTemplate(categoryTemplate);
  }

  // --- TEMPLATE: CREATIVE BOLD ---
  if (templateId === 'creative_bold') {
    return (
        <div 
          className="resume-page bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl text-slate-800 font-sans print:shadow-none"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
            {/* Header Banner */}
            <div className="bg-purple-700 text-white p-10 flex flex-col md:flex-row justify-between items-center md:items-start relative overflow-hidden">
                <div className="relative z-10 w-full md:w-2/3">
                    <h1 className="text-5xl font-extrabold tracking-tight mb-2 uppercase">{displayName}</h1>
                    <h2 className="text-xl font-medium text-purple-200 tracking-wider mb-6">{targetRole || "Target Role"}</h2>
                    
                    <div className="text-sm text-purple-100 flex flex-wrap gap-x-6 gap-y-2 opacity-90">
                        {displayEmail && <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>{displayEmail}</span>}
                        {phoneNumber && <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>{phoneNumber}</span>}
                        {linkItems.map((link, i) => <span key={i} className="break-words">{link}</span>)}
                        {fullAddress && <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>{fullAddress}</span>}
                    </div>
                </div>
                
                {/* Photo (Circle Overlay) */}
                {preferences?.photo && profileImageSrc && (
                    <div className="w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden flex-shrink-0 mt-6 md:mt-0 bg-white">
                        <img src={profileImageSrc} className="w-full h-full object-cover" />
                    </div>
                )}
                
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
            </div>

            <div className="flex flex-col md:flex-row p-10 gap-10">
                {/* Left Column (Main) */}
                <div className="flex-1 space-y-8">
                     {/* Summary */}
                     <section>
                         <h3 className="text-lg font-bold text-purple-700 uppercase mb-3 flex items-center gap-2">
                            <span className="w-8 h-1 bg-purple-700"></span> Profile
                         </h3>
                         <p className="text-slate-600 leading-relaxed text-sm">{summaryText}</p>
                     </section>

                     {/* Experience */}
                     <section>
                        <h3 className="text-lg font-bold text-purple-700 uppercase mb-4 flex items-center gap-2">
                            <span className="w-8 h-1 bg-purple-700"></span> Experience
                         </h3>
                        <div className="space-y-6">
                            {experienceItems && experienceItems.length > 0 ? (
                                experienceItems.map((exp, i) => (
                                <div key={i} data-pdf-block className="relative pl-6 border-l-2 border-purple-100">
                                    <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-purple-500 bg-white"></div>
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-1">
                                        <h4 className="font-bold text-slate-800">{exp.role}</h4>
                                        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{exp.dates}</span>
                                    </div>
                                    <div className="text-sm font-semibold text-slate-500 mb-2">{exp.company}</div>
                                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{exp.description}</p>
                                </div>
                                ))
                            ) : <div className="text-slate-300 italic">No experience added.</div>}
                        </div>
                     </section>
                     {visibleAdditionalSections.length > 0 && (
                        <section>
                           <h3 className="text-lg font-bold text-purple-700 uppercase mb-4 flex items-center gap-2">
                              <span className="w-8 h-1 bg-purple-700"></span> Additional
                           </h3>
                           <AdditionalSectionsList compact />
                        </section>
                     )}
                </div>

                {/* Right Column (Sidebar) */}
                <div className="w-full md:w-1/3 space-y-8">
                    {/* Education */}
                    <section className="bg-slate-50 p-6 rounded-lg border border-slate-100">
                        <h3 className="text-md font-bold text-purple-700 uppercase mb-4">Education</h3>
                        <div className="space-y-4">
                            {educationItems && educationItems.map((edu, i) => (
                                <div key={i} data-pdf-block>
                                    <div className="font-bold text-slate-800 text-sm">{edu.degree}</div>
                                    <div className="text-xs text-slate-500 mb-1">{edu.school}</div>
                                    <div className="text-xs text-purple-500 font-medium">{edu.dates}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Skills */}
                    <section>
                        <h3 className="text-md font-bold text-purple-700 uppercase mb-4">Expertise</h3>
                        <div className="space-y-4">
                            {skillItems && skillItems.map((skill, i) => (
                                <div key={i}>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{skill.category}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {skill.items.split(',').map((item, idx) => (
                                            <span key={idx} className="bg-purple-600 text-white text-xs px-2 py-1 rounded font-medium shadow-sm">{item.trim()}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
  }

  // --- TEMPLATE: EXECUTIVE LEAD ---
  if (templateId === 'executive_lead') {
    return (
        <div 
          className="resume-page bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[25mm] text-slate-900 font-serif print:shadow-none"
          style={{ fontFamily: "'Merriweather', serif" }}
        >
             {/* Header */}
             <header className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900 uppercase tracking-tight mb-2">{displayName}</h1>
                    <h2 className="text-lg text-emerald-800 font-bold uppercase tracking-wider">{targetRole || "Executive Professional"}</h2>
                </div>
                <div className="text-right text-sm text-slate-600 leading-relaxed">
                    <div>{displayEmail}</div>
                    {phoneNumber && <div>{phoneNumber}</div>}
                    {linkItems.map((link, i) => <div key={i}>{link}</div>)}
                    {fullAddress && <div>{fullAddress}</div>}
                </div>
             </header>

             {/* Profile */}
             <section className="mb-8">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-300 mb-3 pb-1">Executive Profile</h3>
                <p className="text-sm leading-7 text-justify text-slate-800">
                    {summaryText}
                </p>
             </section>

             {/* Core Competencies (Skills Grid) */}
             {skillItems && skillItems.length > 0 && (
                <section className="mb-8">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-300 mb-4 pb-1">Core Competencies</h3>
                    <div className="grid grid-cols-3 gap-y-2 gap-x-4">
                        {skillItems.flatMap(s => s.items.split(',')).map((skill, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                                <span className="w-1.5 h-1.5 bg-emerald-700 rounded-full"></span>
                                <span className="font-medium">{skill.trim()}</span>
                            </div>
                        ))}
                    </div>
                </section>
             )}

             {/* Professional Experience */}
             <section className="mb-8">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-300 mb-5 pb-1">Professional Experience</h3>
                <div className="space-y-6">
                    {experienceItems && experienceItems.map((exp, i) => (
                        <div key={i} data-pdf-block>
                            <div className="flex justify-between items-baseline mb-1">
                                <div className="text-lg font-bold text-slate-900">{exp.company}</div>
                                <div className="text-sm font-bold text-slate-900">{exp.dates}</div>
                            </div>
                            <div className="text-md font-bold text-emerald-800 mb-2 italic">{exp.role}</div>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap pl-2 border-l-2 border-slate-200">
                                {exp.description}
                            </p>
                        </div>
                    ))}
                </div>
             </section>

             {visibleAdditionalSections.length > 0 && (
                <section className="mb-8">
                   <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-300 mb-4 pb-1">Additional Sections</h3>
                   <AdditionalSectionsList compact />
                </section>
             )}

             {/* Education */}
             <section>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-300 mb-4 pb-1">Education</h3>
                <div className="space-y-3">
                    {educationItems && educationItems.map((edu, i) => (
                        <div key={i} className="flex justify-between text-sm">
                            <div>
                                <span className="font-bold text-slate-900">{edu.school}</span>, <span className="italic text-slate-700">{edu.degree}</span>
                            </div>
                            <div className="font-medium text-slate-600">{edu.dates}</div>
                        </div>
                    ))}
                </div>
             </section>
        </div>
    );
  }

  // --- TEMPLATE: MODERN TECH (Sidebar Layout) ---
  if (templateId === 'modern_tech') {
    return (
      <div 
        className="resume-page bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl flex text-slate-800 print:shadow-none"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Sidebar */}
        <div className="w-[32%] bg-slate-900 text-white p-6 pt-10 flex flex-col gap-6">
          {/* Photo */}
          {preferences?.photo && profileImageSrc && (
            <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-slate-700 mb-2">
              <img src={profileImageSrc} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Contact */}
          <div>
            <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-3 border-b border-slate-700 pb-1">Contact</h3>
            <div className="text-sm space-y-2 font-light">
              <div className="break-words font-medium">{displayEmail}</div>
              {phoneNumber && <div>{phoneNumber}</div>}
              {linkItems.map((link, i) => <div key={i} className="break-words">{link}</div>)}
              {fullAddress && <div className="leading-tight opacity-80">{fullAddress}</div>}
            </div>
          </div>

          {/* Education */}
          {educationItems && educationItems.length > 0 && (
            <div>
              <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-3 border-b border-slate-700 pb-1">Education</h3>
              <div className="space-y-4">
                {educationItems.map((edu, i) => (
                  <div key={i} data-pdf-block>
                    <div className="font-bold text-sm">{edu.degree}</div>
                    <div className="text-xs text-slate-400">{edu.school}</div>
                    <div className="text-xs text-slate-500 italic">{edu.dates}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {skillItems && skillItems.length > 0 && (
            <div>
              <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-3 border-b border-slate-700 pb-1">Skills</h3>
              <div className="space-y-3">
                {skillItems.map((skill, i) => (
                  <div key={i} data-pdf-block>
                    <div className="text-xs font-semibold text-blue-400 mb-1">{skill.category}</div>
                    <div className="text-xs leading-relaxed opacity-80">{skill.items}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 pt-10">
          <header className="mb-8 border-b-2 border-slate-100 pb-6">
            <h1 className="text-4xl font-bold text-slate-900 uppercase tracking-tight mb-2">{displayName}</h1>
            <h2 className="text-xl text-blue-600 font-medium tracking-wide">{targetRole || "Target Role"}</h2>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              {summaryText}
            </p>
          </header>

          <section>
            <h3 className="text-lg font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span> Experience
            </h3>
            
            <div className="space-y-6">
              {experienceItems && experienceItems.length > 0 ? (
                experienceItems.map((exp, i) => (
                  <div key={i} data-pdf-block>
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-bold text-lg text-slate-800">{exp.role || "Job Title"}</h4>
                      <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{exp.dates || "Dates"}</span>
                    </div>
                    <div className="text-blue-600 font-medium text-sm mb-2">{exp.company || "Company Name"}</div>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {exp.description || "Describe your responsibilities and achievements here..."}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-slate-300 italic p-4 border border-dashed border-slate-200 rounded">Add experience items to see them here.</div>
              )}
            </div>
          </section>
          {visibleAdditionalSections.length > 0 && (
            <section className="mt-8">
              <h3 className="text-lg font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span> Additional
              </h3>
              <AdditionalSectionsList compact />
            </section>
          )}
        </div>
      </div>
    );
  }
  
  // --- TEMPLATE: MINIMALIST CLEAN ---
  if (templateId === 'minimalist_clean') {
    return (
      <div 
        className="resume-page bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[20mm] text-slate-800 font-sans print:shadow-none"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Header: Centered, minimal */}
        <header className="text-center mb-10">
           <h1 className="text-3xl font-light text-slate-900 uppercase tracking-widest mb-2">{displayName}</h1>
           <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">{targetRole}</p>
           
           <div className="flex justify-center flex-wrap gap-4 text-xs text-slate-400 font-medium">
              {displayEmail && <span>{displayEmail}</span>}
              {phoneNumber && <span>| {phoneNumber}</span>}
              {linkItems.map((link, i) => <span key={i}>| {link}</span>)}
              {fullAddress && <span>| {fullAddress}</span>}
              {preferences?.region && !fullAddress && <span>| {preferences.region}</span>}
           </div>
        </header>

        {/* Summary */}
        <section className="mb-8">
           <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Professional Summary</div>
           <p className="text-sm leading-relaxed text-slate-600 border-l-2 border-slate-200 pl-4">
              {summaryText}
           </p>
        </section>

        {/* Experience */}
        <section className="mb-8">
           <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Experience</div>
           <div className="space-y-6">
              {experienceItems && experienceItems.map((exp, i) => (
                  <div key={i} data-pdf-block>
                      <div className="flex justify-between items-end mb-1">
                          <h3 className="font-bold text-slate-800 text-sm">{exp.role}</h3>
                          <span className="text-xs text-slate-400">{exp.dates}</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{exp.company}</div>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                         {exp.description}
                      </p>
                  </div>
              ))}
           </div>
        </section>

        {/* Skills & Education Grid */}
        <div className="grid grid-cols-2 gap-8">
            <section>
               <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Education</div>
               <div className="space-y-4">
                   {educationItems && educationItems.map((edu, i) => (
                       <div key={i}>
                           <div className="text-sm font-bold text-slate-800">{edu.school}</div>
                           <div className="text-xs text-slate-600">{edu.degree}</div>
                           <div className="text-xs text-slate-400 mt-0.5">{edu.dates}</div>
                       </div>
                   ))}
               </div>
            </section>
            
            <section>
               <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Skills</div>
               <div className="space-y-3">
                   {skillItems && skillItems.map((skill, i) => (
                       <div key={i}>
                           <span className="text-xs font-bold text-slate-600">{skill.category}: </span>
                           <span className="text-xs text-slate-500">{skill.items}</span>
                       </div>
                   ))}
               </div>
            </section>
        </div>
        {visibleAdditionalSections.length > 0 && (
          <section className="mt-8">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Additional Sections</div>
            <AdditionalSectionsList compact />
          </section>
        )}
      </div>
    );
  }

  // --- TEMPLATE: COMPACT GRID ---
  if (templateId === 'compact_grid') {
    return (
      <div 
        className="resume-page bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[15mm] text-slate-800 font-sans print:shadow-none"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Compact Header */}
        <header className="border-b-2 border-orange-500 pb-4 mb-6 flex justify-between items-end">
            <div>
               <h1 className="text-4xl font-extrabold text-slate-900 leading-none mb-1">{displayName}</h1>
               <div className="text-orange-600 font-bold text-lg">{targetRole}</div>
            </div>
            <div className="text-right text-xs font-medium text-slate-600 space-y-0.5">
               <div>{displayEmail}</div>
               <div>{phoneNumber}</div>
               {linkItems.map((link, i) => <div key={i}>{link}</div>)}
               <div>{fullAddress}</div>
            </div>
        </header>

        <div className="grid grid-cols-3 gap-6">
            {/* Main Content (2 cols) */}
            <div className="col-span-2 space-y-6">
               <section>
                  <h3 className="text-sm font-black text-orange-600 uppercase mb-2">Summary</h3>
                  <p className="text-xs leading-relaxed text-slate-700 text-justify">
                     {summaryText}
                  </p>
               </section>

               <section>
                   <h3 className="text-sm font-black text-orange-600 uppercase mb-3">Experience</h3>
                   <div className="space-y-4">
                       {experienceItems && experienceItems.map((exp, i) => (
                           <div key={i} data-pdf-block className="border-l-2 border-slate-200 pl-3">
                               <div className="flex justify-between items-baseline">
                                   <div className="font-bold text-sm text-slate-800">{exp.role}</div>
                                   <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 rounded">{exp.dates}</div>
                               </div>
                               <div className="text-xs font-bold text-slate-600 mb-1">{exp.company}</div>
                               <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                                   {exp.description}
                                </p>
                           </div>
                       ))}
                   </div>
               </section>
               {visibleAdditionalSections.length > 0 && (
                  <section>
                    <h3 className="text-sm font-black text-orange-600 uppercase mb-3">Additional</h3>
                    <AdditionalSectionsList compact />
                  </section>
               )}
            </div>

            {/* Sidebar (1 col) */}
            <div className="col-span-1 space-y-6 border-l border-slate-100 pl-4">
               {preferences?.photo && profileImageSrc && (
                   <div className="w-24 h-24 mb-4 border border-slate-200 p-1 bg-white">
                       <img src={profileImageSrc} className="w-full h-full object-cover" />
                   </div>
               )}

               <section>
                   <h3 className="text-sm font-black text-orange-600 uppercase mb-3">Skills</h3>
                   <div className="space-y-3">
                       {skillItems && skillItems.map((skill, i) => (
                           <div key={i}>
                               <div className="text-[10px] font-bold text-slate-700 uppercase mb-1">{skill.category}</div>
                               <div className="text-xs text-slate-600 leading-snug">{skill.items}</div>
                           </div>
                       ))}
                   </div>
               </section>

               <section>
                   <h3 className="text-sm font-black text-orange-600 uppercase mb-3">Education</h3>
                   <div className="space-y-3">
                       {educationItems && educationItems.map((edu, i) => (
                           <div key={i} className="bg-slate-50 p-2 rounded">
                               <div className="text-xs font-bold text-slate-800 leading-tight">{edu.degree}</div>
                               <div className="text-[10px] text-slate-600 mt-1">{edu.school}</div>
                               <div className="text-[10px] text-slate-400 italic">{edu.dates}</div>
                           </div>
                       ))}
                   </div>
               </section>
            </div>
        </div>
      </div>
    );
  }

  // --- TEMPLATE: CLASSIC / DEFAULT ---
  return (
    <div 
      className="resume-page bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[25mm] text-slate-900 font-serif print:shadow-none"
      style={{ fontFamily: "'Merriweather', serif" }}
    >
      {/* Header */}
      <header className="text-center border-b-2 border-slate-800 pb-6 mb-8">
        <h1 className="text-3xl font-bold uppercase tracking-wide mb-2">{displayName}</h1>
        <div className="text-sm text-slate-600 flex justify-center gap-4 separator flex-wrap">
          <span>{displayEmail}</span>
          {linkItems.map((link, i) => (
             <React.Fragment key={i}><span>|</span><span>{link}</span></React.Fragment>
          ))}
          {phoneNumber && (
             <><span>•</span><span>{phoneNumber}</span></>
          )}
          {fullAddress && (
             <><span>•</span><span>{fullAddress}</span></>
          )}
          {!fullAddress && (preferences?.region) && (
             <><span>•</span><span>{preferences.region}</span></>
          )}
        </div>
        {targetRole && <div className="text-md font-bold text-slate-800 mt-2 uppercase tracking-widest">{targetRole}</div>}
      </header>

      {/* Summary */}
      <section className="mb-6">
        <h3 className="text-sm font-bold uppercase border-b border-slate-300 mb-3 pb-1 tracking-wider">Professional Summary</h3>
        <p className="text-sm leading-relaxed text-slate-700">
           {summaryText}
        </p>
      </section>

      {/* Experience */}
      <section className="mb-6">
        <h3 className="text-sm font-bold uppercase border-b border-slate-300 mb-4 pb-1 tracking-wider">Work Experience</h3>
        <div className="space-y-5">
          {experienceItems && experienceItems.map((exp, i) => (
            <div key={i} data-pdf-block>
              <div className="flex justify-between items-end mb-1">
                <div className="font-bold text-md">{exp.company}</div>
                <div className="text-sm italic text-slate-600">{exp.dates}</div>
              </div>
              <div className="text-sm font-semibold mb-2">{exp.role}</div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {exp.description}
              </p>
            </div>
          ))}
          {(!experienceItems || experienceItems.length === 0) && (
             <div className="text-slate-300 text-sm">No experience added yet.</div>
          )}
        </div>
      </section>

      {/* Education */}
      <section className="mb-6">
        <h3 className="text-sm font-bold uppercase border-b border-slate-300 mb-4 pb-1 tracking-wider">Education</h3>
        <div className="space-y-3">
          {educationItems && educationItems.map((edu, i) => (
            <div key={i} className="flex justify-between">
              <div>
                <div className="font-bold text-sm">{edu.school}</div>
                <div className="text-sm text-slate-700">{edu.degree}</div>
              </div>
              <div className="text-sm italic text-slate-600">{edu.dates}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section>
        <h3 className="text-sm font-bold uppercase border-b border-slate-300 mb-3 pb-1 tracking-wider">Skills</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
           {skillItems && skillItems.map((skill, i) => (
             <div key={i} className="text-sm">
                <span className="font-bold mr-2">{skill.category}:</span>
                <span className="text-slate-700">{skill.items}</span>
             </div>
           ))}
        </div>
      </section>
      {visibleAdditionalSections.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-bold uppercase border-b border-slate-300 mb-3 pb-1 tracking-wider">Additional Sections</h3>
          <AdditionalSectionsList compact />
        </section>
      )}
    </div>
  );
};

export default LivePreview;
