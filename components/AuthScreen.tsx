import React, { useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { API_URL } from '../services/apiClient';
import { User, SubscriptionPlan } from '../types';
import { PLAN_DETAILS } from '../constants';
import TemplateSelector from './TemplateSelector';
import ContactPage from './ContactPage'; // Reuse the form
import CareerBlogPage from './CareerBlogPage';
import ResumeGuidePage from './ResumeGuidePage';
import ResumeExamplesPage from './ResumeExamplesPage';
import CookiesPage from './CookiesPage';
import CookiesPrivacyPolicyPage from './CookiesPrivacyPolicyPage';
import CookiesTermsOfUsePage from './CookiesTermsOfUsePage';

interface AuthScreenProps {
  onLogin: (user: User, initialTemplateId?: string) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [activeModal, setActiveModal] = useState<'none' | 'login' | 'pricing' | 'signup' | 'contact'>('none');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(SubscriptionPlan.FREE);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [publicPage, setPublicPage] = useState<
    'home' |
    'career_blog' |
    'resume_guide' |
    'resume_examples' |
    'cookies' |
    'cookies_privacy' |
    'cookies_terms'
  >('home');

  const navigateToSection = (sectionId: 'templates' | 'pricing' | 'about') => {
    // Ensure we're on the home public page, then scroll to the section.
    setPublicPage('home');
    window.location.hash = `#${sectionId}`;
    window.setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  useEffect(() => {
    if (publicPage !== 'home') return;
    const hash = window.location.hash || '';
    const id = hash.startsWith('#') ? (hash.slice(1) as any) : '';
    if (id === 'templates' || id === 'pricing' || id === 'about') {
      window.setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [publicPage]);


  const handleStartCreate = () => {
    setActiveModal('pricing');
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    // After selecting a template, go to pricing
    handleStartCreate();
  };

  const handlePlanSelected = (plan: SubscriptionPlan) => {
    // Pro plans are disabled (coming soon). Force FREE.
    if (plan !== SubscriptionPlan.FREE) return;
    setSelectedPlan(SubscriptionPlan.FREE);
    setActiveModal('signup');
  };

  const handleLoginClick = () => {
    setActiveModal('login');
  }

  const handleAuthSuccess = (user: User, kind: 'login' | 'signup') => {
    // Signup redirect rules:
    // - No template selected: go to home/dashboard
    // - Template selected: go directly to that template
    if (kind === 'signup') {
      if (selectedTemplateId) {
        onLogin(user, selectedTemplateId);
      } else {
        onLogin(user);
      }
      return;
    }

    onLogin(user);
  };

  // SSO/OAuth is intentionally disabled in this build.

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* --- Navigation --- */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <button onClick={() => setPublicPage('home')} className="flex items-center gap-2 cursor-pointer">
                     <div className="w-10 h-10 bg-[#1a91f0] rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-lg">My</span>
                     </div>
                     <span className="font-bold text-xl tracking-tight text-slate-800">Resume</span>
          </button>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
             <button onClick={() => navigateToSection('templates')} className="hover:text-[#1a91f0] transition-colors">Resume Templates</button>
             <button onClick={() => navigateToSection('pricing')} className="hover:text-[#1a91f0] transition-colors">Pricing</button>
             <button onClick={() => navigateToSection('about')} className="hover:text-[#1a91f0] transition-colors">About Us</button>
             <button onClick={() => setPublicPage('career_blog')} className="hover:text-[#1a91f0] transition-colors">
               Career Blog
             </button>
             <button onClick={() => setPublicPage('resume_guide')} className="hover:text-[#1a91f0] transition-colors">
               Resume Guide
             </button>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleLoginClick}
              className="text-slate-600 hover:text-[#1a91f0] font-semibold text-sm px-4 py-2"
            >
              Log In
            </button>
            <button 
              onClick={handleStartCreate}
              className="bg-[#1a91f0] hover:bg-[#1170cd] text-white px-6 py-2.5 rounded-full font-bold text-sm transition-transform transform hover:-translate-y-0.5 shadow-md"
            >
              Create My Resume
            </button>
          </div>
        </div>
      </nav>

      {publicPage !== 'home' && (
        <>
          {publicPage === 'career_blog' && <CareerBlogPage onBack={() => setPublicPage('home')} />}
          {publicPage === 'resume_guide' && <ResumeGuidePage onBack={() => setPublicPage('home')} />}
          {publicPage === 'resume_examples' && (
            <ResumeExamplesPage
              onBack={() => setPublicPage('home')}
              onChooseTemplate={(templateId) => {
                setSelectedTemplateId(templateId);
                handleStartCreate();
              }}
            />
          )}
          {publicPage === 'cookies' && (
            <CookiesPage
              onBack={() => setPublicPage('home')}
              onOpenPrivacy={() => setPublicPage('cookies_privacy')}
              onOpenTerms={() => setPublicPage('cookies_terms')}
            />
          )}
          {publicPage === 'cookies_privacy' && (
            <CookiesPrivacyPolicyPage onBack={() => setPublicPage('cookies')} />
          )}
          {publicPage === 'cookies_terms' && (
            <CookiesTermsOfUsePage onBack={() => setPublicPage('cookies')} />
          )}
        </>
      )}

      {publicPage === 'home' && (
        <>
      {/* --- Hero Section --- */}
      <header className="relative pt-16 pb-24 overflow-hidden bg-slate-50/50">
         <div className="max-w-6xl mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center gap-12">
            
            {/* Left Text */}
            <div className="flex-1 text-center md:text-left">
                <span className="text-[#1a91f0] font-bold tracking-wider text-sm uppercase mb-4 block">
                Online Resume Builder
                </span>
                <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 leading-[1.1] mb-6">
                Only 2% of resumes make it past the first round. <br/>
                <span className="text-[#1a91f0]">Be in the top 2%.</span>
                </h1>
                <p className="text-lg text-slate-500 mb-8 max-w-xl mx-auto md:mx-0">
                Use professional field-tested resume templates that follow the exact "resume rules" employers look for. Easy to use and done within minutes.
                </p>
                <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-4 mb-10">
                <button 
                    onClick={handleStartCreate}
                    className="bg-[#1a91f0] text-white text-lg font-bold px-10 py-4 rounded-full shadow-lg hover:shadow-xl hover:bg-[#1170cd] transition-all transform hover:-translate-y-1"
                >
                    Create My Resume
                </button>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1"><svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> ATS-Friendly</span>
                    <span className="flex items-center gap-1"><svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> Expert Tips</span>
                    <span className="flex items-center gap-1"><svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> Fast Download</span>
                </div>
            </div>

            {/* Right Visual: Realistic 3D Resume Document */}
            <div className="flex-1 relative w-full flex justify-center perspective-[2000px]">
                {/* Decoration Blobs */}
                <div className="absolute top-10 right-10 w-64 h-64 bg-blue-200 rounded-full blur-3xl opacity-30 animate-pulse"></div>
                <div className="absolute -bottom-10 left-10 w-64 h-64 bg-purple-200 rounded-full blur-3xl opacity-30"></div>

                {/* The Resume Paper */}
                <div className="relative w-[380px] h-[540px] bg-white rounded shadow-2xl border border-slate-100 transform rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-y-[0deg] hover:rotate-x-[0deg] transition-transform duration-700 ease-out flex overflow-hidden select-none z-20">
                    
                    {/* Sidebar (Dark) */}
                    <div className="w-[35%] bg-slate-900 text-white p-4 flex flex-col gap-4">
                        {/* Photo */}
                        <div className="w-20 h-20 mx-auto rounded-full border-2 border-slate-600 overflow-hidden bg-slate-800">
                           <img src="pic.png" alt="Profile" className="w-full h-full object-cover opacity-90" />
                        </div>

                        {/* Contact */}
                        <div className="mt-2">
                           <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Contact</div>
                           <div className="text-[9px] space-y-1.5 font-light text-slate-300">
                              <div className="break-all font-medium text-white">user@example.com</div>
                              <div>+1 614-588-7414</div>
                              <div className="leading-tight opacity-80">123 Test street, New York, NY 10004, United States</div>
                           </div>
                        </div>

                        {/* Education */}
                        <div>
                           <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Education</div>
                           <div className="text-[9px] space-y-2">
                              <div>
                                 <div className="font-bold text-white">BS Computer Science</div>
                                 <div className="text-slate-400 text-[8px]">University of Tech</div>
                                 <div className="text-slate-500 italic text-[8px]">2016 - 2020</div>
                              </div>
                           </div>
                        </div>

                        {/* Skills */}
                        <div className="flex-1">
                           <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Skills</div>
                           <div className="text-[9px] space-y-2 text-slate-300">
                              <div>
                                 <div className="text-[8px] font-semibold text-[#1a91f0] mb-0.5">Technical Skills</div>
                                 <div className="leading-tight opacity-80">React, TypeScript, Node.js, Python</div>
                              </div>
                              <div>
                                 <div className="text-[8px] font-semibold text-[#1a91f0] mb-0.5">Languages</div>
                                 <div className="leading-tight opacity-80">English (Native), Spanish (B2)</div>
                              </div>
                           </div>
                        </div>
                    </div>

                    {/* Main Content (White) */}
                    <div className="flex-1 p-5 bg-white flex flex-col">
                        <header className="border-b border-slate-100 pb-4 mb-4">
                           <h1 className="text-2xl font-extrabold text-slate-900 uppercase tracking-tight leading-none mb-1">X MARS</h1>
                           <h2 className="text-sm font-bold text-[#1a91f0]">Chief Technical Officer</h2>
                        </header>

                        <div className="space-y-4 flex-1">
                           {/* Summary */}
                           <div>
                              <p className="text-[9px] text-slate-600 leading-relaxed text-justify">
                                 Experienced professional with a proven track record of success in delivering high-quality results. Skilled in adapting to new challenges and utilizing industry best practices to drive efficiency and growth.
                              </p>
                           </div>

                           {/* Experience */}
                           <div>
                              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                                 <span className="w-1.5 h-1.5 bg-[#1a91f0] rounded-full"></span> Experience
                              </h3>
                              
                              <div className="mb-3">
                                 <div className="flex justify-between items-baseline mb-0.5">
                                    <h4 className="text-sm font-bold text-slate-900">CTO</h4>
                                    <span className="text-[8px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">2020 - Present</span>
                                 </div>
                                 <div className="text-[#1a91f0] font-semibold text-[10px] mb-1">Tech Corp</div>
                                 <p className="text-[9px] text-slate-600 leading-relaxed">
                                    Experienced professional with a proven track record of success in delivering high-quality results. Skilled in adapting to new challenges.
                                 </p>
                              </div>
                              
                              <div>
                                 <div className="flex justify-between items-baseline mb-0.5">
                                    <h4 className="text-sm font-bold text-slate-900">Senior Dev</h4>
                                    <span className="text-[8px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">2018 - 2020</span>
                                 </div>
                                 <div className="text-[#1a91f0] font-semibold text-[10px] mb-1">Startup Inc</div>
                                 <p className="text-[9px] text-slate-600 leading-relaxed">
                                    Led development team in creating scalable web applications. Improved system performance by 40%.
                                 </p>
                              </div>
                           </div>
                        </div>
                    </div>

                </div>
            </div>
         </div>
      </header>

      {/* --- Templates Section --- */}
      <section id="templates" className="py-20 bg-white">
         <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Professional Resume Templates</h2>
            <p className="text-slate-500 mb-12 max-w-2xl mx-auto">Select a template to get started. You can always change it later.</p>
            <TemplateSelector onSelect={handleTemplateSelect} />
         </div>
      </section>

      {/* --- How It Works --- */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
         <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-16">Build your resume in 3 steps</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
               {/* Step 1 */}
               <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-white rounded-full shadow-md flex items-center justify-center mb-6 text-[#1a91f0]">
                     <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">1. Pick a Template</h3>
                  <p className="text-slate-500 leading-relaxed">Choose from our gallery of professional, ATS-friendly templates designed by career experts.</p>
               </div>

               {/* Step 2 */}
               <div className="flex flex-col items-center">
                   <div className="w-20 h-20 bg-white rounded-full shadow-md flex items-center justify-center mb-6 text-[#1a91f0]">
                     <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">2. Customize</h3>
                  <p className="text-slate-500 leading-relaxed">Fill in your details. Our AI writer will help you find the right words to describe your experience.</p>
               </div>

               {/* Step 3 */}
               <div className="flex flex-col items-center">
                   <div className="w-20 h-20 bg-white rounded-full shadow-md flex items-center justify-center mb-6 text-[#1a91f0]">
                     <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">3. Download</h3>
                  <p className="text-slate-500 leading-relaxed">Download your polished resume in PDF or TXT format and start applying to jobs immediately.</p>
               </div>
            </div>
         </div>
      </section>

      {/* --- Pricing Section --- */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Transparent & Affordable Pricing</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              We believe in democratizing career success. Choose the plan that fits your needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
             
             {/* FREE PLAN */}
             <div className="border border-slate-200 rounded-2xl p-8 hover:border-[#1a91f0]/50 hover:shadow-xl transition-all duration-300 relative">
                <h3 className="text-xl font-bold text-slate-800 mb-2">{PLAN_DETAILS[SubscriptionPlan.FREE].name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                   <span className="text-4xl font-extrabold text-slate-900">{PLAN_DETAILS[SubscriptionPlan.FREE].price}</span>
                </div>
                <p className="text-slate-500 text-sm mb-6 pb-6 border-b border-slate-100">
                  Perfect for getting started with your first resume.
                </p>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-sm text-slate-700">
                     <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                     10 Resumes / Day
                  </li>
                   <li className="flex items-center gap-3 text-sm text-slate-700">
                     <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                     ATS-Friendly Templates
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-400">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                     Includes Ads
                  </li>
                </ul>
                <button 
                  onClick={() => handlePlanSelected(SubscriptionPlan.FREE)}
                  className="w-full py-3 rounded-lg border-2 border-slate-200 text-slate-700 font-bold hover:border-slate-800 hover:text-slate-900 transition-colors"
                >
                  Get Started Free
                </button>
             </div>

             {/* MONTHLY PLAN */}
             <div className="border-2 border-[#1a91f0] rounded-2xl p-8 shadow-2xl relative transform md:-translate-y-4 bg-white">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a91f0] text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide">Most Popular</div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{PLAN_DETAILS[SubscriptionPlan.MONTHLY].name}</h3>
                 <div className="flex items-baseline gap-1 mb-6">
                   <span className="text-4xl font-extrabold text-[#1a91f0]">$1.00</span>
                   <span className="text-slate-500 font-medium">/ month</span>
                </div>
                <p className="text-slate-500 text-sm mb-6 pb-6 border-b border-slate-100">
                  Full access to all features for less than a cup of coffee.
                </p>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-sm text-slate-700">
                     <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                     <strong>Unlimited</strong> Resumes
                  </li>
                   <li className="flex items-center gap-3 text-sm text-slate-700">
                     <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                     No Ads
                  </li>
                   <li className="flex items-center gap-3 text-sm text-slate-700">
                     <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                     Advanced AI Tailoring
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-700">
                     <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                     Premium Templates
                  </li>
                </ul>
                <button
                  disabled
                  className="w-full py-3 rounded-lg bg-slate-200 text-slate-500 font-bold cursor-not-allowed"
                  title="Coming soon"
                >
                  Coming soon
                </button>
             </div>

             {/* YEARLY PLAN */}
             <div className="border border-slate-200 rounded-2xl p-8 hover:border-purple-400 hover:shadow-xl transition-all duration-300 relative bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-800 mb-2">{PLAN_DETAILS[SubscriptionPlan.YEARLY].name}</h3>
                 <div className="flex items-baseline gap-1 mb-6">
                   <span className="text-4xl font-extrabold text-purple-600">$9.00</span>
                   <span className="text-slate-500 font-medium">/ year</span>
                </div>
                <p className="text-slate-500 text-sm mb-6 pb-6 border-b border-slate-200">
                  Best value for long-term career growth and maintenance.
                </p>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-sm text-slate-700">
                     <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                     All Pro Features
                  </li>
                   <li className="flex items-center gap-3 text-sm text-slate-700">
                     <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                     Priority Support
                  </li>
                   <li className="flex items-center gap-3 text-sm text-slate-700">
                     <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                     Save 25% vs Monthly
                  </li>
                </ul>
                <button
                   disabled
                   className="w-full py-3 rounded-lg border-2 border-slate-300 text-slate-500 bg-slate-100 font-bold cursor-not-allowed"
                   title="Coming soon"
                >
                  Coming soon
                </button>
             </div>

          </div>
        </div>
      </section>

      {/* --- About Us Section --- */}
      <section id="about" className="py-24 bg-slate-900 text-white relative overflow-hidden">
         {/* Background Decoration */}
         <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
         <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

         <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <span className="text-[#1a91f0] font-bold tracking-widest uppercase text-sm mb-4 block">Our Mission</span>
            <h2 className="text-3xl md:text-5xl font-bold mb-8">Democratizing Career Success</h2>
            <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mb-10 rounded-full"></div>
            
            <p className="text-xl text-slate-300 leading-relaxed mb-12">
               We are technical experts aiming to promote the easy use of technology for affordable cost to no cost. 
               We believe that high-quality career tools—like AI-powered resume building and optimization—should be accessible to everyone, 
               regardless of their budget.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
               <div className="p-6 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                  <div className="text-3xl font-bold text-white mb-2">Technical</div>
                  <div className="text-sm text-slate-400">Expertise in AI & Engineering</div>
               </div>
               <div className="p-6 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                  <div className="text-3xl font-bold text-white mb-2">Accessible</div>
                  <div className="text-sm text-slate-400">Easy-to-use Interface</div>
               </div>
               <div className="p-6 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                  <div className="text-3xl font-bold text-white mb-2">Affordable</div>
                  <div className="text-sm text-slate-400">Premium tools, minimal cost</div>
               </div>
            </div>
         </div>
      </section>

        </>
      )}


        {/* --- Auth Modals --- */}
        {activeModal !== 'none' && (
          activeModal === 'contact' ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveModal('none')}></div>
               <div className="relative z-10 w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                 <button onClick={() => setActiveModal('none')} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
                 <ContactPage user={{ name: '', email: '', id: '', role: 'user' } as any} />
               </div>
            </div>
          ) : (
            <AuthModal
              mode={activeModal === 'login' ? 'login' : 'signup'}
              selectedPlan={selectedPlan}
              onClose={() => setActiveModal('none')}
              onSwitchMode={(mode) => {
                if (mode === 'signup') {
                  setSelectedPlan(SubscriptionPlan.FREE);
                  setSelectedTemplateId(undefined);
                }
                setActiveModal(mode);
              }}
              onAuthSuccess={handleAuthSuccess}
            />
          )
        )}

      {/* --- Footer --- */}
      <footer className="bg-[#2e3d50] text-slate-300 py-16">
          <div className="max-w-6xl mx-auto px-6">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                <div>
                   <h4 className="font-bold text-white mb-4">MyResume</h4>
                   <ul className="space-y-2 text-sm">
                      <li><a href="#" className="hover:text-white">Homepage</a></li>
                      <li><a href="#templates" className="hover:text-white">Resume Templates</a></li>
                      <li><a href="#" className="hover:text-white">Cover Letters</a></li>
                   </ul>
                </div>
                <div>
                   <h4 className="font-bold text-white mb-4">Learn</h4>
                   <ul className="space-y-2 text-sm">
                      <li><button onClick={() => setPublicPage('career_blog')} className="hover:text-white">Career Blog</button></li>
                      <li><button onClick={() => setPublicPage('resume_guide')} className="hover:text-white">How to write a resume</button></li>
                      <li><button onClick={() => setPublicPage('resume_examples')} className="hover:text-white">Resume Examples</button></li>
                   </ul>
                </div>
                <div>
                   <h4 className="font-bold text-white mb-4">Company</h4>
                   <ul className="space-y-2 text-sm">
                      <li><a href="#about" className="hover:text-white">About Us</a></li>
                   </ul>
                </div>
                <div>
                   <h4 className="font-bold text-white mb-4">Support</h4>
                   <ul className="space-y-2 text-sm">
                      <li>
                        <button onClick={() => setActiveModal('contact')} className="hover:text-white">Contact Us</button>
                      </li>
                   </ul>
                </div>
             </div>

             <div className="border-t border-slate-700 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
                <div>
                   2026, MyResume. All rights reserved
                </div>
                <div className="flex gap-6">
                   <button onClick={() => setPublicPage('cookies_privacy')} className="hover:text-white">Privacy policy</button>
                   <button onClick={() => setPublicPage('cookies_terms')} className="hover:text-white">Terms of use</button>
                   <button onClick={() => setPublicPage('cookies')} className="hover:text-white">Cookies</button>
                </div>
             </div>
          </div>
      </footer>

      {/* --- MODALS --- */}
      {activeModal === 'pricing' && (
        <PricingModal 
          onClose={() => setActiveModal('none')}
          onSelectPlan={handlePlanSelected}
        />
      )}

      {(activeModal === 'login' || activeModal === 'signup') && (
        <AuthModal 
           mode={activeModal}
           selectedPlan={selectedPlan}
           onClose={() => setActiveModal('none')} 
           onSwitchMode={(m) => setActiveModal(m)}
           onAuthSuccess={handleAuthSuccess} 
        />
      )}
    </div>
  );
};

// --- Pricing Modal Component ---
interface PricingModalProps {
  onClose: () => void;
  onSelectPlan: (plan: SubscriptionPlan) => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ onClose, onSelectPlan }) => {
  // Pro plans are disabled (coming soon). Default to FREE.
  const [selected, setSelected] = useState<SubscriptionPlan>(SubscriptionPlan.FREE);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden animate-fade-in-up">
        
        <div className="p-8 text-center border-b border-slate-100">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Choose your plan</h2>
          <p className="text-slate-500">Select the best option to kickstart your career.</p>
          <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* Free Plan */}
             <div 
               onClick={() => setSelected(SubscriptionPlan.FREE)}
               className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all bg-white ${selected === SubscriptionPlan.FREE ? 'border-slate-500 shadow-lg ring-1 ring-slate-500' : 'border-slate-200 hover:border-slate-300'}`}
             >
                <h3 className="text-xl font-bold text-slate-800 mb-2">{PLAN_DETAILS[SubscriptionPlan.FREE].name}</h3>
                <div className="text-3xl font-extrabold text-slate-900 mb-1">{PLAN_DETAILS[SubscriptionPlan.FREE].price}</div>
                <p className="text-sm text-slate-500 mb-6">{PLAN_DETAILS[SubscriptionPlan.FREE].desc}</p>
                <ul className="space-y-3 text-sm text-slate-600 mb-8">
                   <li className="flex items-center gap-2">
                     <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     10 Resumes / day
                   </li>
                   <li className="flex items-center gap-2 text-slate-400">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     Contains Ads
                   </li>
                </ul>
                <div className={`w-6 h-6 rounded-full border-2 absolute top-6 right-6 flex items-center justify-center ${selected === SubscriptionPlan.FREE ? 'border-slate-600 bg-slate-600' : 'border-slate-300'}`}>
                    {selected === SubscriptionPlan.FREE && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                </div>
             </div>

             {/* Monthly Plan (Coming soon) */}
             <div
               className="relative p-6 rounded-xl border-2 transition-all bg-white opacity-60 cursor-not-allowed border-slate-200"
               title="Coming soon"
             >
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#1a91f0] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Most Popular</div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{PLAN_DETAILS[SubscriptionPlan.MONTHLY].name}</h3>
                <div className="text-3xl font-extrabold text-[#1a91f0] mb-1">$1.00 <span className="text-sm font-medium text-slate-400">/ mo</span></div>
                <p className="text-sm text-slate-500 mb-6">{PLAN_DETAILS[SubscriptionPlan.MONTHLY].desc}</p>
                <ul className="space-y-3 text-sm text-slate-600 mb-8">
                   <li className="flex items-center gap-2">
                     <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     Unlimited Resumes
                   </li>
                   <li className="flex items-center gap-2">
                     <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     No Ads
                   </li>
                   <li className="flex items-center gap-2">
                     <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     AI Tailoring
                   </li>
                </ul>
                <div className={`w-6 h-6 rounded-full border-2 absolute top-6 right-6 flex items-center justify-center ${selected === SubscriptionPlan.MONTHLY ? 'border-[#1a91f0] bg-[#1a91f0]' : 'border-slate-300'}`}>
                    {selected === SubscriptionPlan.MONTHLY && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                </div>
             </div>

             {/* Yearly Plan (Coming soon) */}
             <div
               className="relative p-6 rounded-xl border-2 transition-all bg-white opacity-60 cursor-not-allowed border-slate-200"
               title="Coming soon"
             >
                <h3 className="text-xl font-bold text-slate-800 mb-2">{PLAN_DETAILS[SubscriptionPlan.YEARLY].name}</h3>
                <div className="text-3xl font-extrabold text-purple-600 mb-1">$9.00 <span className="text-sm font-medium text-slate-400">/ yr</span></div>
                <p className="text-sm text-slate-500 mb-6">{PLAN_DETAILS[SubscriptionPlan.YEARLY].desc}</p>
                <ul className="space-y-3 text-sm text-slate-600 mb-8">
                   <li className="flex items-center gap-2">
                     <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     All Pro Features
                   </li>
                   <li className="flex items-center gap-2">
                     <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     Priority Support
                   </li>
                </ul>
                 <div className={`w-6 h-6 rounded-full border-2 absolute top-6 right-6 flex items-center justify-center ${selected === SubscriptionPlan.YEARLY ? 'border-purple-500 bg-purple-500' : 'border-slate-300'}`}>
                    {selected === SubscriptionPlan.YEARLY && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                </div>
             </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-100 flex justify-end">
             <button 
               onClick={() => onSelectPlan(SubscriptionPlan.FREE)}
               className="bg-[#1a91f0] hover:bg-[#1170cd] text-white text-lg font-bold px-12 py-3 rounded-full shadow-md transition-transform transform hover:-translate-y-0.5"
             >
               Continue
             </button>
        </div>
      </div>
    </div>
  );
};


// --- Internal Auth Form Component ---
interface AuthModalProps {
  mode: 'login' | 'signup';
  selectedPlan: SubscriptionPlan;
  onClose: () => void;
  onSwitchMode: (mode: 'login' | 'signup') => void;
  onAuthSuccess: (user: User, kind: 'login' | 'signup') => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ mode, selectedPlan, onClose, onSwitchMode, onAuthSuccess }) => {
  const isLogin = mode === 'login';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let user;
      if (isLogin) {
        user = await authService.login(formData.email, formData.password);
      } else {
        user = await authService.signup(formData.name, formData.email, formData.password, selectedPlan);
      }
      onAuthSuccess(user, isLogin ? 'login' : 'signup');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // SSO/OAuth intentionally disabled in this build.

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
           <div>
              <h2 className="text-xl font-bold text-slate-800">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h2>
              {!isLogin && (
                 <p className="text-xs text-slate-500 mt-1">
                   Plan: <span className="font-semibold text-[#1a91f0]">{PLAN_DETAILS[selectedPlan].name}</span> ({PLAN_DETAILS[selectedPlan].price})
                 </p>
              )}
           </div>
           <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>

        <div className="p-8">
           {/* SSO intentionally disabled */}
           <div className="bg-slate-50 border border-slate-200 text-slate-700 p-3 rounded mb-6 text-sm">
             Single Sign-On (Google/Microsoft/GitHub/LinkedIn) is disabled in this build. Please continue with email.
           </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded mb-6 text-sm flex items-center gap-2">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded focus:border-[#1a91f0] focus:ring-1 focus:ring-[#1a91f0] outline-none"
                  placeholder="e.g. Jane Doe"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded focus:border-[#1a91f0] focus:ring-1 focus:ring-[#1a91f0] outline-none"
                placeholder="name@example.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded focus:border-[#1a91f0] focus:ring-1 focus:ring-[#1a91f0] outline-none"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded text-white font-bold shadow transition-all ${
                loading ? 'bg-blue-300' : 'bg-[#1a91f0] hover:bg-[#1170cd]'
              }`}
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Complete Registration')}
            </button>
          </form>

          <div className="text-center mt-6 text-sm text-slate-500">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                setError(null);
                onSwitchMode(isLogin ? 'signup' : 'login');
              }}
              className="text-[#1a91f0] font-semibold hover:underline"
            >
              {isLogin ? "Sign up" : "Log in"}
            </button>
          </div>
          
           <div className="mt-6 pt-6 border-t border-slate-100 text-center">
             <p className="text-xs text-slate-400">Demo Credentials: user@example.com / password</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;