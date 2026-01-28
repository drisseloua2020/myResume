import React from 'react';

interface ResumeGuidePageProps {
  onBack?: () => void;
}

const ResumeGuidePage: React.FC<ResumeGuidePageProps> = ({ onBack }) => {
  return (
    <div className="max-w-5xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">How to write a resume</h1>
          <p className="text-slate-500 mt-2">
            A detailed, ATS-friendly guide for building a resume that earns interviews.
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm font-semibold text-slate-600 hover:text-slate-800 underline"
          >
            Back
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-8 py-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Core structure</h2>
          <p className="text-slate-500 mt-1 text-sm">Use standard headings so ATS systems can parse your resume.</p>
        </div>
        <div className="p-8 space-y-8">
          <section>
            <h3 className="font-bold text-slate-800 mb-2">1) Header</h3>
            <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
              <li>Name, phone, email, city/state, LinkedIn, portfolio/GitHub.</li>
              <li>Avoid full address; city/state is enough for most roles.</li>
              <li>Use a professional email (first.last@...).</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-800 mb-2">2) Summary</h3>
            <p className="text-sm text-slate-700">
              2–4 lines that match your target role. Include your years of experience, domain, and 2–3 strengths.
            </p>
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
              <div className="font-semibold text-slate-800 mb-1">Example</div>
              <div className="text-slate-700">
                Software Engineer with 5+ years building React + Node products. Strong in performance optimization,
                API design, and shipping features end-to-end. Delivered 3 major releases and improved page load by 35%.
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-bold text-slate-800 mb-2">3) Experience</h3>
            <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
              <li><span className="font-semibold">Bullets should be impact-based:</span> Action + Scope + Result.</li>
              <li>Lead with outcomes: revenue, cost savings, speed, quality, conversion, reliability, time saved.</li>
              <li>Use numbers whenever possible (%, $, users, requests/sec, hours saved, size of team).</li>
              <li>Tailor the top 2 jobs to the target role; older roles can be shorter.</li>
            </ul>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="font-semibold text-slate-800 mb-2">Weak bullet</div>
                <div className="text-sm text-slate-600">Worked on improving the application performance.</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="font-semibold text-slate-800 mb-2">Strong bullet</div>
                <div className="text-sm text-slate-600">
                  Optimized React rendering and caching strategy, reducing LCP from 3.2s to 2.0s (−38%) and increasing conversion by 6%.
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-bold text-slate-800 mb-2">4) Skills</h3>
            <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
              <li>Keep it scannable: group into categories (Languages, Frameworks, Tools).</li>
              <li>Match keywords from the job description (only if you actually have the skill).</li>
              <li>Avoid rating bars (“80% Python”)—ATS systems don’t need them.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-800 mb-2">5) Education & Certifications</h3>
            <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
              <li>Include degree, school, graduation year (optional for experienced candidates).</li>
              <li>Certifications go here if relevant (AWS, PMP, Security+, etc.).</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-800 mb-2">ATS & formatting rules</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="font-semibold text-slate-800 mb-2">Do</div>
                <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
                  <li>Use standard headings: Experience, Education, Skills.</li>
                  <li>Use simple fonts and consistent spacing.</li>
                  <li>Export to PDF for humans; keep a DOCX if requested.</li>
                </ul>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="font-semibold text-slate-800 mb-2">Avoid</div>
                <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
                  <li>Tables for the ATS version.</li>
                  <li>Graphics-heavy layouts that hide text.</li>
                  <li>Long paragraphs (bullets are better).</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-10 bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-bold text-slate-800">Final checklist</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700">
          {[
            'Matches the target job title at the top',
            'Top 5 skills appear in summary/skills',
            'Experience bullets contain outcomes and numbers',
            'No typos, consistent tense, consistent dates',
            'One page (early career) or two pages (experienced)',
            'File name: First_Last_Resume.pdf',
          ].map((c) => (
            <div key={c} className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResumeGuidePage;
