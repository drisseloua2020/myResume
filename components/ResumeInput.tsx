import React, { useState, useRef, useEffect } from 'react';
import { AppMode, UserInputData, UserRole, SubscriptionPlan, ExperienceItem, EducationItem, SkillItem, User, PersonalDetails } from '../types';
import { AVAILABLE_TEMPLATES } from '../constants';
import LivePreview from './LivePreview';

interface ResumeInputProps {
  onGenerate: (data: UserInputData, mode: AppMode) => void;
  onImport: (data: UserInputData) => void;
  onTemplateChange: (templateId: string) => void;
  onDraftChange?: (draft: UserInputData) => void;
  isLoading: boolean;
  role: UserRole;
  userPlan: SubscriptionPlan;
  selectedTemplateId?: string;
  user: User; // Need user info for the preview
  initialTab?: 'upload' | 'create' | 'cover_letter';
  prefilledData?: Partial<UserInputData> | null;
}

type TabType = 'upload' | 'create' | 'cover_letter';

const ResumeInput: React.FC<ResumeInputProps> = ({ 
  onGenerate, 
  onImport,
  onTemplateChange,
  onDraftChange,
  isLoading, 
  role, 
  userPlan, 
  selectedTemplateId, 
  user, 
  initialTab = 'create',
  prefilledData 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  
  // Sync activeTab if initialTab changes (e.g. from parent navigation)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Personal Details State - Initialize with user data if available
  const [personalDetails, setPersonalDetails] = useState<PersonalDetails>(() => {
    // Split user name into first/last as default
    const nameParts = user.name ? user.name.split(' ') : [''];
    const initialFirst = nameParts[0] || '';
    const initialLast = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    return {
      firstName: initialFirst,
      lastName: initialLast,
      email: user.email || '',
      phone: '',
      address: '',
      city: '',
      state: '',
      country: '',
      summary: ''
    };
  });

  // Handle Prefilled Data (e.g. from Import)
  useEffect(() => {
    if (prefilledData) {
      if (prefilledData.targetRole) setTargetRole(prefilledData.targetRole);
      if (prefilledData.experienceItems) setExperiences(prefilledData.experienceItems);
      if (prefilledData.educationItems) setEducations(prefilledData.educationItems);
      if (prefilledData.skillItems) setSkills(prefilledData.skillItems);
      if (prefilledData.jobDescription) setJobDescription(prefilledData.jobDescription);
      if (prefilledData.personalDetails) {
         setPersonalDetails(prev => ({
             ...prev,
             ...prefilledData.personalDetails
         }));
      }
    }
  }, [prefilledData]);
  
  // Common State
  const [targetRole, setTargetRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [preferences, setPreferences] = useState<UserInputData['preferences']>({
    pages: '1-page',
    tone: 'modern',
    region: 'US',
    photo: false,
  });

  // Mode A State (Upload)
  const [currentResumeText, setCurrentResumeText] = useState('');
  const [fileData, setFileData] = useState<{ mimeType: string, data: string } | undefined>(undefined);
  const [fileName, setFileName] = useState<string | null>(null);

  // Profile Photo State
  const [profileImageData, setProfileImageData] = useState<{ mimeType: string, data: string } | undefined>(undefined);
  const [profilePhotoName, setProfilePhotoName] = useState<string | null>(null);

  // Mode B State (Structured)
  const [experiences, setExperiences] = useState<ExperienceItem[]>([
    { id: '1', role: 'Product Manager', company: 'Tech Corp', dates: '2020 - Present', description: 'Led a team of 5 engineers to launch...' }
  ]);
  const [educations, setEducations] = useState<EducationItem[]>([
    { id: '1', degree: 'BS Computer Science', school: 'University of Tech', dates: '2016 - 2020' }
  ]);
  const [skills, setSkills] = useState<SkillItem[]>([
    { id: '1', category: 'Technical Skills', items: 'React, TypeScript, Node.js, Python' },
    { id: '2', category: 'Languages', items: 'English (Native), Spanish (B2)' }
  ]);

  const activeTemplate = AVAILABLE_TEMPLATES.find(t => t.id === selectedTemplateId);

  // Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic'];
      if (!validTypes.includes(file.type)) {
        alert("Supported formats: PDF, PNG, JPEG, WEBP.");
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFileData({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
        setCurrentResumeText('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic'];
      if (!validTypes.includes(file.type)) {
        alert("Please upload a valid image file.");
        return;
      }
      setProfilePhotoName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImageData({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
      };
      reader.readAsDataURL(file);
    }
  };

  // Structured Data Handlers
  const addExperience = () => setExperiences([...experiences, { id: Math.random().toString(), role: '', company: '', dates: '', description: '' }]);
  const removeExperience = (id: string) => setExperiences(experiences.filter(i => i.id !== id));
  const updateExperience = (id: string, field: keyof ExperienceItem, value: string) => setExperiences(experiences.map(i => i.id === id ? { ...i, [field]: value } : i));

  const addEducation = () => setEducations([...educations, { id: Math.random().toString(), degree: '', school: '', dates: '' }]);
  const removeEducation = (id: string) => setEducations(educations.filter(i => i.id !== id));
  const updateEducation = (id: string, field: keyof EducationItem, value: string) => setEducations(educations.map(i => i.id === id ? { ...i, [field]: value } : i));

  const addSkill = () => setSkills([...skills, { id: Math.random().toString(), category: '', items: '' }]);
  const removeSkill = (id: string) => setSkills(skills.filter(i => i.id !== id));
  const updateSkill = (id: string, field: keyof SkillItem, value: string) => setSkills(skills.map(i => i.id === id ? { ...i, [field]: value } : i));

  const updatePersonalDetails = (field: keyof PersonalDetails, value: string) => {
    setPersonalDetails(prev => ({ ...prev, [field]: value }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAction = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload: UserInputData = { 
        role, 
        plan: userPlan, 
        targetRole, 
        jobDescription, 
        preferences, 
        profileImageData,
        templateId: selectedTemplateId,
        personalDetails
    };

    if (activeTab === 'upload') {
        // For Import tab, we default to "Import to Editor"
        payload.currentResumeText = currentResumeText;
        payload.fileData = fileData;
        onImport(payload);
    } else {
        // For Create & Cover Letter tabs, we Generate
        payload.experienceItems = experiences;
        payload.educationItems = educations;
        payload.skillItems = skills;
        const mode = AppMode.CREATE_SCRATCH; 
        onGenerate(payload, mode);
    }
  };

  // Construct current data object for preview
  const currentData: UserInputData = {
    role,
    plan: userPlan,
    targetRole,
    jobDescription,
    preferences,
    profileImageData,
    personalDetails,
    experienceItems: experiences,
    educationItems: educations,
    skillItems: skills
  };

  // Autosave workspace draft while editing (debounced)
  useEffect(() => {
    if (!onDraftChange) return;
    if (activeTab !== 'create') return;
    if (isLoading) return;

    const t = window.setTimeout(() => {
      try {
        onDraftChange({ ...currentData, templateId: selectedTemplateId });
      } catch {
        // ignore autosave errors at this layer
      }
    }, 1200);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    isLoading,
    selectedTemplateId,
    targetRole,
    jobDescription,
    preferences,
    profileImageData,
    personalDetails,
    experiences,
    educations,
    skills
  ]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative items-start">
      
      {/* --- LEFT COLUMN: EDITOR FORM --- */}
      <div className="w-full lg:w-5/12 xl:w-[450px] 2xl:w-[500px] flex-shrink-0 no-print">
        <div className="flex justify-between items-center mb-6 relative">
          <div className="bg-white p-1 rounded-full shadow-sm border border-slate-200 inline-flex overflow-x-auto max-w-full">
             <button
               type="button"
               onClick={() => setActiveTab('create')}
               className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'create' ? 'bg-[#1a91f0] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               Live Editor
             </button>
             <button
               type="button"
               onClick={() => setActiveTab('upload')}
               className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'upload' ? 'bg-[#1a91f0] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               Import PDF
             </button>
             <button
               type="button"
               onClick={() => setActiveTab('cover_letter')}
               className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${activeTab === 'cover_letter' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               <span>Cover Letter</span>
             </button>
          </div>

          <div className="relative z-20">
             <button 
                type="button"
                onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200 hidden sm:flex hover:border-blue-300 transition-colors"
              >
                {activeTemplate ? (
                    <>
                        <div className={`w-3 h-3 rounded-full ${activeTemplate.color}`}></div>
                        <span className="text-sm font-semibold text-slate-700 max-w-[100px] truncate">{activeTemplate.name}</span>
                    </>
                ) : (
                    <span className="text-sm font-semibold text-slate-700">Template</span>
                )}
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

             {showTemplateSelector && (
                 <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-fade-in-up">
                     <div className="text-xs font-bold text-slate-400 px-3 py-2 uppercase tracking-wide">Select Template</div>
                     {AVAILABLE_TEMPLATES.map(t => (
                         <button
                           key={t.id}
                           type="button"
                           onClick={() => {
                               onTemplateChange(t.id);
                               setShowTemplateSelector(false);
                           }}
                           className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${selectedTemplateId === t.id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50 border border-transparent'}`}
                         >
                            <div className={`w-8 h-8 rounded-full ${t.color} flex-shrink-0 border border-black/10`}></div>
                            <div className="overflow-hidden">
                                <div className={`text-sm font-bold truncate ${selectedTemplateId === t.id ? 'text-blue-700' : 'text-slate-800'}`}>{t.name}</div>
                                <div className="text-[10px] text-slate-500 truncate">{t.tag}</div>
                            </div>
                            {selectedTemplateId === t.id && <svg className="w-4 h-4 text-blue-500 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                         </button>
                     ))}
                 </div>
             )}
          </div>
        </div>

        <form onSubmit={handleAction} className="space-y-6">
          
          {/* Target Role - Always visible */}
          <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
             <h2 className="text-sm font-bold text-slate-800 mb-1 uppercase tracking-wide">Target Role</h2>
             <input
                type="text"
                className="w-full bg-[#f7f9fa] p-3 border-b-2 border-slate-200 focus:border-[#1a91f0] outline-none font-medium transition-colors"
                placeholder="e.g. Senior Product Designer"
                value={targetRole}
                onChange={e => setTargetRole(e.target.value)}
             />
          </div>

          {activeTab === 'upload' && (
             <div className="bg-white rounded border border-slate-200 p-8 shadow-sm text-center">
               <div className="border-2 border-dashed border-slate-300 rounded-lg p-10 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="application/pdf,image/*" />
                  <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  {fileName ? (
                    <p className="font-semibold text-slate-800">{fileName}</p>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-700">Upload Resume (PDF)</p>
                      <p className="text-sm text-slate-400 mt-1">or drag and drop here</p>
                    </>
                  )}
               </div>
               <div className="mt-6">
                 <p className="text-xs font-bold text-slate-400 uppercase mb-2">OR PASTE TEXT</p>
                 <textarea
                    className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Paste your resume content here..."
                    value={currentResumeText}
                    onChange={e => setCurrentResumeText(e.target.value)}
                    disabled={!!fileName}
                 />
               </div>
             </div>
          )}

          {activeTab === 'create' && (
            <>
               {/* Personal Details */}
               <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide">Personal Details</h2>
                  <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-6 mb-2">
                          <div className="flex-shrink-0">
                             <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden relative">
                                {profileImageData ? (
                                  <img src={`data:${profileImageData.mimeType};base64,${profileImageData.data}`} className="w-full h-full object-cover" alt="Profile" />
                                ) : (
                                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                )}
                             </div>
                          </div>
                          <div>
                              <input type="file" ref={profilePhotoRef} onChange={handleProfilePhotoUpload} className="hidden" accept="image/*"/>
                              <button type="button" onClick={() => profilePhotoRef.current?.click()} className="text-[#1a91f0] font-medium text-sm hover:underline">
                                  {profileImageData ? 'Change Photo' : 'Upload Photo'}
                              </button>
                              <div className="mt-2 flex items-center gap-2">
                                 <input 
                                    type="checkbox" 
                                    id="includePhoto" 
                                    checked={preferences?.photo} 
                                    onChange={e => setPreferences({...preferences!, photo: e.target.checked})} 
                                    className="rounded text-[#1a91f0] focus:ring-[#1a91f0]"
                                  />
                                 <label htmlFor="includePhoto" className="text-sm text-slate-600">Include photo</label>
                              </div>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase">First Name</label>
                             <input value={personalDetails.firstName} onChange={e => updatePersonalDetails('firstName', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm font-medium" placeholder="First Name" />
                          </div>
                          <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase">Last Name</label>
                             <input value={personalDetails.lastName} onChange={e => updatePersonalDetails('lastName', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm font-medium" placeholder="Last Name" />
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
                            <input value={personalDetails.email} onChange={e => updatePersonalDetails('email', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="email@example.com" />
                         </div>
                         <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                            <input value={personalDetails.phone} onChange={e => updatePersonalDetails('phone', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="+1 (555) 000-0000" />
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase">Street Address</label>
                             <input value={personalDetails.address} onChange={e => updatePersonalDetails('address', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="e.g. 123 Main St" />
                          </div>
                          <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase">Country</label>
                             <input value={personalDetails.country} onChange={e => updatePersonalDetails('country', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="e.g. United States" />
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">City</label>
                            <input value={personalDetails.city} onChange={e => updatePersonalDetails('city', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="e.g. San Francisco" />
                         </div>
                         <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase">State / Zip</label>
                             <input value={personalDetails.state} onChange={e => updatePersonalDetails('state', e.target.value)} className="w-full bg-[#f7f9fa] p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="e.g. CA 94105" />
                         </div>
                      </div>
                  </div>
               </div>
               
               {/* Professional Summary */}
               <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                   <h2 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide">Professional Summary</h2>
                   <textarea 
                     value={personalDetails.summary} 
                     onChange={e => updatePersonalDetails('summary', e.target.value)}
                     className="w-full h-32 bg-[#f7f9fa] p-3 border border-slate-300 rounded text-sm leading-relaxed" 
                     placeholder="A brief overview of your career history and key achievements..."
                   />
               </div>

               {/* Experience */}
               <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                  <div className="flex justify-between items-end mb-4">
                      <div>
                          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Employment History</h2>
                      </div>
                  </div>
                  <div className="space-y-4">
                     {experiences.map((exp, idx) => (
                        <div key={exp.id} className="bg-[#f7f9fa] p-4 rounded border border-slate-200 relative group">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Job Title</label>
                                  <input value={exp.role} onChange={e => updateExperience(exp.id, 'role', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm font-medium" />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Employer</label>
                                  <input value={exp.company} onChange={e => updateExperience(exp.id, 'company', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm" />
                              </div>
                              <div className="md:col-span-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Dates</label>
                                  <input value={exp.dates} onChange={e => updateExperience(exp.id, 'dates', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="e.g. Jan 2022 - Present" />
                              </div>
                           </div>
                           <div className="mb-2">
                               <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
                               <textarea value={exp.description} onChange={e => updateExperience(exp.id, 'description', e.target.value)} className="w-full h-20 bg-white p-2 border border-slate-300 rounded mt-1 text-sm" placeholder="Achievements, responsibilities..." />
                           </div>
                           {idx > 0 && <button type="button" onClick={() => removeExperience(exp.id)} className="text-red-400 text-xs hover:text-red-600">Remove</button>}
                        </div>
                     ))}
                     <button type="button" onClick={addExperience} className="text-[#1a91f0] font-semibold text-sm flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded transition-colors w-full justify-center">
                        + Add Employment
                     </button>
                  </div>
               </div>

               {/* Education */}
               <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Education</h2>
                  <div className="space-y-4">
                     {educations.map((edu, idx) => (
                        <div key={edu.id} className="bg-[#f7f9fa] p-4 rounded border border-slate-200 relative">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">School / University</label>
                                  <input value={edu.school} onChange={e => updateEducation(edu.id, 'school', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm" />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Degree</label>
                                  <input value={edu.degree} onChange={e => updateEducation(edu.id, 'degree', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm" />
                              </div>
                               <div className="md:col-span-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Dates</label>
                                  <input value={edu.dates} onChange={e => updateEducation(edu.id, 'dates', e.target.value)} className="w-full bg-white p-2 border border-slate-300 rounded mt-1 text-sm" />
                              </div>
                           </div>
                           {idx > 0 && <button type="button" onClick={() => removeEducation(edu.id)} className="text-red-400 text-xs mt-2">Remove</button>}
                        </div>
                     ))}
                     <button type="button" onClick={addEducation} className="text-[#1a91f0] font-semibold text-sm flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded transition-colors w-full justify-center">
                        + Add Education
                     </button>
                  </div>
               </div>

               {/* Skills */}
               <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Skills</h2>
                  <div className="space-y-4">
                     {skills.map((skill, idx) => (
                        <div key={skill.id} className="flex gap-4 items-start">
                           <input value={skill.category} onChange={e => updateSkill(skill.id, 'category', e.target.value)} className="w-1/3 bg-slate-50 p-2 border border-slate-200 rounded text-sm font-medium" placeholder="Category" />
                           <input value={skill.items} onChange={e => updateSkill(skill.id, 'items', e.target.value)} className="flex-1 bg-slate-50 p-2 border border-slate-200 rounded text-sm" placeholder="List skills..." />
                           {idx > 0 && <button type="button" onClick={() => removeSkill(skill.id)} className="text-slate-400 hover:text-red-500 px-2">×</button>}
                        </div>
                     ))}
                     <button type="button" onClick={addSkill} className="text-[#1a91f0] font-semibold text-sm flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded transition-colors w-full justify-center">
                        + Add Skill
                     </button>
                  </div>
               </div>
            </>
          )}

          {activeTab === 'cover_letter' && (
              <div className="bg-white rounded border border-slate-200 p-8 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-800 mb-1">Target Job Description</h2>
                  <p className="text-sm text-slate-500 mb-4">Paste the JD here. We will use your profile data (or uploaded resume) to write a tailored cover letter.</p>
                  <textarea 
                      value={jobDescription}
                      onChange={e => setJobDescription(e.target.value)}
                      className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded focus:border-[#1a91f0] outline-none text-sm leading-relaxed"
                      placeholder="Paste job description here so AI can tailor your cover letter..."
                  />
                  <div className="mt-4 bg-blue-50 text-blue-800 p-3 rounded text-sm border border-blue-100 flex items-start gap-2">
                     <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     <p>We'll use your employment history from the "Live Editor" tab to write this letter. Make sure your details are up to date there.</p>
                  </div>
              </div>
          )}

          {/* Action Button */}
          <div className="pt-4 pb-20">
             <button
               type="submit"
               disabled={isLoading}
               className={`w-full bg-slate-800 text-white text-lg font-bold px-12 py-4 rounded-lg shadow-lg transform transition hover:-translate-y-1 hover:shadow-xl flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-700'}`}
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               {isLoading ? 'Processing...' : (
                   activeTab === 'upload' ? 'Import to Live Editor' : 
                   activeTab === 'cover_letter' ? 'Generate Cover Letter' : 
                   'AI Enhance & Tailor Resume'
               )}
             </button>
             <p className="text-xs text-center text-slate-400 mt-2">
                {activeTab === 'upload' ? 'Extracts text and fills the editor so you can verify and customize.' : 
                 activeTab === 'cover_letter' ? 'Create a tailored cover letter and cold email based on your resume.' : 
                 'Use AI to fix grammar, improve impact, and tailor to job description.'}
             </p>
          </div>

        </form>
      </div>

      {/* --- RIGHT COLUMN: LIVE PREVIEW --- */}
      <div className="flex-1 print-container lg:sticky lg:top-24 self-start">
         <div className="bg-slate-200/50 rounded-xl border-2 border-slate-200 p-4 lg:p-8 flex flex-col items-center min-h-[600px] no-print relative">
            <div className="w-full flex justify-between items-center mb-6 max-w-[210mm]">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                 Live Preview
               </h3>
               <button 
                 onClick={handlePrint}
                 className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 Download PDF
               </button>
            </div>
            
            {/* The Resume Document Component - Wrapped to handle overflow on smaller screens */}
            <div className="w-full overflow-x-auto pb-4 flex justify-center custom-scrollbar">
                <div className="transform origin-top transition-transform duration-200 scale-[0.55] sm:scale-[0.7] md:scale-[0.85] xl:scale-100">
                    <LivePreview data={currentData} user={user} templateId={selectedTemplateId} />
                </div>
            </div>

            <div className="mt-4 text-[10px] text-slate-400 text-center max-w-md">
               Tip: This preview scales to fit your screen. The downloaded PDF will be 100% size (A4).
            </div>
         </div>
         
         {/* Hidden container for actual printing that sits outside the scaled view */}
         <div className="hidden print:block print:absolute print:top-0 print:left-0 print:w-full">
            <LivePreview data={currentData} user={user} templateId={selectedTemplateId} />
         </div>
      </div>

    </div>
  );
};

export default ResumeInput;