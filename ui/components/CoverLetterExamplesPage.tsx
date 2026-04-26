import React, { useMemo, useState } from 'react';

type Props = {
  onBack: () => void;
};

type Example = {
  title: string;
  forRole: string;
  body: string;
};

const EXAMPLES: Example[] = [
  {
    title: 'Entry-Level Software Engineer',
    forRole: 'Software Engineer',
    body: `Dear Hiring Manager,\n\nI’m excited to apply for the Software Engineer role at ...\n\nIn my recent project, I built ... (impact, metrics) ...\n\nI’d love to bring my skills in ... to help your team ...\n\nSincerely,\nYour Name`,
  },
  {
    title: 'Senior Backend Engineer',
    forRole: 'Backend Engineer',
    body: `Dear Hiring Manager,\n\nI’m applying for the Senior Backend Engineer role at ...\n\nOver the past ... years, I’ve led ... (systems, scale, reliability) ...\n\nHighlights include: \n- ...\n- ...\n\nI’d welcome the chance to discuss how I can help ...\n\nBest,\nYour Name`,
  },
  {
    title: 'Data Analyst',
    forRole: 'Data Analyst',
    body: `Dear Hiring Manager,\n\nI’m applying for the Data Analyst role at ...\n\nI specialize in turning messy data into clear decisions using SQL, dashboards, and experiments. Recently, I ... (impact) ...\n\nI’m excited by your focus on ... and would love to contribute.\n\nSincerely,\nYour Name`,
  },
  {
    title: 'Product Manager',
    forRole: 'Product Manager',
    body: `Dear Hiring Manager,\n\nI’m thrilled to apply for the Product Manager role at ...\n\nI’ve shipped products from discovery to launch by aligning stakeholders, defining success metrics, and iterating quickly. In my last role, I ... (impact) ...\n\nI’d love to help your team ...\n\nBest regards,\nYour Name`,
  },
  {
    title: 'Customer Success Manager',
    forRole: 'Customer Success',
    body: `Dear Hiring Manager,\n\nI’m applying for the Customer Success Manager role at ...\n\nI’ve helped teams improve retention and expansion by building playbooks, running QBRs, and partnering closely with product. Recently, I ... (impact) ...\n\nI’d love to bring that approach to ...\n\nSincerely,\nYour Name`,
  },
  {
    title: 'Marketing Specialist',
    forRole: 'Marketing',
    body: `Dear Hiring Manager,\n\nI’m excited to apply for the Marketing Specialist role at ...\n\nI build campaigns that connect messaging to measurable results. In my last campaign, I ... (impact) ...\n\nI’d love to contribute to your growth goals at ...\n\nBest,\nYour Name`,
  },
];

export default function CoverLetterExamplesPage({ onBack }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EXAMPLES;
    return EXAMPLES.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.forRole.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q)
    );
  }, [query]);

  function downloadExample(ex: Example) {
    const blob = new Blob([ex.body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ex.title.replace(/[^a-z0-9_-]+/gi, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <div className="flex items-center justify-between gap-4">
        <button onClick={onBack} className="text-sm text-slate-600 hover:text-slate-900">← Back to Cover Letters</button>
        <div className="w-full max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search examples (role, title, keywords)…"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-6">
        <h1 className="text-2xl font-bold text-slate-900">Cover Letter Examples</h1>
        <p className="mt-2 text-slate-600">
          Use these as inspiration for structure and tone. Replace placeholders and tailor to each job.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtered.map((ex) => (
          <div key={ex.title} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">{ex.title}</div>
                <div className="text-xs text-slate-600">Best for: {ex.forRole}</div>
              </div>
              <button
                onClick={() => downloadExample(ex)}
                className="px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 text-sm"
              >
                Download
              </button>
            </div>
            <div className="p-5">
              <div className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">{ex.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
