import React, { useEffect, useState } from 'react';
import { api } from '../services/apiClient';
import { listResumes, ResumeListItem } from '../services/resumeService';
import { listCoverLetters } from '../services/coverLetterService';
import { CareerJob, createCareerJob, listCareerJobs, updateCareerJob } from '../services/careerService';

const statuses: CareerJob['status'][] = ['saved', 'applied', 'interview', 'offer', 'rejected'];
const field = 'w-full rounded border border-slate-300 bg-white p-2 text-sm';
const button = 'rounded border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40';

export default function JobsWorkbench({ mode, onNext }: { mode: 'jobs' | 'prepare' | 'review'; onNext?: () => void }) {
  const [jobs, setJobs] = useState<CareerJob[]>([]);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [letters, setLetters] = useState<Array<{ id: string; title: string }>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<CareerJob>>({ title: '', company: '', jobDescription: '', jobUrl: '', notes: '' });

  async function load() {
    const [records, resumeRecords, letterRecords] = await Promise.all([listCareerJobs(), listResumes(), listCoverLetters()]);
    setJobs(records.jobs); setResumes(resumeRecords); setLetters(letterRecords);
  }
  useEffect(() => {
    load().catch(error => setMessage(error.message)).finally(() => setLoading(false));
  }, []);
  function choose(job: CareerJob) { setSelected(job.id); setEdit(job); setMessage(''); }
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setMessage('');
    try { await action(); await load(); }
    catch (error: any) { setMessage(error.message || 'Action failed. Please retry.'); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = { title: edit.title, company: edit.company, jobDescription: edit.jobDescription,
      jobUrl: edit.jobUrl, notes: edit.notes, deadline: edit.deadline, location: edit.location,
      resumeId: edit.resumeId || null, coverLetterId: edit.coverLetterId || null, savedAnswers: edit.savedAnswers || [] };
    await run(async () => {
      const result = selected ? await updateCareerJob(selected, payload) : await createCareerJob(payload);
      setSelected(result.job.id); setEdit(result.job); setMessage('Saved');
    });
  }
  const current = jobs.find(job => job.id === selected);
  const visible = jobs.filter(job => (mode !== 'review' || job.packet?.id)
    && (status === 'all' || job.status === status)
    && `${job.title} ${job.company || ''}`.toLowerCase().includes(filter.toLowerCase()));
  const pending = jobs.filter(job => job.packet?.decision === 'pending').length;

  return <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{mode === 'jobs' ? 'Job Tracker' : mode === 'prepare' ? 'Prepare Packets' : 'Packet Review'}</h1>
      <div className="flex flex-wrap gap-3"><span>{jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}</span><span>{pending} pending reviews</span>
        {onNext && <button className={button} onClick={onNext}>{mode === 'jobs' ? 'Prepare packets' : 'Review queue'}</button>}</div>
    </div>
    <p className="text-sm text-slate-600">External submission is unavailable. Approved packets can be downloaded for manual application.</p>
    {message && <p role="status" className="border-l-4 border-amber-500 bg-amber-50 p-3">{message}</p>}
    <div className="grid gap-5 lg:grid-cols-[minmax(230px,1fr)_minmax(0,2fr)]">
      <section className="min-w-0 space-y-3" aria-label="Saved jobs">
        <input aria-label="Search jobs" className={field} placeholder="Search jobs" value={filter} onChange={e => setFilter(e.target.value)} />
        <select className={field} aria-label="Filter status" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}
        </select>
        {mode !== 'review' && <button className={button} onClick={() => { setSelected(null); setEdit({ title: '', company: '', jobDescription: '', notes: '' }); }}>New job</button>}
        {loading ? <p>Loading jobs...</p> : visible.length === 0 ? <p>No saved jobs{mode === 'review' ? ' with prepared packets' : ''}.</p> : visible.map(job =>
          <button key={job.id} onClick={() => choose(job)} className={`block w-full rounded border p-3 text-left ${selected === job.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
            <strong className="block break-words">{job.title}</strong><span className="block text-sm">{job.company || 'Company not set'}</span>
            <span className="text-xs">{job.status} | {job.packet?.decision || 'Not prepared'}</span>
            {job.deadline && <span className="block text-xs">Deadline: {job.deadline}</span>}
          </button>)}
      </section>
      <section className="min-w-0 space-y-4">
        {mode !== 'review' && <form onSubmit={save} className="space-y-3" aria-label="Job details">
          <label className="block text-sm">Title<input required maxLength={200} className={field} value={edit.title || ''} onChange={e => setEdit({ ...edit, title: e.target.value })} /></label>
          <label className="block text-sm">Company<input className={field} value={edit.company || ''} onChange={e => setEdit({ ...edit, company: e.target.value })} /></label>
          <label className="block text-sm">Job URL<input type="url" className={field} value={edit.jobUrl || ''} onChange={e => setEdit({ ...edit, jobUrl: e.target.value })} /></label>
          <label className="block text-sm">Description<textarea required rows={7} className={field} value={edit.jobDescription || ''} onChange={e => setEdit({ ...edit, jobDescription: e.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Resume<select className={field} value={edit.resumeId || ''} onChange={e => setEdit({ ...edit, resumeId: e.target.value })}>
              <option value="">Choose saved resume</option>{resumes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
            <label className="text-sm">Cover letter<select className={field} value={edit.coverLetterId || ''} onChange={e => setEdit({ ...edit, coverLetterId: e.target.value })}>
              <option value="">None</option>{letters.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
          </div>
          <label className="block text-sm">Notes<textarea rows={3} className={field} value={edit.notes || ''} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></label>
          <label className="block text-sm">Deadline<input type="date" className={field} value={edit.deadline || ''} onChange={e => setEdit({ ...edit, deadline: e.target.value })} /></label>
          <button disabled={busy} className={`${button} bg-blue-700 text-white`}>Save job</button>
        </form>}
        {current && <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
          <label className="text-sm">Status <select disabled={busy} value={current.status} className={button} onChange={e => run(() => updateCareerJob(current.id, { status: e.target.value as CareerJob['status'] }))}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>
          {mode !== 'review' && <button className={button} disabled={busy || !current.resumeId} onClick={() => run(() => api.post(`/career/jobs/${current.id}/prepare`))}>Prepare saved packet</button>}
          <button className={`${button} text-red-700`} disabled={busy} onClick={() => {
            if (window.confirm('Delete this job and its packet?')) run(async () => { await api.delete(`/career/jobs/${current.id}`); setSelected(null); });
          }}>Delete job</button>
        </div>}
        {current?.packet?.id && <section className="space-y-3 border-t border-slate-200 pt-4" aria-label="Prepared packet">
          <h2 className="text-lg font-bold">{current.title}: {current.packet.decision}</h2>
          <p className="text-sm">Resume: {current.packet.resumeTitle} | Prepared {new Date(current.packet.preparedAt).toLocaleString()}</p>
          <article className="space-y-3 border-y py-4 text-sm">
            <h3 className="font-bold">Resume Snapshot</h3>
            <p className="font-semibold">{current.packet.resume?.targetRole}</p>
            <p>{current.packet.resume?.personalDetails?.summary}</p>
            {(current.packet.resume?.experienceItems || []).map((item: any, index: number) => <div key={index}><h4 className="font-semibold">{item.role} | {item.company} | {item.dates}</h4><p className="whitespace-pre-wrap">{item.description}</p></div>)}
            {current.packet.coverLetter && <><h3 className="font-bold">Cover Letter</h3><p className="whitespace-pre-wrap">{current.packet.coverLetter.coverLetterFull || JSON.stringify(current.packet.coverLetter)}</p></>}
            {current.packet.notes && <><h3 className="font-bold">Notes</h3><p className="whitespace-pre-wrap">{current.packet.notes}</p></>}
          </article>
          <details><summary className="cursor-pointer font-semibold">Resume and answers snapshot</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words bg-slate-50 p-3 text-xs">{JSON.stringify(current.packet, null, 2)}</pre></details>
          {current.packet.decision === 'pending' && <div className="flex gap-3">{(['approved', 'rejected'] as const).map(decision =>
            <button key={decision} disabled={busy} className={button} onClick={() => run(() => api.post(`/career/jobs/${current.id}/decision`, { packetId: current.packet.id, decision }))}>{decision === 'approved' ? 'Approve packet' : 'Reject packet'}</button>)}</div>}
          {current.packet.decision === 'approved' && <button className={button} onClick={() => {
            const blob = new Blob([JSON.stringify(current.packet, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'application-packet.json'; link.click(); URL.revokeObjectURL(url);
          }}>Download approved packet</button>}
        </section>}
      </section>
    </div>
  </main>;
}
