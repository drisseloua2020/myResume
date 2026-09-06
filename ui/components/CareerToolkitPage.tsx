import React, { useEffect, useMemo, useState } from 'react';
import type { UserInputData } from '../types';
import { getLatestResume } from '../services/resumeService';
import {
  analyzeCareer,
  CareerAchievement,
  CareerAnalysisReport,
  CareerJob,
  createAchievement,
  createCareerJob,
  createResumeVersion,
  exportCareerData,
  exportResumeFormats,
  getCareerAnalytics,
  getCareerFeatures,
  importLinkedInProfile,
  listAchievements,
  listCareerJobs,
  listResumeVersions,
  updateCareerJob,
} from '../services/careerService';

const statusColumns: Array<{ key: CareerJob['status']; label: string }> = [
  { key: 'saved', label: 'Saved' },
  { key: 'applied', label: 'Applied' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: 'Rejected' },
];

const sampleJob = `Platform Engineer
Company: Example Systems
Location: Remote
Salary: $135,000 - $165,000
Responsibilities
- Build internal developer platforms and APIs for cloud teams.
- Design Kubernetes automation and improve reliability.
Requirements
- Experience with AWS, Terraform, Python, security, and stakeholder communication.
- Preferred AWS Certified background.`;

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-8 border-slate-100 bg-white shadow-inner">
      <div className={`text-3xl font-black ${color}`}>{score}</div>
    </div>
  );
}

function Pill({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'red' | 'blue' }) {
  const classes = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{children}</span>;
}

function downloadBase64(name: string, mimeType: string, data: string) {
  const link = document.createElement('a');
  link.href = `data:${mimeType};base64,${data}`;
  link.download = name;
  link.click();
}

export default function CareerToolkitPage({ currentResume }: { currentResume?: UserInputData | null }) {
  const [resume, setResume] = useState<UserInputData | Record<string, unknown>>(currentResume || {});
  const [resumeTitle, setResumeTitle] = useState('Latest resume');
  const [jobDescription, setJobDescription] = useState(sampleJob);
  const [jobUrl, setJobUrl] = useState('');
  const [report, setReport] = useState<CareerAnalysisReport | null>(null);
  const [jobs, setJobs] = useState<CareerJob[]>([]);
  const [achievements, setAchievements] = useState<CareerAchievement[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, any>>({});
  const [features, setFeatures] = useState<Array<{ group: string; name: string; operation: string; llmCalls: boolean }>>([]);
  const [linkedinText, setLinkedinText] = useState('');
  const [achievementText, setAchievementText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshRecords() {
    const [jobRes, achievementRes, versionRes, analyticsRes, featureRes] = await Promise.all([
      listCareerJobs(),
      listAchievements(),
      listResumeVersions(),
      getCareerAnalytics(),
      getCareerFeatures(),
    ]);
    setJobs(jobRes.jobs);
    setAchievements(achievementRes.achievements);
    setVersions(versionRes.versions);
    setAnalytics(analyticsRes.analytics);
    setFeatures(featureRes.features);
  }

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const latest = await getLatestResume();
        if (!alive) return;
        if (latest) {
          setResume(latest.content as any);
          setResumeTitle(latest.title);
        }
        await refreshRecords();
      } catch (error: any) {
        if (alive) setMessage(error?.message || 'Career toolkit could not load.');
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  async function runAnalysis() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await analyzeCareer({ resumeJson: resume, jobDescription, jobUrl, targetCountry: 'US', targetLanguage: 'en' });
      setReport(res.report);
      setMessage('Deterministic analysis completed without LLM calls.');
    } catch (error: any) {
      setMessage(error?.message || 'Analysis failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveJob(status: CareerJob['status'] = 'saved') {
    setBusy(true);
    try {
      await createCareerJob({ status, jobDescription, jobUrl, title: report?.job.title, company: report?.job.company || undefined, location: report?.job.location || undefined, salary: report?.job.salary || undefined });
      await refreshRecords();
      setMessage('Job saved to tracker.');
    } catch (error: any) {
      setMessage(error?.message || 'Could not save job.');
    } finally {
      setBusy(false);
    }
  }

  async function saveAchievement() {
    if (!achievementText.trim()) return;
    setBusy(true);
    try {
      await createAchievement({ title: achievementText.split('\n')[0].slice(0, 120), category: 'Resume Bullet', content: achievementText });
      setAchievementText('');
      await refreshRecords();
    } catch (error: any) {
      setMessage(error?.message || 'Could not save achievement.');
    } finally {
      setBusy(false);
    }
  }

  async function saveVersion(kind: string) {
    setBusy(true);
    try {
      await createResumeVersion({ kind, title: `${resumeTitle} - ${kind}`, content: resume, changeSummary: `Saved from Career Toolkit as ${kind}.` });
      await refreshRecords();
      setMessage('Resume version saved.');
    } catch (error: any) {
      setMessage(error?.message || 'Could not save version.');
    } finally {
      setBusy(false);
    }
  }

  async function exportFormats(redactPii = false) {
    setBusy(true);
    try {
      const res = await exportResumeFormats({ resumeJson: resume, title: resumeTitle, publicProfileUrl: '', redactPii });
      downloadBase64(`${resumeTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'resume'}.txt`, 'text/plain', res.exports.txtBase64);
      setMessage(`Export ready. PDF selectable text: ${res.exports.pdfValidation.selectableText ? 'yes' : 'no'}.`);
    } catch (error: any) {
      setMessage(error?.message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  async function importLinkedIn() {
    if (!linkedinText.trim()) return;
    setBusy(true);
    try {
      const res = await importLinkedInProfile(linkedinText);
      setResume(res.resume);
      setResumeTitle('LinkedIn imported resume');
      setMessage('LinkedIn text imported into the editor-ready resume shape.');
    } catch (error: any) {
      setMessage(error?.message || 'LinkedIn import failed.');
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    const data = await exportCareerData();
    const text = JSON.stringify(data, null, 2);
    downloadBase64('myresumes-career-data.json', 'application/json', btoa(unescape(encodeURIComponent(text))));
  }

  const groupedFeatures = useMemo(() => {
    return features.reduce<Record<string, typeof features>>((groups, feature) => {
      groups[feature.group] = [...(groups[feature.group] || []), feature];
      return groups;
    }, {});
  }, [features]);

  return (
    <div className="mx-auto max-w-[94rem] px-4 py-8 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">No LLM calls</div>
          <h2 className="mt-3 text-3xl font-black text-slate-900">Career Toolkit</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">ATS scoring, deterministic job parsing, application tracking, saved achievements, exports, and privacy controls powered by local rules.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => saveVersion('base')} className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save Base Version</button>
          <button disabled={busy} onClick={() => saveVersion('tailored')} className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save Tailored Version</button>
          <button disabled={busy} onClick={exportData} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Export Data</button>
        </div>
      </div>

      {message && <div className="mb-5 rounded border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.75fr)_minmax(620px,1.25fr)]">
        <section className="space-y-4">
          <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Analyze Against Job</h3>
            <input value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="Job URL" className="mt-4 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} className="mt-3 h-72 w-full rounded border border-slate-300 p-3 text-sm leading-relaxed" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={runAnalysis} className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Run ATS Analysis</button>
              <button disabled={busy} onClick={() => saveJob('saved')} className="rounded border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Save Job</button>
              <button disabled={busy} onClick={() => exportFormats(false)} className="rounded border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Export TXT</button>
              <button disabled={busy} onClick={() => exportFormats(true)} className="rounded border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Redacted Export</button>
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">LinkedIn Import</h3>
            <textarea value={linkedinText} onChange={(e) => setLinkedinText(e.target.value)} placeholder="Paste LinkedIn profile text..." className="mt-4 h-32 w-full rounded border border-slate-300 p-3 text-sm" />
            <button disabled={busy || !linkedinText.trim()} onClick={importLinkedIn} className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Import Profile Text</button>
          </div>

          <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Achievement Library</h3>
            <textarea value={achievementText} onChange={(e) => setAchievementText(e.target.value)} placeholder="Paste a strong bullet or accomplishment..." className="mt-4 h-24 w-full rounded border border-slate-300 p-3 text-sm" />
            <button disabled={busy || !achievementText.trim()} onClick={saveAchievement} className="mt-3 rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save Achievement</button>
            <div className="mt-4 space-y-3">
              {achievements.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded bg-slate-50 p-3 text-sm">
                  <div className="font-bold text-slate-900">{item.title}</div>
                  <div className="mt-1 text-slate-600">{item.content}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {report ? (
            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <ScoreRing score={report.atsScore} />
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{report.job.title}</h3>
                  <div className="mt-1 text-sm text-slate-600">{[report.job.company, report.job.location, report.job.salary].filter(Boolean).join(' | ') || 'Parsed job details'}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone="green">{report.privacyBadge}</Pill>
                    <Pill tone="blue">Completeness {report.completeness.score}</Pill>
                    <Pill>Risk score {report.riskScan.score}</Pill>
                    <Pill>Bullet score {report.bulletQuality.averageScore}</Pill>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wide text-slate-600">Missing Keywords</h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(report.missingKeywords.all || []).slice(0, 28).map((term) => <Pill key={term} tone="red">{term}</Pill>)}
                    {(report.missingKeywords.all || []).length === 0 && <Pill tone="green">No major gaps</Pill>}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wide text-slate-600">Included Keywords</h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.includedKeywords.slice(0, 28).map((term) => <Pill key={term} tone="green">{term}</Pill>)}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded bg-slate-50 p-4">
                  <h4 className="text-sm font-black uppercase tracking-wide text-slate-600">Section Match</h4>
                  <div className="mt-3 space-y-2">
                    {report.sectionMatches.map((item) => (
                      <div key={item.section}>
                        <div className="flex justify-between text-xs font-bold uppercase text-slate-500"><span>{item.section}</span><span>{item.score}</span></div>
                        <div className="mt-1 h-2 rounded bg-slate-200"><div className="h-2 rounded bg-blue-500" style={{ width: `${Math.min(100, item.score)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded bg-slate-50 p-4">
                  <h4 className="text-sm font-black uppercase tracking-wide text-slate-600">Ready To Apply</h4>
                  <div className="mt-3 space-y-2">
                    {report.readyToApplyChecklist.map((item) => (
                      <div key={item.label} className="flex items-center gap-2 text-sm">
                        <span className={item.passed ? 'text-emerald-600' : 'text-red-600'}>{item.passed ? 'OK' : '!'}</span>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded border border-slate-200 p-4">
                  <h4 className="text-sm font-black uppercase tracking-wide text-slate-600">Risk Scanner</h4>
                  <div className="mt-3 space-y-3">
                    {report.riskScan.risks.length === 0 ? <Pill tone="green">No major risks found</Pill> : report.riskScan.risks.map((risk) => (
                      <div key={`${risk.item}-${risk.fix}`} className="text-sm">
                        <div className="font-bold text-slate-900">{risk.item}</div>
                        <div className="text-slate-600">{risk.fix}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded border border-slate-200 p-4">
                  <h4 className="text-sm font-black uppercase tracking-wide text-slate-600">Reusable Scripts</h4>
                  <textarea readOnly value={report.templates.followUpEmail} className="mt-3 h-40 w-full rounded bg-slate-50 p-3 text-sm text-slate-700" />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
              Run an ATS analysis to see score, gaps, risks, checklists, and scripts.
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Job Tracker</h3>
                <span className="text-xs font-bold text-slate-500">{analytics.total || 0} jobs</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5 xl:grid-cols-1">
                {statusColumns.map((column) => (
                  <div key={column.key} className="rounded bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-black uppercase text-slate-500">{column.label}</div>
                    <div className="space-y-2">
                      {jobs.filter((job) => job.status === column.key).slice(0, 4).map((job) => (
                        <button key={job.id} onClick={() => updateCareerJob(job.id, { status: column.key === 'saved' ? 'applied' : column.key }).then(refreshRecords)} className="block w-full rounded bg-white p-3 text-left text-xs shadow-sm">
                          <div className="font-bold text-slate-900">{job.title}</div>
                          <div className="text-slate-500">{job.company || 'Company not set'}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Versions & Feature Coverage</h3>
              <div className="mt-4 space-y-3">
                {versions.slice(0, 4).map((version) => (
                  <div key={version.id} className="rounded bg-slate-50 p-3 text-sm">
                    <div className="font-bold text-slate-900">{version.title}</div>
                    <div className="text-xs text-slate-500">{version.kind} | {new Date(version.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {Object.entries(groupedFeatures).slice(0, 6).map(([group, items]) => (
                  <div key={group} className="rounded border border-slate-100 p-3">
                    <div className="text-xs font-black uppercase text-slate-500">{group}</div>
                    <div className="mt-1 text-2xl font-black text-slate-900">{items.length}</div>
                    <div className="text-xs text-emerald-700">No LLM calls</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
