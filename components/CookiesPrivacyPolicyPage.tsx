import React from 'react';

type Props = {
  onBack: () => void;
};

export default function CookiesPrivacyPolicyPage({ onBack }: Props) {
  return (
    <div className="max-w-4xl mx-auto py-14 px-6">
      <button onClick={onBack} className="text-sm text-slate-600 hover:text-slate-900">← Back to Cookies</button>

      <div className="mt-6 bg-white border border-slate-200 rounded-xl p-8">
        <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: January 27, 2026</p>

        <div className="mt-6 space-y-5 text-slate-700 leading-relaxed">
          <p>
            This Privacy Policy explains how MyResume (“we”, “us”) collects, uses, and protects information when you use the
            MyResume website and services.
          </p>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Information we collect</h2>
            <ul className="mt-2 list-disc pl-5 space-y-2">
              <li><b>Account information:</b> name, email, password hash, plan selection.</li>
              <li><b>Resume and cover letter content:</b> the content you create or upload (saved as JSON in your account).</li>
              <li><b>Contact messages:</b> messages you submit via “Contact Us”.</li>
              <li><b>Usage data:</b> basic logs for security and troubleshooting (e.g., requests, errors).</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">How we use information</h2>
            <ul className="mt-2 list-disc pl-5 space-y-2">
              <li>Provide core features like resume building, saving, and downloading.</li>
              <li>Maintain security, prevent abuse, and improve reliability.</li>
              <li>Respond to your support requests.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Sharing</h2>
            <p className="mt-2">
              We do not sell your personal information. We may share limited data with service providers (e.g., hosting,
              email delivery) solely to operate the service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Data retention</h2>
            <p className="mt-2">
              We retain your data for as long as your account is active or as needed to provide the service. You can request
              deletion by contacting us.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Your choices</h2>
            <ul className="mt-2 list-disc pl-5 space-y-2">
              <li>Update account info in your Account settings.</li>
              <li>Control cookies via your browser settings.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Contact</h2>
            <p className="mt-2">If you have questions, contact us using the “Contact Us” form.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
