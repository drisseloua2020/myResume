import React, { useEffect, useMemo, useState } from 'react';
import { DataSource } from '../types';
import { agentService } from '../services/agentService';

interface DashboardProps {
  onCreate: () => void;
  userName: string;
  onReviewUpdates: () => void;
  pendingUpdateCount: number;
}

const Dashboard: React.FC<DashboardProps> = ({
  onCreate,
  userName,
  onReviewUpdates,
  pendingUpdateCount,
}) => {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loadingSources, setLoadingSources] = useState<boolean>(true);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const safeSources = useMemo(() => (Array.isArray(sources) ? sources : []), [sources]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingSources(true);
        setSourcesError(null);

        const list = await agentService.getSources();
        if (!alive) return;

        setSources(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (!alive) return;
        setSources([]);
        setSourcesError(e?.message ?? 'Failed to load sources');
      } finally {
        if (!alive) return;
        setLoadingSources(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const toggleSource = async (id: string) => {
    try {
      setSourcesError(null);
      setTogglingId(id);

      const updated = await agentService.toggleSource(id);
      setSources(Array.isArray(updated) ? updated : []);
    } catch (e: any) {
      setSourcesError(e?.message ?? 'Failed to toggle source');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto py-12 px-6 sm:px-8">
      {/* Hero Section */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h1>
          <p className="text-slate-500">
            Welcome back, {userName}. Manage your documents and career profile.
          </p>
        </div>

        {/* Agent Notification Pill */}
        {pendingUpdateCount > 0 && (
          <div
            onClick={onReviewUpdates}
            className="bg-indigo-600 text-white px-5 py-3 rounded-lg shadow-lg cursor-pointer flex items-center gap-3 animate-bounce-subtle hover:bg-indigo-700 transition-colors"
          >
            <div className="relative">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full border-2 border-indigo-600"></div>
            </div>
            <div className="text-sm font-bold">
              {pendingUpdateCount} AI Updates Found
              <span className="block text-[10px] font-normal opacity-80">
                Check email or review now
              </span>
            </div>
            <svg
              className="w-4 h-4 ml-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Main Action Area (Resumes) - Takes up 2/3 */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-700 tracking-tight">Resumes</h2>
            <button className="text-sm text-[#1a91f0] font-medium hover:underline">
              View All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* "New Resume" Card */}
            <div
              onClick={onCreate}
              className="group cursor-pointer flex flex-col h-[280px] rounded-lg transition-all duration-200 relative"
            >
              <div className="flex-1 border-2 border-dashed border-slate-300 rounded-lg bg-white group-hover:border-[#1a91f0] group-hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="w-14 h-14 rounded-full bg-blue-100 text-[#1a91f0] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                  <svg
                    className="w-7 h-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <span className="font-bold text-slate-700 text-lg group-hover:text-[#1a91f0]">
                  New Resume
                </span>
                <p className="text-center text-xs text-slate-400 mt-2 px-2">
                  Pick a template and create a resume from scratch or upload a PDF.
                </p>
              </div>
            </div>

            {/* Mock Document Card */}
            <div className="group flex flex-col h-[280px] relative">
              <div
                className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm group-hover:shadow-md group-hover:-translate-y-1 transition-all overflow-hidden relative cursor-pointer"
                onClick={onCreate}
              >
                <div className="w-full h-full bg-white p-5 relative">
                  <div className="w-1/2 h-4 bg-slate-800 mb-2"></div>
                  <div className="w-1/3 h-2 bg-slate-400 mb-6"></div>
                  <div className="space-y-3 opacity-60">
                    <div className="w-full h-1.5 bg-slate-200"></div>
                    <div className="w-5/6 h-1.5 bg-slate-200"></div>
                    <div className="w-full h-1.5 bg-slate-200"></div>
                  </div>
                  <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/5 transition-colors flex items-center justify-center">
                    <button className="opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all bg-white text-[#1a91f0] font-semibold px-6 py-2 rounded-full shadow-lg text-sm hover:bg-blue-50">
                      Edit
                    </button>
                  </div>
                </div>
              </div>
              <div className="pt-3 px-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm truncate pr-2 group-hover:text-[#1a91f0] cursor-pointer">
                      {userName}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Updated 2 mins ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Agent / Data Sources Sidebar - Takes up 1/3 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span className="text-indigo-400">⚡</span> Career Agent
              </h3>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 uppercase tracking-wide">
                Active
              </span>
            </div>

            <div className="p-6">
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Your agent automatically scans these sources for new certificates, degrees, and
                projects.
              </p>

              {sourcesError && (
                <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                  {sourcesError}
                </div>
              )}

              {loadingSources ? (
                <div className="text-xs text-slate-400">Loading sources...</div>
              ) : (
                <div className="space-y-4">
                  {safeSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                            source.name === 'GitHub'
                              ? 'bg-slate-800'
                              : source.name === 'LinkedIn'
                              ? 'bg-[#0077b5]'
                              : 'bg-orange-500'
                          }`}
                        >
                          {source.name === 'GitHub' && (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                          )}

                          {source.name === 'LinkedIn' && (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                            </svg>
                          )}

                          {source.name === 'University Portal' && (
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 14l9-5-9-5-9 5 9 5z" />
                              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
                              />
                            </svg>
                          )}
                        </div>

                        <div>
                          <div className="text-sm font-semibold text-slate-800">{source.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {source.isConnected ? `Synced ${source.lastSync}` : 'Not connected'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleSource(source.id)}
                        disabled={togglingId === source.id}
                        className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                          source.isConnected
                            ? 'border-red-200 text-red-500 hover:bg-red-50'
                            : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                        }`}
                      >
                        {togglingId === source.id
                          ? '...'
                          : source.isConnected
                          ? 'Disconnect'
                          : 'Connect'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button className="w-full text-center text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                  + Add Custom RSS Feed
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
