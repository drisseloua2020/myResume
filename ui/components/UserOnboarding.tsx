import React, { useMemo, useState } from 'react';
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
  helper: string;
  options: Array<{
    value: string;
    title: string;
    detail: string;
  }>;
}> = [
  {
    key: 'currentExperience',
    label: 'Starting point',
    prompt: 'Where are you starting from today?',
    helper: 'Samanta will use this to set the right level of confidence and detail.',
    options: [
      {
        value: 'Student or new graduate',
        title: 'Student or new graduate',
        detail: 'I am building my first strong career profile.',
      },
      {
        value: 'Early career professional',
        title: 'Early career professional',
        detail: 'I have some experience and want a sharper direction.',
      },
      {
        value: 'Experienced specialist',
        title: 'Experienced specialist',
        detail: 'I want my depth, results, and expertise to stand out.',
      },
      {
        value: 'Manager or team lead',
        title: 'Manager or team lead',
        detail: 'I need leadership, ownership, and outcomes up front.',
      },
      {
        value: 'Executive or founder',
        title: 'Executive or founder',
        detail: 'I want a profile built around strategy and scale.',
      },
      {
        value: 'Career changer',
        title: 'Career changer',
        detail: 'I need my transferable strengths to read clearly.',
      },
    ],
  },
  {
    key: 'strengths',
    label: 'Career strengths',
    prompt: 'What should your profile lead with?',
    helper: 'Pick the strongest signal recruiters should notice first.',
    options: [
      {
        value: 'Technical skills',
        title: 'Technical skills',
        detail: 'Systems, tools, engineering, data, platforms, or AI.',
      },
      {
        value: 'Leadership and coaching',
        title: 'Leadership and coaching',
        detail: 'Teams, mentoring, decisions, culture, and accountability.',
      },
      {
        value: 'Operations and process',
        title: 'Operations and process',
        detail: 'Execution, workflows, logistics, delivery, and quality.',
      },
      {
        value: 'Sales and customer growth',
        title: 'Sales and customer growth',
        detail: 'Revenue, accounts, retention, pipeline, and relationships.',
      },
      {
        value: 'Creative communication',
        title: 'Creative communication',
        detail: 'Content, design, storytelling, campaigns, and brand.',
      },
      {
        value: 'Data and strategy',
        title: 'Data and strategy',
        detail: 'Analysis, planning, insights, research, and decisions.',
      },
    ],
  },
  {
    key: 'targetRoles',
    label: 'Target direction',
    prompt: 'Which role family should Samanta tune your profile toward?',
    helper: 'This guides resume wording, keyword focus, and matching suggestions.',
    options: [
      {
        value: 'Software and IT',
        title: 'Software and IT',
        detail: 'Development, support, cybersecurity, cloud, or systems.',
      },
      {
        value: 'Business operations',
        title: 'Business operations',
        detail: 'Program, project, admin, logistics, or operations roles.',
      },
      {
        value: 'Customer success',
        title: 'Customer success',
        detail: 'Support, onboarding, account care, retention, or service.',
      },
      {
        value: 'Sales and growth',
        title: 'Sales and growth',
        detail: 'Business development, partnerships, revenue, or growth.',
      },
      {
        value: 'Marketing and content',
        title: 'Marketing and content',
        detail: 'Brand, campaigns, communications, design, or media.',
      },
      {
        value: 'Finance and administration',
        title: 'Finance and administration',
        detail: 'Accounting, analysis, office, compliance, or coordination.',
      },
      {
        value: 'Healthcare or education',
        title: 'Healthcare or education',
        detail: 'Care, teaching, training, student support, or community roles.',
      },
      {
        value: 'Open to several paths',
        title: 'Open to several paths',
        detail: 'I want help finding the best direction from my experience.',
      },
    ],
  },
  {
    key: 'marketStatus',
    label: 'Job-market status',
    prompt: 'Where are you in the job market today?',
    helper: 'Samanta will match the pace to your current urgency.',
    options: [
      {
        value: 'Actively applying',
        title: 'Actively applying',
        detail: 'I need a stronger profile for current applications.',
      },
      {
        value: 'Exploring better options',
        title: 'Exploring better options',
        detail: 'I am employed or stable, but looking for a better fit.',
      },
      {
        value: 'Changing careers',
        title: 'Changing careers',
        detail: 'I want to reposition my experience for a new path.',
      },
      {
        value: 'Returning to the workforce',
        title: 'Returning to the workforce',
        detail: 'I need a confident profile after time away.',
      },
      {
        value: 'Upskilling before applying',
        title: 'Upskilling before applying',
        detail: 'I am building readiness before I start applying.',
      },
      {
        value: 'Not looking yet',
        title: 'Not looking yet',
        detail: 'I want a clear profile before making a move.',
      },
    ],
  },
  {
    key: 'shortTermGoal',
    label: 'Next win',
    prompt: 'What is the next career win you want?',
    helper: 'Choose the outcome that would make this profile feel useful right away.',
    options: [
      {
        value: 'Build a resume from scratch',
        title: 'Build a resume from scratch',
        detail: 'I need a clean profile and resume foundation.',
      },
      {
        value: 'Refresh an existing resume',
        title: 'Refresh an existing resume',
        detail: 'I have content, but it needs sharper positioning.',
      },
      {
        value: 'Get ready to apply',
        title: 'Get ready to apply',
        detail: 'I want to be application-ready soon.',
      },
      {
        value: 'Prepare for interviews',
        title: 'Prepare for interviews',
        detail: 'I want my story, achievements, and examples aligned.',
      },
      {
        value: 'Shift into a new field',
        title: 'Shift into a new field',
        detail: 'I need help translating my background.',
      },
      {
        value: 'Grow into a promotion',
        title: 'Grow into a promotion',
        detail: 'I want to show readiness for the next level.',
      },
    ],
  },
  {
    key: 'futureGoal',
    label: 'Future direction',
    prompt: 'Where should this profile point over the next few years?',
    helper: 'A little future context helps Samanta avoid short-sighted recommendations.',
    options: [
      {
        value: 'Become a senior expert',
        title: 'Become a senior expert',
        detail: 'I want to deepen my craft and be known for excellence.',
      },
      {
        value: 'Move into management',
        title: 'Move into management',
        detail: 'I want more leadership, influence, and team ownership.',
      },
      {
        value: 'Change industries',
        title: 'Change industries',
        detail: 'I want my profile to travel into a different market.',
      },
      {
        value: 'Build a portfolio career',
        title: 'Build a portfolio career',
        detail: 'I want flexible work, projects, consulting, or freelancing.',
      },
      {
        value: 'Start or grow a business',
        title: 'Start or grow a business',
        detail: 'I want a profile that supports entrepreneurship.',
      },
      {
        value: 'Stabilize and earn more',
        title: 'Stabilize and earn more',
        detail: 'I want better income, consistency, and long-term security.',
      },
    ],
  },
  {
    key: 'jobPreferences',
    label: 'Matching preference',
    prompt: 'What should job matching respect first?',
    helper: 'Start with the preference that would most affect your decision.',
    options: [
      {
        value: 'Remote-first roles',
        title: 'Remote-first roles',
        detail: 'I want remote opportunities prioritized.',
      },
      {
        value: 'Hybrid near me',
        title: 'Hybrid near me',
        detail: 'I am open to local office time with flexibility.',
      },
      {
        value: 'Local on-site work',
        title: 'Local on-site work',
        detail: 'I prefer roles where I can work in person.',
      },
      {
        value: 'Higher salary range',
        title: 'Higher salary range',
        detail: 'Compensation growth is my strongest filter.',
      },
      {
        value: 'Flexible schedule',
        title: 'Flexible schedule',
        detail: 'I need schedule flexibility or better balance.',
      },
      {
        value: 'Mission-driven work',
        title: 'Mission-driven work',
        detail: 'I care most about purpose, culture, and values.',
      },
    ],
  },
  {
    key: 'supportNeeds',
    label: 'Assistant focus',
    prompt: 'Where should the assistant help first?',
    helper: 'Samanta will start with this after onboarding.',
    options: [
      {
        value: 'Shape my career story',
        title: 'Shape my career story',
        detail: 'Help me explain who I am and where I am headed.',
      },
      {
        value: 'Find profile gaps',
        title: 'Find profile gaps',
        detail: 'Show what is missing before I apply.',
      },
      {
        value: 'Improve resume wording',
        title: 'Improve resume wording',
        detail: 'Make my bullets, summary, and skills more effective.',
      },
      {
        value: 'Match me to roles',
        title: 'Match me to roles',
        detail: 'Suggest roles that fit my background and goals.',
      },
      {
        value: 'Plan next skills',
        title: 'Plan next skills',
        detail: 'Help me decide what to learn or prove next.',
      },
      {
        value: 'Organize applications',
        title: 'Organize applications',
        detail: 'Keep my job search structured and moving.',
      },
    ],
  },
];

const emptyAnswers: CareerOnboardingAnswers = {
  currentExperience: '',
  strengths: '',
  targetRoles: '',
  marketStatus: '',
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
  const [step, setStep] = useState(0);

  const currentQuestion = careerOnboardingQuestions[step];
  const selectedAnswer = answers[currentQuestion.key];
  const progress = Math.round(((step + 1) / careerOnboardingQuestions.length) * 100);
  const isLastStep = step === careerOnboardingQuestions.length - 1;
  const answeredCount = useMemo(
    () => Object.values(answers).filter(Boolean).length,
    [answers],
  );

  const updateAnswer = (key: keyof CareerOnboardingAnswers, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const goToPreviousStep = () => {
    setStep((current) => Math.max(current - 1, 0));
  };

  const continueOnboarding = () => {
    if (!selectedAnswer) return;
    if (isLastStep) {
      onComplete(answers);
      return;
    }
    setStep((current) => Math.min(current + 1, careerOnboardingQuestions.length - 1));
  };

  const firstName = user.name?.split(' ')[0] || 'there';

  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-white px-4 py-6 text-slate-950 sm:py-8 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(135deg,#020617_0%,#020617_45%,#1d4ed8_100%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute left-0 top-44 h-px w-full bg-blue-200/40" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-5xl flex-col">
        <header className="text-white">
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="samanta-avatar-shell flex-none">
              <span className="samanta-signal samanta-signal-one" aria-hidden="true" />
              <span className="samanta-signal samanta-signal-two" aria-hidden="true" />
              <img
                src="/samanta-ai-assistant.png"
                alt="Samanta, AI career assistant"
                className="samanta-avatar"
              />
            </div>

            <div className="samanta-speech" aria-label="Samanta introduction">
              <p className="text-base font-black text-slate-950">Hi, I am Samanta...</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                I will guide you one choice at a time.
              </p>
            </div>
          </div>

          <p className="mt-4 text-center text-sm font-bold uppercase tracking-[0.18em] text-blue-100">
            Samanta career profile
          </p>
          <h1 className="mx-auto mt-2 max-w-3xl text-center text-3xl font-black tracking-tight sm:text-4xl">
            Hi {firstName}, let us shape your profile one choice at a time.
          </h1>
        </header>

        <form
          className="mx-auto mt-6 flex w-full max-w-4xl flex-1 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-blue-950/10 sm:p-6 lg:p-8"
          onSubmit={(event) => {
            event.preventDefault();
            continueOnboarding();
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">
                Question {step + 1} of {careerOnboardingQuestions.length}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {answeredCount} selected so far
              </p>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded bg-slate-100 sm:w-56"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-valuetext={`${step + 1} of ${careerOnboardingQuestions.length} questions`}
            >
              <div
                className="h-full rounded bg-blue-700 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="onboarding-step mt-7" key={currentQuestion.key}>
            <span className="inline-flex rounded bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
              {currentQuestion.label}
            </span>
            <h2 className="mt-4 max-w-3xl text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {currentQuestion.prompt}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              {currentQuestion.helper}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedAnswer === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => updateAnswer(currentQuestion.key, option.value)}
                    className={[
                      'group min-h-28 rounded-lg border p-4 text-left transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2',
                      isSelected
                        ? 'border-blue-700 bg-blue-50 shadow-md shadow-blue-950/10'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-300 hover:bg-slate-50 hover:shadow-md hover:shadow-slate-900/5',
                    ].join(' ')}
                  >
                    <span className="flex items-start gap-3">
                      <span
                        className={[
                          'mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded border text-sm font-black transition',
                          isSelected
                            ? 'border-blue-700 bg-blue-700 text-white'
                            : 'border-slate-300 bg-white text-transparent group-hover:border-blue-400',
                        ].join(' ')}
                        aria-hidden="true"
                      >
                        {isSelected ? '✓' : ''}
                      </span>
                      <span>
                        <span className="block text-base font-black text-slate-950">
                          {option.title}
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-slate-600">
                          {option.detail}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onSkip}
              className="rounded border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
            >
              Skip for now
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={goToPreviousStep}
                disabled={step === 0}
                className="rounded border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!selectedAnswer}
                className="rounded bg-blue-700 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isLastStep ? 'Complete profile' : 'Next'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};

export default UserOnboarding;
