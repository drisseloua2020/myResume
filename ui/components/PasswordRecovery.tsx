import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/apiClient';
import { useDialogFocus } from '../utils/useDialogFocus';

export default function PasswordRecovery() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('resetToken'));
  const [open, setOpen] = useState(Boolean(token));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, () => setOpen(false), open);
  useEffect(() => {
    if (token) window.history.replaceState({}, '', window.location.pathname);
    const show = () => setOpen(true);
    window.addEventListener('myresume:password-recovery', show);
    return () => window.removeEventListener('myresume:password-recovery', show);
  }, []);
  if (!open) return null;
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="recovery-title" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
    <form className="w-full max-w-md space-y-4 rounded-lg bg-white p-6" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setMessage('');
      try {
        await api.post(token ? '/auth/reset-password' : '/auth/forgot-password', token ? { token, newPassword: password } : { email });
        setMessage(token ? 'Password changed. Sign in with your new password.' : 'If this email has an eligible account, a reset link has been sent.');
      } catch (error: any) { setMessage(error.message); } finally { setBusy(false); }
    }}>
      <h2 id="recovery-title" className="text-xl font-bold">{token ? 'Reset Password' : 'Password Recovery'}</h2>
      {token ? <label className="block text-sm">New password<input className="mt-1 w-full rounded border p-2" required minLength={12} maxLength={256} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label> : <label className="block text-sm">Email<input className="mt-1 w-full rounded border p-2" required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <div className="flex gap-3"><button disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white">{token ? 'Reset password' : 'Send reset link'}</button><button type="button" onClick={() => setOpen(false)} className="rounded border px-4 py-2">Close</button></div>
    </form>
  </div>;
}
