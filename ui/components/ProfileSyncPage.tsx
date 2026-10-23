import React from 'react';
export default function ProfileSyncPage() {
  return <main className="mx-auto max-w-4xl space-y-4 p-6">
    <h1 className="text-2xl font-bold">Profile Sources</h1>
    <p>External profile synchronization is unavailable. Your sign-in connection does not import career history.</p>
    <a className="inline-block rounded border border-slate-300 px-4 py-2 font-semibold text-blue-700" href="#view=career_tools">Import profile text</a>
  </main>;
}
