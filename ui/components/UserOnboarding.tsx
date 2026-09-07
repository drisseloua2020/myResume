import React, { useState } from 'react';
import { User } from '../types';

export interface CareerOnboardingAnswers {
  currentExperience: string;
  strengths: string;
  targetRoles: string;
  marketStatus: string;
  shortTermGoal: string;
  futureGoal: string;
  jobPreferences: string;
  supportNeeds: string;
}

export const careerOnboardingQuestions: Array<{
  key: keyof CareerOnboardingAnswers;
  label: string;
  prompt: string;
  placeholder?: string;
  options?: string[];
}> = [
  {
    key: 'currentExperience',
    label: 'Current experience',
    prompt: 'What role, field, or type of work have you been doing most recently?',
    placeholder: 'Example: Customer support lead with 5 years in SaaS operations.',
  },
  {
    key: 'strengths',
    label: 'Career strengths',
    prompt: 'Which skills, tools, accomplishments, or industries should define your career profile?',
    placeholder: 'Example: Team leadership, CRM operations, process improvement, Salesforce.',
  },
  {
    key: 'targetRoles',
    label: 'Target roles',
    prompt: 'Which jobs or roles are you trying to match with right now?',
    placeholder: 'Example: Customer Success Manager, Operations Manager, Program Coordinator.',
  },
  {
    key: 'marketStatus',
    label: 'Job-market status',
    prompt: 'Where are you in the job market today?',
    options: [
      'Actively applying',
      'Exploring better options',
      'Changing careers',
      'Returning to the workforce',
      'Upskilling before applying',
      'Not looking yet',
    ],
  },
  {
    key: 'shortTermGoal',
    label: 'Short-term goal',
    prompt: 'What do you want to accomplish in the next 3 to 6 months?',
    placeholder: 'Example: Land interviews for remote CSM roles and improve my resume positioning.',
  },
  {
    key: 'futureGoal',
    label: 'Future direction',
    prompt: 'Where do you want your career to move in the next 1 to 3 years?',
    placeholder: 'Example: Move into people management or become a senior operations leader.',
  },
  {
    key: 'jobPreferences',
    label: 'Matching preferences',
    prompt: 'What preferences or constraints should job matching respect?',
    placeholder: 'Example: Remote or hybrid, New York area, salary above $95k, no heavy travel.',
  },
  {
    key: 'supportNeeds',
    label: 'Assistant focus',
    prompt: 'Where should the assistant help first?',
    placeholder: 'Example: Clarify my target role, rewrite my summary, find resume gaps, match jobs.',
  },
];

const emptyAnswers: CareerOnboardingAnswers = {
  currentExperience: '',
  strengths: '',
  targetRoles: '',
  marketStatus: 'Actively applying',
  shortTermGoal: '',
  futureGoal: '',
  jobPreferences: '',
  supportNeeds: '',
};

interface UserOnboardingProps {
  user: User;
  onComplete: (answers: CareerOnboardingAnswers) => void;
  onSkip: () => void;
}

const UserOnboarding: React.FC<UserOnboardingProps> = ({ user, onComplete, onSkip }) => {
  const [answers, setAnswers] = useState<CareerOnboardingAnswers>(emptyAnswers);

  const updateAnswer = (key: keyof CareerOnboardingAnswers, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const firstName = user.name?.split(' ')[0] || 'there';

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <aside className="rounded border border-slate-200 bg-white p-6 shadow-sm">
            <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
              AI assistant assessment
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
              User Onboarding
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Hi {firstName}, answer a few questions so the assistant can understand your experience, career goals, job-market timing, and the opportunities worth matching.
            </p>
            <div className="mt-6 rounded bg-slate-900 p-5 text-white">
              <div className="text-sm font-bold text-blue-200">Career profile intake</div>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                I will look for your current career level, target direction, near-term priorities, future path, and matching constraints before you start editing your resume.
              </p>
            </div>
          </aside>

          <form
            className="rounded border border-slate-200 bg-white p-5 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              onComplete(answers);
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {careerOnboardingQuestions.map((question) => (
                <label key={question.key} className="block rounded border border-slate-200 bg-slate-50 p-4">
                  <span className="block text-xs font-black uppercase tracking-wide text-slate-500">{question.label}</span>
                  <span className="mt-1 block text-sm font-bold leading-5 text-slate-900">{question.prompt}</span>
                  {question.options ? (
                    <select
                      value={answers[question.key]}
                      onChange={(event) => updateAnswer(question.key, event.target.value)}
                      className="mt-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      {question.options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <textarea
                      value={answers[question.key]}
                      onChange={(event) => updateAnswer(question.key, event.target.value)}
                      placeholder={question.placeholder}
                      className="mt-3 h-28 w-full resize-none rounded border border-slate-300 bg-white p-3 text-sm leading-5 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onSkip}
                className="rounded border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Skip for now
              </button>
              <button
                type="submit"
                className="rounded bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
              >
                Complete onboarding
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default UserOnboarding;
