import React, { useEffect, useState } from 'react';
import { listProfileUpdates, syncProfile, ProfileSyncUpdate, listProfileSources, connectProfileSource, ProfileSource } from '../services/profileService';

export default function ProfileSyncPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [items, setItems] = useState<ProfileSyncUpdate[]>([]);
  const [sources, setSources] = useState<ProfileSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [src, upd] = await Promise.all([
        listProfileSources(),
        listProfileUpdates(),
      ]);
      setSources(src);
      setItems(upd);
    } catch (e: any) {
      setError(e?.message || 'Failed to load updates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncProfile();
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleConnect(sourceKey: string) {
    try {
      const updated = await connectProfileSource(sourceKey);
      setSources(updated);
    } catch (e: any) {
      alert(e?.message || 'Connect failed');
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Profile Sync</h2>
          <p className="text-slate-600">Connect sources and run a sync. The bot feed below shows detected changes you can add to your resume.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="px-4 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-900"
          >
            Refresh
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

      {/* Connected Sources */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="font-semibold text-slate-900">Sources</div>
          <div className="text-xs text-slate-600">LinkedIn, GitHub and a Universal source. If a source isn’t connected, click <b>Connect</b>.</div>
        </div>

        {loading ? (
          <div className="px-4 py-4 text-slate-500">Loading sources…</div>
        ) : (
          <div>
            {sources.map((s) => {
              const isUniversal = s.name.toLowerCase().includes('university');
              const displayName = isUniversal ? 'Universal' : s.name;
              const key = isUniversal ? 'universal' : s.name.toLowerCase();
              return (
                <div key={s.id} className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{displayName}</div>
                    <div className="text-xs text-slate-500">
                      {s.isConnected
                        ? (s.lastSync ? `Last sync: ${new Date(s.lastSync).toLocaleString()}` : 'Connected')
                        : 'Not connected'}
                    </div>
                  </div>
                  {s.isConnected ? (
                    <span className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Connected</span>
                  ) : (
                    <button
                      onClick={() => handleConnect(key)}
                      className="px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 text-sm"
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-slate-500">Loading feed…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded p-6 text-slate-600">
          No updates yet. Connect a source above and click <b>Sync Now</b>.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          {items.map((u) => (
            <div key={u.id} className="px-4 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900">{u.title}</div>
                <div className="text-xs text-slate-500">{new Date(u.createdAt).toLocaleString()}</div>
              </div>
              <div className="text-xs text-slate-500 mt-1">{u.source} · {u.category}</div>
              <div className="mt-2 text-slate-700 text-sm whitespace-pre-wrap">{u.details}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
