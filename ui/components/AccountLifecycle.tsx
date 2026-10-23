import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { api, clearSession, getToken, setSession } from '../services/apiClient';
import { careerOnboardingQuestions, CareerOnboardingAnswers } from './UserOnboarding';
import { getCareerOnboardingProfile, saveCareerOnboardingProfile } from '../services/onboardingService';

export default function AccountLifecycle({ user, onUserUpdated }: { user: User; onUserUpdated?: (user: User) => void }) {
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [answers, setAnswers] = useState<CareerOnboardingAnswers | null>(null);
  useEffect(() => { getCareerOnboardingProfile().then(profile => {
    if (profile) {
      const values = Object.fromEntries(careerOnboardingQuestions.map(q => [q.key, profile[q.key]]));
      setAnswers(values as unknown as CareerOnboardingAnswers);
    }
  }).catch(error => setMessage(error.message)); }, []);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }
  function disconnect() { clearSession(); window.dispatchEvent(new CustomEvent('rf:session-expired')); }
  const input = 'mt-1 block w-full rounded border border-slate-300 p-2 text-sm';
  const button = 'rounded border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50';
  return <section className="space-y-6 border-t border-slate-200 pt-5">
    {message && <p role="status" className="bg-amber-50 p-3">{message}</p>}
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); run(async () => {
      const result = await api.patch<{ user: User }>('/auth/me', { name }); const token = getToken(); if (token) setSession(token, result.user); onUserUpdated?.(result.user); setMessage('Profile updated');
    }); }}><label className="block text-sm">Full name<input required maxLength={120} className={input} value={name} onChange={e => setName(e.target.value)} /></label><button disabled={busy} className={button}>Update name</button></form>
    <form className="space-y-3 border-t pt-5" onSubmit={e => { e.preventDefault(); run(async () => {
      await api.post('/auth/me/password', { currentPassword: password, newPassword }); disconnect();
    }); }}><h2 className="text-lg font-bold">Change Password</h2><label className="block text-sm">Current password<input type="password" autoComplete="current-password" className={input} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label className="block text-sm">New password<input type="password" autoComplete="new-password" className={input} required minLength={12} maxLength={256} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><button disabled={busy || user.hasPassword === false} className={button} title={user.hasPassword === false ? 'Manage your password with your sign-in provider' : 'Changing password signs out all sessions'}>Change password and sign out</button></form>
    {answers && <form className="space-y-3 border-t pt-5" onSubmit={e => { e.preventDefault(); run(async () => { await saveCareerOnboardingProfile(answers); setMessage('Career preferences updated. Rerun analysis to refresh your report.'); }); }}>
      <h2 className="text-lg font-bold">Career Preferences</h2>{careerOnboardingQuestions.map(q => <label className="block text-sm" key={q.key}>{q.label}<select className={input} value={answers[q.key]} onChange={e => setAnswers({ ...answers, [q.key]: e.target.value })}>{q.options.map(o => <option key={o.value}>{o.value}</option>)}</select></label>)}<button disabled={busy} className={button}>Save career preferences</button></form>}
    <div className="space-y-3 border-t pt-5"><h2 className="text-lg font-bold">Your Data</h2><button disabled={busy} className={button} onClick={() => run(async () => {
      const data = await api.get('/auth/me/data'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'myresumes-account-data.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    })}>Export all account data</button>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (window.confirm('Permanently delete your account, resumes, letters, jobs and profile photos?')) run(async () => { await api.post('/auth/me/delete', { confirmationEmail, currentPassword: password }); disconnect(); }); }}>
      <label className="block text-sm">Confirm account email<input type="email" autoComplete="off" required className={input} value={confirmationEmail} onChange={e => setConfirmationEmail(e.target.value)} /></label>
      <button disabled={busy || confirmationEmail.toLowerCase() !== user.email.toLowerCase()} className={`${button} text-red-700`}>Permanently delete account</button>
    </form></div>
  </section>;
}
