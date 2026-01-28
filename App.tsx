import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ResumeInput from './components/ResumeInput';
import ResultsDisplay from './components/ResultsDisplay';
import ResumeLibraryPage from './components/ResumeLibraryPage';
import CoverLettersPage from './components/CoverLettersPage';
import CoverLetterExamplesPage from './components/CoverLetterExamplesPage';
import ProfileSyncPage from './components/ProfileSyncPage';
import AdminActivityLogsPage from './components/AdminActivityLogsPage';
import AdminAgentUpdatesPage from './components/AdminAgentUpdatesPage';
import AdminContactMessagesPage from './components/AdminContactMessagesPage';
import AdminUsersPage from './components/AdminUsersPage';
import AdminResumesPage from './components/AdminResumesPage';
import AuthScreen from './components/AuthScreen';
import ContactPage from './components/ContactPage';
import AccountSettings from './components/AccountSettings';
import TemplateSelector from './components/TemplateSelector';
import CareerBlogPage from './components/CareerBlogPage';
import ResumeGuidePage from './components/ResumeGuidePage';
import ResumeExamplesPage from './components/ResumeExamplesPage';
import AgentReviewModal from './components/AgentReviewModal';
import { generateResumeContent } from './services/geminiService';
import { authService } from './services/authService';
import { setSession } from './services/apiClient';
import { agentService } from './services/agentService';
import { saveDraft, getLatestDraft } from './services/resumeService';
import { AppMode, UserInputData, ParsedResponse, UserRole, User, SubscriptionPlan, AgentUpdate, ExperienceItem, EducationItem, SkillItem, PersonalDetails } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('workspace');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [results, setResults] = useState<ParsedResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatorTab, setGeneratorTab] = useState<'create' | 'upload' | 'cover_letter'>('create');

  // State to hold imported data for the editor
  const [editorData, setEditorData] = useState<Partial<UserInputData> | null>(null);

  // Load latest draft when opening the WorkSpace
  useEffect(() => {
    if (!currentUser) return;
    if (activeTab !== 'workspace') return;
    // If we already have editorData from an import in this session, don't overwrite it
    if (editorData) return;

    (async () => {
      try {
        const draft = await getLatestDraft(selectedTemplateId);
        if (draft?.content) {
          setEditorData(draft.content as any);
        }
      } catch {
        // ignore load errors (workspace can start empty)
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, activeTab, selectedTemplateId]);

  // Agent State
  const [agentUpdates, setAgentUpdates] = useState<AgentUpdate[]>([]);
  const [showAgentModal, setShowAgentModal] = useState<boolean>(false);

  // Check for existing session on load
  useEffect(() => {
    // OAuth callback: backend redirects to frontend with ?token=JWT
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const templateIdFromOAuth = params.get('templateId') || undefined;
    if (token) {
      // cache token temporarily, then refresh user
      setSession(token, { id: '', name: '', email: '', role: 'user', plan: 'free', paidAmount: '$0.00', status: 'Active' });
      authService.refreshMe()
        .then((u) => {
          if (u) {
            setCurrentUser(u);
            if (templateIdFromOAuth) {
              setSelectedTemplateId(templateIdFromOAuth);
              setActiveTab('workspace');
              setGeneratorTab('create');
            }
            checkAgentUpdates();
          }
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      return;
    }

    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      // Simulate Agent checking for updates on load (simulate email link opening app)
      checkAgentUpdates();
    }
  }, []);

  const checkAgentUpdates = async () => {
    // In real world, this happens in bg, here we simulate a fetch
    const updates = await agentService.checkForUpdates();
    setAgentUpdates(updates);
  };

  const handleLogin = (user: User, initialTemplateId?: string) => {
    setCurrentUser(user);
    setResults(null);
    if (user.role === 'admin') {
      setActiveTab('admin_logs');
      return;
    }
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId);
      setActiveTab('workspace');
      setGeneratorTab('create');
      return;
    }

    // Default landing for users is the WorkSpace
    setActiveTab('workspace');
    // Trigger agent check after login
    checkAgentUpdates();
  };

  const handleLogout = () => {
    // Best-effort backend logout (audit), then clear local session.
    void authService.logout();
    setCurrentUser(null);
    setSelectedTemplateId(undefined);
    setAgentUpdates([]);
  };

  const handlePlanUpdate = (newPlan: SubscriptionPlan) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, plan: newPlan });
    }
  };

  const handleGenerate = async (data: UserInputData, mode: AppMode) => {
    if (!currentUser) return;

    setIsLoading(true);
    setError(null);
    try {
      // Ensure workspace state is persisted before AI processing
      await saveDraft({ templateId: data.templateId || selectedTemplateId, content: { ...data, templateId: data.templateId || selectedTemplateId } });
      authService.logActivity(currentUser.id, currentUser.name, 'RESUME_GENERATE', `Mode: ${mode}, Template: ${data.templateId || 'None'}`);
      const parsedResults = await generateResumeContent(data, mode);
      setResults(parsedResults);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper to map JSON to State
  const mapJsonToState = (json: any): Partial<UserInputData> => {
      if (!json) return {};
      
      const experiences: ExperienceItem[] = json.experience?.map((exp: any) => ({
          id: Math.random().toString(),
          role: exp.role || '',
          company: exp.company || '',
          dates: exp.start && exp.end ? `${exp.start} - ${exp.end}` : (exp.start || ''),
          description: exp.highlights?.map((h: any) => typeof h === 'string' ? h : h.bullet).join('\n') || ''
      })) || [];

      const educations: EducationItem[] = json.education?.map((edu: any) => ({
          id: Math.random().toString(),
          degree: edu.degree || '',
          school: edu.school || '',
          dates: edu.start && edu.end ? `${edu.start} - ${edu.end}` : (edu.start || '')
      })) || [];

      const skills: SkillItem[] = [];
      if (json.skills) {
          Object.entries(json.skills).forEach(([category, items]) => {
              if (Array.isArray(items) && items.length > 0) {
                  skills.push({
                      id: Math.random().toString(),
                      category: category.charAt(0).toUpperCase() + category.slice(1),
                      items: items.join(', ')
                  });
              }
          });
      }

      // Extract location data if possible (simple split)
      const locationParts = json.header?.location ? json.header.location.split(',') : [];
      const city = locationParts[0]?.trim() || '';
      const state = locationParts[1]?.trim() || '';

      // Extract Name
      const nameParts = json.header?.name ? json.header.name.split(' ') : [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      const personalDetails: PersonalDetails = {
          firstName: firstName,
          lastName: lastName,
          email: json.header?.email || '',
          phone: json.header?.phone || '',
          address: '', // Resume parsers often miss street address, default empty
          city: city,
          state: state,
          country: '',
          summary: json.summary || ''
      };

      return {
          targetRole: json.header?.title || '',
          personalDetails: personalDetails,
          experienceItems: experiences,
          educationItems: educations,
          skillItems: skills,
      };
  };

  const handleImport = async (data: UserInputData) => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
        authService.logActivity(currentUser.id, currentUser.name, 'RESUME_PARSE', 'Importing PDF to Editor');
        // We use FORMAT_EXISTING mode to parse the PDF/Text
        const parsedResults = await generateResumeContent(data, AppMode.FORMAT_EXISTING);
        
        if (parsedResults.json) {
            const mappedData = mapJsonToState(parsedResults.json);
            setEditorData(mappedData);
            // Persist imported result as the latest draft (workspace state)
            await saveDraft({
              templateId: selectedTemplateId,
              content: {
                ...data,
                ...mappedData,
                templateId: selectedTemplateId,
              },
            });
            // Switch to Create tab to show the editor
            setGeneratorTab('create');
            // Ensure no results overlay is showing
            setResults(null);
        } else {
            throw new Error("Could not parse resume data structure.");
        }
    } catch (err: any) {
        setError(err.message || "Failed to import resume.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setActiveTab('workspace');
    setGeneratorTab('create');
  };

  // Agent Modal Handlers
  const handleAgentApprove = (id: string) => {
    setAgentUpdates(prev => prev.map(u => u.id === id ? { ...u, status: 'approved' } : u));
    // In a real app, this would inject data into the ResumeInput state
    // For visual feedback only in this demo:
    alert("Content added to your profile! (Simulation)");
  };

  const handleAgentReject = (id: string) => {
    setAgentUpdates(prev => prev.map(u => u.id === id ? { ...u, status: 'rejected' } : u));
  };

  // If no user is logged in, show Auth Screen
  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const renderContent = () => {
    // NOTE: The "WorkSpace" is the primary resume editor experience.
    // Dashboard is kept for legacy/demo but not shown in user tabs.

    if (activeTab === 'templates') {
       return (
          <div className="max-w-7xl mx-auto py-12 px-6 text-center">
             <h2 className="text-3xl font-bold text-slate-800 mb-4">Choose a Template</h2>
             <p className="text-slate-500 mb-12">Select a style for your new resume.</p>
             <TemplateSelector onSelect={handleTemplateSelect} selectedId={selectedTemplateId} />
             <button 
               onClick={() => setActiveTab('workspace')} 
               className="mt-12 text-slate-400 hover:text-slate-600 underline"
             >
               Cancel
             </button>
          </div>
       );
    }

    if (activeTab === 'career_blog') {
      return <CareerBlogPage onBack={() => setActiveTab('workspace')} />;
    }

    if (activeTab === 'resume_guide') {
      return <ResumeGuidePage onBack={() => setActiveTab('workspace')} />;
    }

    if (activeTab === 'resume_examples') {
      return (
        <ResumeExamplesPage
          onBack={() => setActiveTab('workspace')}
          onChooseTemplate={(templateId) => {
            setSelectedTemplateId(templateId);
            setActiveTab('workspace');
            setGeneratorTab('create');
          }}
        />
      );
    }

    if (activeTab === 'cover_letters') {
      return (
        <div className="max-w-6xl mx-auto py-8 px-6">
          <CoverLettersPage onOpenExamples={() => setActiveTab('cover_letter_examples')} />
        </div>
      );
    }

    if (activeTab === 'cover_letter_examples') {
      return (
        <CoverLetterExamplesPage onBack={() => setActiveTab('cover_letters')} />
      );
    }

    if (activeTab === 'resumes') {
      return (
        <div className="max-w-6xl mx-auto py-8 px-6">
          <ResumeLibraryPage />
        </div>
      );
    }

    if (activeTab === 'profile_sync') {
      return (
        <div className="max-w-6xl mx-auto py-8 px-6">
          <ProfileSyncPage />
        </div>
      );
    }

    if (activeTab === 'admin_logs') {
      return <AdminActivityLogsPage />;
    }
    if (activeTab === 'admin_agents') {
      return <AdminAgentUpdatesPage />;
    }
    if (activeTab === 'admin_contacts') {
      return <AdminContactMessagesPage />;
    }
    if (activeTab === 'admin_users') {
      return <AdminUsersPage />;
    }
    if (activeTab === 'admin_resumes') {
      return <AdminResumesPage />;
    }

    if (activeTab === 'contact') {
      return (
        <ContactPage user={currentUser} />
      );
    }

    if (activeTab === 'account') {
      return (
        <div className="max-w-4xl mx-auto py-8 px-6">
            <AccountSettings 
            user={currentUser} 
            onPlanUpdate={handlePlanUpdate} 
            />
        </div>
      );
    }

    if (results) {
      return <ResultsDisplay results={results} templateId={selectedTemplateId} onReset={() => setResults(null)} />;
    }

    if (activeTab !== 'workspace') {
      // Fallback to WorkSpace
      setActiveTab('workspace');
      return null;
    }

    // WorkSpace View - FULL WIDTH for Split Screen
    return (
      <div className="w-full px-4 lg:px-8 py-8 space-y-4">
        <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Sources</div>
            <div className="text-xs text-slate-600">Connect & sync LinkedIn, GitHub, and Universal sources.</div>
          </div>
          <button
            onClick={() => setActiveTab('profile_sync')}
            className="px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 text-sm"
          >
            Manage Sources
          </button>
        </div>

        <ResumeInput 
          onGenerate={handleGenerate} 
          onImport={handleImport}
          onTemplateChange={setSelectedTemplateId}
          onDraftChange={async (draft) => {
            // Persist workspace edits as the user types
            await saveDraft({ templateId: draft.templateId ?? selectedTemplateId, content: draft });
          }}
          prefilledData={editorData}
          isLoading={isLoading} 
          role={currentUser.role}
          userPlan={currentUser.plan}
          selectedTemplateId={selectedTemplateId}
          user={currentUser}
          initialTab={generatorTab}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f9fa] flex flex-col font-sans text-slate-900">
      <Header 
        currentUser={currentUser} 
        onLogout={handleLogout}
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <main className="flex-1">
        {error && (
          <div className="max-w-4xl mx-auto mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-3">
             <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             {error}
          </div>
        )}
        {renderContent()}
      </main>

      {/* Agent Review Modal */}
      {showAgentModal && (
        <AgentReviewModal 
          updates={agentUpdates} 
          onClose={() => setShowAgentModal(false)}
          onApprove={handleAgentApprove}
          onReject={handleAgentReject}
        />
      )}
    </div>
  );
};

export default App;