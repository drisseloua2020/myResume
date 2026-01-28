import React from 'react';

type Props = {
  onBack: () => void;
};

export default function CookiesTermsOfUsePage({ onBack }: Props) {
  return (
    <div className="max-w-4xl mx-auto py-14 px-6">
      <button onClick={onBack} className="text-sm text-slate-600 hover:text-slate-900">← Back to Cookies</button>

      <div className="mt-6 bg-white border border-slate-200 rounded-xl p-8">
        <h1 className="text-3xl font-bold text-slate-900">Terms of Use</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: January 27, 2026</p>

        <div className="mt-6 space-y-5 text-slate-700 leading-relaxed">
          <p>
            These Terms of Use govern your access to and use of MyResume. By using the service, you agree to these terms.
          </p>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Account & security</h2>
            <ul className="mt-2 list-disc pl-5 space-y-2">
              <li>You are responsible for keeping your login credentials secure.</li>
              <li>You must provide accurate information when creating an account.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Acceptable use</h2>
            <ul className="mt-2 list-disc pl-5 space-y-2">
              <li>Do not misuse the service or attempt to access it in unauthorized ways.</li>
              <li>Do not upload content you do not have the right to use.</li>
              <li>Do not use MyResume to generate or store unlawful content.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Your content</h2>
            <p className="mt-2">
              You own the resume and cover letter content you create. You grant us permission to process and store it to
              provide the service (e.g., saving drafts, generating outputs, and enabling downloads).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Plans & billing</h2>
            <p className="mt-2">
              If you choose a paid plan, your access and features may depend on that plan. Fees and renewal terms are
              displayed at checkout.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Disclaimers</h2>
            <p className="mt-2">
              MyResume is provided “as is”. We do not guarantee interview offers or employment outcomes.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Contact</h2>
            <p className="mt-2">Questions? Use the “Contact Us” form.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
