import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ResumeInput from './components/ResumeInput';
import ResultsDisplay from './components/ResultsDisplay';
import AdminPanel from './components/AdminPanel';
import AuthScreen from './components/AuthScreen';
import AccountSettings from './components/AccountSettings';
import TemplateSelector from './components/TemplateSelector';
import AgentReviewModal from './components/AgentReviewModal';
import { generateResumeContent } from './services/geminiService';
import { authService } from './services/authService';
import { agentService } from './services/agentService';
import { AppMode, UserInputData, ParsedResponse, UserRole, User, SubscriptionPlan, AgentUpdate, ExperienceItem, EducationItem, SkillItem, PersonalDetails } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [results, setResults] = useState<ParsedResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatorTab, setGeneratorTab] = useState<'create' | 'upload' | 'cover_letter'>('create');
  
  // State to hold imported data for the editor
  const [editorData, setEditorData] = useState<Partial<UserInputData> | null>(null);

  // Agent State
  const [agentUpdates, setAgentUpdates] = useState<AgentUpdate[]>([]);
  const [showAgentModal, setShowAgentModal] = useState<boolean>(false);

  // Check for existing session on load
  useEffect(() => {
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
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId);
      setActiveTab('generator');
      setGeneratorTab('create');
    } else {
      setActiveTab('dashboard');
      // Trigger agent check after login
      checkAgentUpdates();
    }
  };

  const handleLogout = () => {
    authService.logout();
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
    setActiveTab('generator');
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
    if (activeTab === 'dashboard') {
        return (
          <Dashboard 
            onCreate={() => {
                setActiveTab('templates');
            }} 
            userName={currentUser.name} 
            onReviewUpdates={() => setShowAgentModal(true)}
            pendingUpdateCount={agentUpdates.filter(u => u.status === 'pending').length}
          />
        );
    }

    if (activeTab === 'templates') {
       return (
          <div className="max-w-7xl mx-auto py-12 px-6 text-center">
             <h2 className="text-3xl font-bold text-slate-800 mb-4">Choose a Template</h2>
             <p className="text-slate-500 mb-12">Select a style for your new resume.</p>
             <TemplateSelector onSelect={handleTemplateSelect} selectedId={selectedTemplateId} />
             <button 
               onClick={() => setActiveTab('dashboard')} 
               className="mt-12 text-slate-400 hover:text-slate-600 underline"
             >
               Cancel
             </button>
          </div>
       );
    }

    if (activeTab === 'cover_letter_dashboard') {
        return (
             <div className="max-w-6xl mx-auto py-12 px-6">
                <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Cover Letters</h2>
                    <p className="text-slate-500 mb-6">Create tailored cover letters for every application.</p>
                    <button 
                        onClick={() => {
                            setActiveTab('generator');
                            setGeneratorTab('cover_letter');
                        }}
                        className="bg-[#1a91f0] text-white px-6 py-2 rounded-full font-medium"
                    >
                        Go to Generator
                    </button>
                </div>
             </div>
        );
    }

    if (activeTab === 'admin_users' || activeTab === 'admin_audit') {
      if (currentUser.role !== UserRole.ADMIN) {
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
             <h2 className="text-xl font-semibold">Access Denied</h2>
          </div>
        );
      }
      return <div className="max-w-6xl mx-auto py-8 px-6"><AdminPanel /></div>;
    }

    if (activeTab === 'settings') {
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
      return <ResultsDisplay results={results} onReset={() => setResults(null)} />;
    }

    // Generator View - FULL WIDTH for Split Screen
    return (
      <div className="w-full px-4 lg:px-8 py-8">
        <ResumeInput 
            onGenerate={handleGenerate} 
            onImport={handleImport}
            onTemplateChange={setSelectedTemplateId}
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