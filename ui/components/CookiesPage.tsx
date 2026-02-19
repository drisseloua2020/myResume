import React from 'react';

type Props = {
  onBack: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
};

export default function CookiesPage({ onBack, onOpenPrivacy, onOpenTerms }: Props) {
  return (
    <div className="max-w-4xl mx-auto py-14 px-6">
      <button onClick={onBack} className="text-sm text-slate-600 hover:text-slate-900">← Back</button>

      <div className="mt-6 bg-white border border-slate-200 rounded-xl p-8">
        <h1 className="text-3xl font-bold text-slate-900">Cookies</h1>
        <p className="mt-3 text-slate-600">
          We use cookies and similar technologies to keep MyResume working, understand usage, and improve your
          experience. You can control cookies through your browser settings.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={onOpenPrivacy}
            className="text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg p-5"
          >
            <div className="font-semibold text-slate-900">Privacy Policy</div>
            <div className="mt-1 text-sm text-slate-600">How we collect, use, and protect your data.</div>
          </button>

          <button
            onClick={onOpenTerms}
            className="text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg p-5"
          >
            <div className="font-semibold text-slate-900">Terms of Use</div>
            <div className="mt-1 text-sm text-slate-600">Rules and conditions for using MyResume.</div>
          </button>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900">Cookie categories</h2>
          <ul className="mt-3 space-y-3 text-slate-700">
            <li>
              <b>Essential:</b> required for core features like authentication and saving your work.
            </li>
            <li>
              <b>Performance:</b> helps us understand which pages are used and improve reliability.
            </li>
            <li>
              <b>Preference:</b> remembers non-essential settings (when available).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
