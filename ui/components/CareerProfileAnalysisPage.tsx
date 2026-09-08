import React, { useEffect, useMemo, useState } from 'react';
import {
  generateCareerProfileAnalysis,
  getCareerProfileAnalysis,
  type CareerProfileAnalysis,
  type CareerProfileAnalysisReport,
} from '../services/onboardingService';

type AnalysisTab = 'profile' | 'resume' | 'needs' | 'jobs';

const tabs: Array<{ key: AnalysisTab; label: string }> = [
  { key: 'profile', label: 'User profile category' },
  { key: 'resume', label: 'Resume' },
  { key: 'needs', label: 'Things needed' },
  { key: 'jobs', label: 'Jobs to apply' },
];

const scoreColor = (score: number) => {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 65) return 'bg-blue-600';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-red-500';
};

const EmptyState: React.FC<{ onGenerate: () => void; isLoading: boolean }> = ({ onGenerate, isLoading }) => (
  <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
    <p className="text-sm font-bold uppercase text-blue-700">Profile analysis</p>
    <h2 className="mt-3 text-2xl font-black text-slate-950">Run Samanta analysis</h2>
    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
      Complete onboarding and save a resume first. Samanta will combine both sources and create your profile direction.
    </p>
    <button
      type="button"
      onClick={onGenerate}
      disabled={isLoading}
      className="mt-6 rounded bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {isLoading ? 'Analyzing profile' : 'Run analysis'}
    </button>
  </div>
);

const ScoreBar: React.FC<{ label: string; score: number }> = ({ label, score }) => (
  <div>
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="font-bold text-slate-700">{label}</span>
      <span className="font-black text-slate-950">{score}%</span>
    </div>
    <div className="mt-2 h-2 overflow-hidden rounded bg-slate-100">
      <div className={`h-full rounded ${scoreColor(score)}`} style={{ width: `${score}%` }} />
    </div>
  </div>
);

const ListBlock: React.FC<{ items: string[]; empty: string }> = ({ items, empty }) => (
  <ul className="space-y-2">
    {(items.length ? items : [empty]).map((item) => (
      <li key={item} className="border-l-2 border-blue-100 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
        {item}
      </li>
    ))}
  </ul>
);

const ProfileTab: React.FC<{ report: CareerProfileAnalysisReport }> = ({ report }) => (
  <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold uppercase text-blue-700">Profile category</p>
      <h2 className="mt-3 text-3xl font-black text-slate-950">{report.profileCategory.label}</h2>
      <p className="mt-2 text-sm font-bold text-slate-500">{report.profileCategory.level}</p>
      <p className="mt-5 text-base leading-7 text-slate-700">{report.profileCategory.summary}</p>
      <div className="mt-6">
        <ScoreBar label="Category confidence" score={report.profileCategory.confidence} />
      </div>
    </section>
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold uppercase text-blue-700">Evidence</p>
      <div className="mt-4">
        <ListBlock items={report.profileCategory.evidence} empty="More evidence will appear after your resume is stronger." />
      </div>
      <p className="mt-5 rounded bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
        {report.profileCategory.nextMilestone}
      </p>
    </section>
  </div>
);

const ResumeTab: React.FC<{ report: CareerProfileAnalysisReport }> = ({ report }) => (
  <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold uppercase text-blue-700">Resume category</p>
      <h2 className="mt-3 text-2xl font-black text-slate-950">{report.resume.category}</h2>
      <div className="mt-6 space-y-5">
        <ScoreBar label="Readiness" score={report.resume.readinessScore} />
        <ScoreBar label="Completeness" score={report.resume.completenessScore} />
        <ScoreBar label="Bullet quality" score={report.resume.bulletQualityScore} />
        <ScoreBar label="Skill coverage" score={report.resume.skillCoverageScore} />
      </div>
    </section>
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold uppercase text-blue-700">Resume work</p>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-base font-black text-slate-950">Strengths</h3>
          <div className="mt-3">
            <ListBlock items={report.resume.strengths} empty="No strong resume signals detected yet." />
          </div>
        </div>
        <div>
          <h3 className="text-base font-black text-slate-950">Improve next</h3>
          <div className="mt-3">
            <ListBlock items={report.resume.improvements} empty="No urgent resume improvements detected." />
          </div>
        </div>
      </div>
      {report.resume.visibleSkills.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {report.resume.visibleSkills.map((skill) => (
            <span key={skill} className="rounded bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">
              {skill}
            </span>
          ))}
        </div>
      )}
    </section>
  </div>
);

const NeedsTab: React.FC<{ report: CareerProfileAnalysisReport }> = ({ report }) => (
  <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
    <section>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase text-blue-700">Priority skills</p>
        <h2 className="mt-3 text-2xl font-black text-slate-950">{report.thingsNeeded.headline}</h2>
      </div>
      <div className="mt-5 space-y-3">
        {report.thingsNeeded.prioritySkills.map((item) => (
          <article key={item.skill} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-black text-slate-950">{item.skill}</h3>
              <span className="rounded bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{item.timeline}</span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{item.why}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.action}</p>
          </article>
        ))}
      </div>
    </section>
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold uppercase text-blue-700">Expert path</p>
      <div className="mt-4">
        <ListBlock items={report.thingsNeeded.expertPlan} empty="Samanta will add a plan after analysis." />
      </div>
      {report.thingsNeeded.supportNeed && (
        <p className="mt-5 rounded bg-blue-50 px-4 py-3 text-sm font-bold leading-6 text-blue-900">
          Focus requested: {report.thingsNeeded.supportNeed}
        </p>
      )}
    </section>
  </div>
);

const JobsTab: React.FC<{ report: CareerProfileAnalysisReport }> = ({ report }) => {
  const [agentNotice, setAgentNotice] = useState<string | null>(null);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
      <section>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase text-blue-700">Best job direction</p>
          <h2 className="mt-3 text-2xl font-black text-slate-950">{report.jobTargets.recommendedFamily}</h2>
        </div>
        <div className="mt-5 space-y-3">
          {report.jobTargets.recommendedTitles.map((job) => (
            <article key={job.title} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{job.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{job.why}</p>
                </div>
                <span className="rounded bg-blue-700 px-3 py-1 text-sm font-black text-white">{job.fitScore}% fit</span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{job.applicationAngle}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {job.keywords.map((keyword) => (
                  <span key={keyword} className="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {keyword}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase text-blue-700">Auto agent apply</p>
        <h2 className="mt-3 text-2xl font-black text-slate-950">
          {report.jobTargets.autoAgentApplyFeature.enabled ? 'Ready to configure' : 'Review before applying'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{report.jobTargets.autoAgentApplyFeature.details}</p>
        <div className="mt-5 rounded bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-950">Batch plan</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Apply to {report.jobTargets.searchStrategy.batchSize} matched roles, then review after {report.jobTargets.searchStrategy.reviewAfterApplications} applications.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAgentNotice('Samanta can prepare resume packets and tracker entries. Job-board submission needs a connected application source before it can run automatically.')}
          className="mt-5 w-full rounded bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
        >
          Prepare auto-apply agent
        </button>
        {agentNotice && (
          <p className="mt-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-900">
            {agentNotice}
          </p>
        )}
      </section>
    </div>
  );
};

const CareerProfileAnalysisPage: React.FC = () => {
  const [analysis, setAnalysis] = useState<CareerProfileAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const report = analysis?.analysis;
  const generatedAt = useMemo(() => {
    if (!report?.source.generatedAt) return '';
    return new Date(report.source.generatedAt).toLocaleString();
  }, [report?.source.generatedAt]);

  const loadAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setAnalysis(await getCareerProfileAnalysis());
    } catch (err: any) {
      setError(err?.message || 'Could not load your profile analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setAnalysis(await generateCareerProfileAnalysis());
      setActiveTab('profile');
    } catch (err: any) {
      setError(err?.message || 'Could not run your profile analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalysis();
  }, []);

  const renderTab = () => {
    if (!report) return null;
    if (activeTab === 'profile') return <ProfileTab report={report} />;
    if (activeTab === 'resume') return <ResumeTab report={report} />;
    if (activeTab === 'needs') return <NeedsTab report={report} />;
    return <JobsTab report={report} />;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f7f9fa] px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-lg bg-[#2e3d50] px-5 py-6 text-white shadow-lg shadow-slate-950/10 sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-blue-200">Samanta profile analysis</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                {analysis?.profileCategory || 'Your career profile'}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
                {analysis?.recommendedJobFamily || 'Resume category, skill needs, and job targets will appear here after analysis.'}
              </p>
            </div>
            <button
              type="button"
              onClick={regenerateAnalysis}
              disabled={isLoading}
              className="rounded border border-white/20 bg-white px-5 py-3 text-sm font-black text-[#2e3d50] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {isLoading ? 'Analyzing' : 'Refresh analysis'}
            </button>
          </div>
          {generatedAt && (
            <p className="mt-4 text-xs font-semibold text-slate-300">Generated {generatedAt}</p>
          )}
        </header>

        {error && (
          <p className="mt-5 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
            {error}
          </p>
        )}

        {isLoading && !analysis ? (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm" role="status">
            <p className="text-sm font-black text-slate-950">Loading profile analysis</p>
            <p className="mt-2 text-sm text-slate-500">Samanta is preparing your next page.</p>
          </div>
        ) : !report ? (
          <div className="mt-6">
            <EmptyState onGenerate={regenerateAnalysis} isLoading={isLoading} />
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={[
                    'rounded-t px-4 py-3 text-sm font-black transition',
                    activeTab === tab.key
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-slate-950',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="mt-5">{renderTab()}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default CareerProfileAnalysisPage;
