import React from 'react';

interface CareerBlogPageProps {
  onBack?: () => void;
}

const CareerBlogPage: React.FC<CareerBlogPageProps> = ({ onBack }) => {
  return (
    <div className="max-w-5xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Career Blog</h1>
          <p className="text-slate-500 mt-2">
            Practical steps, career paths, and role-by-role guidance to help you land your next job.
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

      {/* Steps */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-8 py-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">A simple 10-step job search system</h2>
          <p className="text-slate-500 mt-1 text-sm">Use this as a checklist. Iterate weekly.</p>
        </div>
        <div className="p-8">
          <ol className="space-y-5">
            {[
              { t: 'Pick a target role (and a backup role).', d: 'Don\'t apply to everything. Choose 1–2 titles and build your resume around them.' },
              { t: 'Collect 10–20 job descriptions.', d: 'Highlight repeated requirements, tools, and keywords.' },
              { t: 'Build a “skills + proof” inventory.', d: 'For each skill, add 1–3 proof bullets (projects, metrics, outcomes).' },
              { t: 'Create an ATS-friendly base resume.', d: 'Clean layout, standard headings, and consistent formatting. No tables for ATS versions.' },
              { t: 'Tailor in 10 minutes per job.', d: 'Rewrite 3–5 bullets using the job\'s exact language (without lying).' },
              { t: 'Write a short cover letter (optional, but powerful).', d: 'Use 3 paragraphs: why them, why you, and a closing call-to-action.' },
              { t: 'Apply in focused batches.', d: '10–15 high-quality applications > 100 low-quality applications.' },
              { t: 'Network with a purpose.', d: 'Message hiring managers/recruiters with a specific ask and a clear 1–2 sentence value statement.' },
              { t: 'Track everything.', d: 'Spreadsheet: company, role, date, status, contact, next step.' },
              { t: 'Improve weekly.', d: 'After 20–30 applications, adjust resume keywords, titles, and the top summary based on results.' },
            ].map((s, idx) => (
              <li key={idx} className="flex gap-4">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-50 text-[#1a91f0] font-bold flex items-center justify-center">
                  {idx + 1}
                </div>
                <div>
                  <div className="font-semibold text-slate-800">{s.t}</div>
                  <div className="text-sm text-slate-600 mt-1">{s.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Career paths */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-800 mb-2">Tech & Data</h3>
          <p className="text-sm text-slate-600 mb-4">Software, data, cloud, security, and product.</p>
          <ul className="text-sm text-slate-700 space-y-2">
            <li><span className="font-semibold">Profiles:</span> SWE, Frontend, Backend, DevOps, Data Analyst, Data Engineer, PM</li>
            <li><span className="font-semibold">Best resume style:</span> Modern Tech or Compact Grid</li>
            <li><span className="font-semibold">Proof that wins:</span> impact metrics, shipped features, reliability improvements, measurable results</li>
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-800 mb-2">Business</h3>
          <p className="text-sm text-slate-600 mb-4">Operations, sales, finance, and leadership roles.</p>
          <ul className="text-sm text-slate-700 space-y-2">
            <li><span className="font-semibold">Profiles:</span> Sales, Customer Success, Operations, Finance Analyst, Project Manager</li>
            <li><span className="font-semibold">Best resume style:</span> Classic Professional or Executive Lead</li>
            <li><span className="font-semibold">Proof that wins:</span> revenue, savings, pipeline, process improvements, leadership scope</li>
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-800 mb-2">Creative</h3>
          <p className="text-sm text-slate-600 mb-4">Marketing, design, content, media, and brand.</p>
          <ul className="text-sm text-slate-700 space-y-2">
            <li><span className="font-semibold">Profiles:</span> Designer, Marketing Specialist, Content Creator, Copywriter, Brand Manager</li>
            <li><span className="font-semibold">Best resume style:</span> Creative Bold or Minimalist Clean</li>
            <li><span className="font-semibold">Proof that wins:</span> campaigns, growth metrics, portfolio links, creative outcomes</li>
          </ul>
        </div>
      </div>

      {/* Closing */}
      <div className="mt-10 bg-slate-50 border border-slate-200 rounded-xl p-6">
        <div className="font-bold text-slate-800">Quick tip</div>
        <p className="text-sm text-slate-600 mt-1">
          If you\'re not getting interviews, your resume is the bottleneck. If you\'re getting interviews but not offers, your interview stories are.
          Fix the bottleneck first.
        </p>
      </div>
    </div>
  );
};

export default CareerBlogPage;
