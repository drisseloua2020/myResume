import React, { useEffect, useState } from 'react';
import { listContactMessages, replyContactMessage, ContactMessage } from '../services/adminService';

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [replyTo, setReplyTo] = useState<ContactMessage | null>(null);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);

  const refresh = async () => {
    const rows = await listContactMessages();
    setMessages(rows);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (e: any) {
        setError(e?.message || 'Failed to load contact messages');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openReply = (m: ContactMessage) => {
    setReplyTo(m);
    setReplySubject(m.subject?.startsWith('Re:') ? m.subject : `Re: ${m.subject}`);
    setReplyBody(`Hi ${m.name},\n\n`);
  };

  const send = async () => {
    if (!replyTo) return;
    try {
      setSending(true);
      await replyContactMessage(replyTo.id, { subject: replySubject, message: replyBody });
      setReplyTo(null);
      setReplySubject('');
      setReplyBody('');
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to send email (check SMTP config).');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <h1 className="text-2xl font-bold text-slate-900">Contact Messages</h1>
      <p className="text-slate-600 mt-1">Incoming messages from the Contact Us form.</p>

      {loading && <div className="mt-6 text-slate-600">Loading…</div>}
      {error && <div className="mt-6 text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="mt-6 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">{m.subject}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    From <span className="font-medium">{m.name}</span> ({m.email}) • {new Date(m.createdAt).toLocaleString()}
                  </div>
                  <div className="text-xs mt-1 text-slate-500">Status: {m.status}</div>
                </div>
                <button
                  onClick={() => openReply(m)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                >
                  Reply
                </button>
              </div>
              <pre className="mt-3 text-sm whitespace-pre-wrap text-slate-800">{m.message}</pre>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-slate-600">No messages yet.</div>
          )}
        </div>
      )}

      {replyTo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900">Reply to {replyTo.email}</div>
              <button onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">Subject</label>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">Message</label>
              <textarea
                className="mt-1 w-full border rounded px-3 py-2 h-48"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setReplyTo(null)}
                className="px-4 py-2 rounded border text-slate-700 hover:bg-slate-50"
                disabled={sending}
              >
                Cancel
              </button>
              <button
                onClick={send}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={sending || !replySubject.trim() || !replyBody.trim()}
              >
                {sending ? 'Sending…' : 'Send Reply'}
              </button>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Sends via SMTP with <span className="font-mono">from: myresume_team@myresume.ai</span> (or SMTP_FROM env override).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
