import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { sendContactMessage, contactSchema, ContactFormData } from '../services/contactService';

interface ContactPageProps {
  user: User;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

const ContactPage: React.FC<ContactPageProps> = ({ user }) => {
  const [formData, setFormData] = useState<ContactFormData>({
    name: user.name || '',
    email: user.email || '',
    subject: '',
    message: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // ✅ All fields mandatory (client-side check; schema also enforces)
  const isFormValid = useMemo(() => {
    return (
      formData.name.trim().length > 0 &&
      formData.email.trim().length > 0 &&
      formData.subject.trim().length > 0 &&
      formData.message.trim().length > 0
    );
  }, [formData]);

  useEffect(() => {
    // Update defaults if user changes (e.g. initial load)
    // Keep user-provided edits if already typed (prefer existing values)
    if (status === 'idle') {
      setFormData(prev => ({
        ...prev,
        name: prev.name?.trim() ? prev.name : (user.name || ''),
        email: prev.email?.trim() ? prev.email : (user.email || '')
      }));
    }
  }, [user, status]);

  const setField = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setField(name as keyof ContactFormData, value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ Hard guard: required fields
    if (!isFormValid) {
      setErrors(prev => ({
        ...prev,
        name: formData.name.trim() ? prev.name : 'Name is required',
        email: formData.email.trim() ? prev.email : 'Email is required',
        subject: formData.subject.trim() ? prev.subject : 'Subject is required',
        message: formData.message.trim() ? prev.message : 'Message is required'
      }));
      return;
    }

    setStatus('submitting');
    setErrorMessage('');
    setErrors({});

    // ✅ Schema validation (must trim + min(1) in contactSchema)
    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactFormData, string>> = {};
      result.error.errors.forEach(err => {
        const key = err.path?.[0] as keyof ContactFormData | undefined;
        if (key) fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      setStatus('idle');
      return;
    }

    try {
      await sendContactMessage(result.data);
      setStatus('success');
      // Reset non-user fields
      setFormData(prev => ({ ...prev, subject: '', message: '' }));
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to send message. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6">
        <div className="bg-white rounded-xl shadow-sm border border-green-100 p-12 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Message Sent!</h2>
          <p className="text-slate-600 mb-8">
            Thank you for contacting us. We'll get back to you as soon as possible.
          </p>
          <button onClick={() => setStatus('idle')} className="text-[#1a91f0] font-semibold hover:underline">
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-8 py-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">Contact Support</h2>
          <p className="text-slate-500 mt-1">Have a question or feedback? We'd love to hear from you.</p>
        </div>

        <div className="p-8">
          {status === 'error' && (
            <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded border border-red-100 flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p>{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Name</label>
                <input
                  required
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg outline-none transition-all ${
                    errors.name
                      ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-slate-300 focus:border-[#1a91f0] focus:ring-1 focus:ring-[#1a91f0]'
                  }`}
                  placeholder="Your Name"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg outline-none transition-all ${
                    errors.email
                      ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-slate-300 focus:border-[#1a91f0] focus:ring-1 focus:ring-[#1a91f0]'
                  }`}
                  placeholder="you@example.com"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Subject</label>
              <input
                required
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg outline-none transition-all ${
                  errors.subject
                    ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-slate-300 focus:border-[#1a91f0] focus:ring-1 focus:ring-[#1a91f0]'
                }`}
                placeholder="How can we help?"
              />
              {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Message</label>
              <textarea
                required
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={5}
                className={`w-full px-4 py-2 border rounded-lg outline-none transition-all ${
                  errors.message
                    ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-slate-300 focus:border-[#1a91f0] focus:ring-1 focus:ring-[#1a91f0]'
                }`}
                placeholder="Describe your issue or question..."
              />
              {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message}</p>}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={status === 'submitting' || !isFormValid}
                className="w-full bg-[#1a91f0] text-white font-bold py-3 rounded-lg shadow-md hover:bg-[#1170cd] transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'submitting' ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Send Message'
                )}
              </button>

              {!isFormValid && status !== 'submitting' && (
                <p className="text-[11px] text-slate-400 mt-2">
                  Please fill in all fields before sending.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;