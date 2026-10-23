import React, { useEffect, useRef, useState } from 'react';
import { CareerJob, listCareerJobs } from '../services/careerService';
import { DemoOperation, DemoProvider, DemoRequest, DemoScenario, executeDemoOperation, getDemoOperations, getDemoState, getProviderCapabilities } from '../services/providerService';

const providers: Array<[DemoProvider, string]> = [['jobs', 'Job board'], ['profile', 'Profile sync'], ['applications', 'Applications'], ['billing', 'Billing'], ['email', 'Email']];
const button = 'rounded border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40';
const input = 'rounded border border-slate-300 bg-white p-2 text-sm';

export default function ProviderDemoPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<DemoProvider>('jobs');
  const [scenario, setScenario] = useState<DemoScenario>('success');
  const [source, setSource] = useState('github');
  const [plan, setPlan] = useState<'pro_monthly' | 'pro_yearly'>('pro_monthly');
  const [jobId, setJobId] = useState('');
  const [jobs, setJobs] = useState<CareerJob[]>([]);
  const [operations, setOperations] = useState<DemoOperation[]>([]);
  const [result, setResult] = useState<DemoOperation | null>(null);
  const [state, setState] = useState<{ profiles: Record<string, boolean>; billing: Record<string, any> }>({ profiles: {}, billing: {} });
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef<{ signature: string; request: DemoRequest } | null>(null);

  async function refresh(offset = page * 20) {
    const [history, current, saved] = await Promise.all([getDemoOperations(offset), getDemoState(), listCareerJobs()]);
    setOperations(history.operations); setTotal(history.total); setState(current); setJobs(saved.jobs);
  }
  useEffect(() => {
    let alive = true;
    getProviderCapabilities().then(async capabilities => {
      if (!alive) return;
      setEnabled(capabilities.demoEnabled);
      if (capabilities.demoEnabled) await refresh();
    }).catch(error => { if (alive) setMessage(error.message); });
    return () => { alive = false; };
  }, []);

  async function execute(action: string, subjectId?: string) {
    const payload = { provider, action, scenario, subjectId, ...(provider === 'billing' ? { plan } : {}) };
    const signature = JSON.stringify(payload);
    if (pending.current?.signature !== signature) pending.current = { signature, request: { ...payload, idempotencyKey: crypto.randomUUID() } };
    setBusy(true); setMessage('');
    try {
      const response = await executeDemoOperation(pending.current.request);
      pending.current = null;
      setResult(response.operation);
      setMessage(response.operation.status === 'failed' ? response.operation.result.error : response.replayed ? 'Existing simulated result reused. No duplicate effect.' : 'Simulation recorded. No external provider was contacted.');
      setPage(0);
      await refresh(0).catch(() => setMessage('Simulation recorded, but history refresh failed. Reload this page to see the saved result.'));
    } catch (error: any) { setMessage(error.message || 'Request failed. Retry uses the same operation key.'); }
    finally { setBusy(false); }
  }

  if (enabled === null) return <p role="status" className="p-6">{message || 'Loading provider availability...'}</p>;
  if (!enabled) return <main className="mx-auto max-w-5xl space-y-4 p-6"><h1 className="text-2xl font-bold">Provider Demo</h1><p>Mock providers are disabled in this environment.</p></main>;
  const discovery = result?.provider === 'jobs' && Array.isArray(result.result.jobs) ? result.result.jobs : [];
  const approved = jobs.filter(job => job.packet?.decision === 'approved');

  return <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
    <h1 className="text-2xl font-bold">Provider Demo</h1>
    <p className="border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950">Mock providers. Synthetic data only. No real charges, emails, profile imports or application submissions.</p>
    <div role="tablist" aria-label="Demo provider" className="flex flex-wrap gap-2 border-b pb-3">{providers.map(([id, label]) => <button role="tab" disabled={busy} aria-selected={provider === id} key={id} onClick={() => { setProvider(id); setResult(null); setMessage(''); }} className={`${button} ${provider === id ? 'border-blue-700 bg-blue-50 text-blue-800' : ''}`}>{label}</button>)}</div>
    <label className="flex flex-wrap items-center gap-3 text-sm">Provider response<select aria-label="Provider response" disabled={busy} className={input} value={scenario} onChange={e => setScenario(e.target.value as DemoScenario)}><option value="success">Success</option><option value="failure">Failure</option><option value="timeout">Timeout</option></select></label>
    {message && <p role="status" className="border-l-4 border-amber-500 bg-amber-50 p-3 text-sm">{message}</p>}
    <section className="space-y-4 border-y border-slate-200 py-5" aria-label="Mock operation">
      {provider === 'jobs' && <><button className={button} disabled={busy} onClick={() => execute('discover')}>Discover sample jobs</button>
        <ul className="divide-y">{discovery.map((job: any) => <li className="space-y-2 py-4" key={job.id}><h2 className="font-bold">{job.title}</h2><p className="text-sm">{job.company} | {job.location}</p><p className="text-sm">{job.jobDescription}</p><button disabled={busy} className={button} onClick={() => execute('save', job.id)}>Save sample job</button></li>)}</ul></>}
      {provider === 'profile' && <><label className="flex flex-wrap items-center gap-3 text-sm">Demo source<select className={input} aria-label="Demo source" disabled={busy} value={source} onChange={e => setSource(e.target.value)}><option value="github">GitHub</option><option value="linkedin">LinkedIn</option></select><span>{state.profiles[source] ? 'Demo connected' : 'Disconnected'}</span></label>
        <div className="flex flex-wrap gap-3"><button disabled={busy || state.profiles[source]} className={button} onClick={() => execute('connect', source)}>Connect demo source</button><button disabled={busy || !state.profiles[source]} className={button} onClick={() => execute('sync', source)}>Sync sample updates</button><button disabled={busy || !state.profiles[source]} className={button} onClick={() => execute('disconnect', source)}>Disconnect demo source</button></div>
        {result?.result.updates?.map((update: any) => <article className="border-t pt-3" key={update.externalId}><h2 className="font-bold">{update.title}</h2><p className="text-sm">{update.description}</p></article>)}<p className="text-sm text-slate-600">Synthetic updates never modify your resume.</p></>}
      {provider === 'applications' && <><label className="flex flex-wrap items-center gap-3 text-sm">Approved packet<select className={`${input} min-w-0 max-w-full`} aria-label="Approved packet" disabled={busy} value={jobId} onChange={e => setJobId(e.target.value)}><option value="">Choose a packet</option>{approved.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
        {!approved.length && <p className="text-sm">No approved packets. Prepare and approve a saved job first.</p>}<button className={button} disabled={busy || !jobId} onClick={() => execute('submit', jobId)}>Simulate submission</button><p className="text-sm text-slate-600">A simulated receipt does not mark the real application as submitted.</p></>}
      {provider === 'billing' && <><p className="text-sm">Demo subscription: <strong>{state.billing.subscriptionStatus}</strong> | {state.billing.plan}</p><label className="flex flex-wrap items-center gap-3 text-sm">Demo plan<select aria-label="Demo plan" disabled={busy} className={input} value={plan} onChange={e => setPlan(e.target.value as typeof plan)}><option value="pro_monthly">Pro monthly</option><option value="pro_yearly">Pro yearly</option></select></label><div className="flex flex-wrap gap-3"><button disabled={busy} className={button} onClick={() => execute('checkout')}>Simulate checkout</button><button disabled={busy || state.billing.subscriptionStatus !== 'active'} className={button} onClick={() => execute('cancel')}>Simulate cancellation</button></div><p className="text-sm text-slate-600">No payment details are collected. Your actual plan and quotas remain unchanged.</p></>}
      {provider === 'email' && <><button disabled={busy} className={button} onClick={() => execute('send')}>Send sample to demo outbox</button><p className="text-sm text-slate-600">Destination: candidate@example.invalid. Nothing leaves this server.</p>{result?.result.body && <article className="space-y-2 border-t pt-3"><h2 className="font-bold">{result.result.subject}</h2><p className="text-sm">{result.result.body}</p><p className="text-sm">Delivery: {result.result.delivery}</p></article>}</>}
      {result && <details><summary className="cursor-pointer text-sm font-semibold">Simulated response</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words bg-slate-100 p-3 text-xs">{JSON.stringify(result, null, 2)}</pre></details>}
    </section>
    <section aria-label="Demo operation history" className="space-y-3"><h2 className="text-lg font-bold">Operation History</h2>{!operations.length && <p className="text-sm">No demo operations yet.</p>}<ol className="divide-y">{operations.map(operation => <li className="py-3 text-sm" key={operation.id}><div className="flex flex-wrap justify-between gap-2"><strong>{operation.provider} / {operation.action}</strong><span>{operation.status} | mock</span></div><p className="text-xs text-slate-600">{new Date(operation.createdAt).toLocaleString()}</p><details><summary className="cursor-pointer">Result</summary><pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(operation.result, null, 2)}</pre></details></li>)}</ol>
      <div className="flex flex-wrap gap-4 text-sm"><button disabled={busy || page === 0} onClick={async () => { setBusy(true); try { await refresh((page - 1) * 20); setPage(page - 1); } catch (error: any) { setMessage(error.message); } finally { setBusy(false); } }}>Previous</button><span>Page {page + 1} | {total} operations</span><button disabled={busy || (page + 1) * 20 >= total} onClick={async () => { setBusy(true); try { await refresh((page + 1) * 20); setPage(page + 1); } catch (error: any) { setMessage(error.message); } finally { setBusy(false); } }}>Next</button></div>
    </section>
  </main>;
}
