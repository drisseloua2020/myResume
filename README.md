# MyResumes Career Platform

##  Overview
MyResumes is a full-stack career management platform for building a structured career profile, parsing ATS resumes, editing career assets, analyzing opportunities, and managing saved resumes.

It consists of:
- Frontend: React (TypeScript, Vite)
- Backend: Python (FastAPI)
- Database: PostgreSQL
- Deployment: Render (Web Service + Static Site + Managed DB)
- Infrastructure (optional): Terraform (GCP-ready)

---

##  Architecture

[ React UI ]  --->  [ FastAPI Backend ]  --->  [ PostgreSQL ]
---

##  Project Structure

.
├── services/        # FastAPI backend
├── ui/              # React frontend
├── terraform/       # Infrastructure as Code (optional)
└── README.md

---

##  Deployment (Render)

- UI: Static Site
- Backend: Web Service
- Database: PostgreSQL

---

##  Local Development

### Backend
cd services
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

### Frontend
cd ui
npm install
npm run dev

---

##  Environment Variables

DATABASE_URL=<DATABASE_URL>
JWT_SECRET=<JWT_SECRET>
APP_ENV=development
AI_GATEWAY_ENABLED=false
AI_GATEWAY_PROVIDER=
AI_GATEWAY_URL=

VITE_API_URL=<API_ORIGIN>
VITE_FEATURE_CAREER_OS_EXPERIENCE=false
VITE_FEATURE_CAREER_OS_NAVIGATION=false

---

## Career Intelligence

MyResumes includes deterministic Career Intelligence features with no LLM or agentic-AI API calls by default. It supports ATS scoring against a pasted job description, keyword gap detection, job-description parsing, section-level match reports, bullet quality checks, resume risk/completeness checks, ATS-safe text/DOCX/PDF export payloads, LinkedIn text import, job tracker records, application packets, achievements, resume versions, share-link metadata, data export/delete controls, and a no-LLM feature catalog.

AI usage rule: deterministic/no-LLM operation is the default. A future AI gateway may be used only when `AI_GATEWAY_ENABLED=true` and gateway configuration is present; API keys or gateway URLs alone must not activate AI behavior.

Backend entry points are under `/career/*`; the logged-in frontend tab is **Career Intelligence**.

---

##  CI/CD

- CI: GitHub Actions (test + build)
- CD: Render auto deploy

---

##  Summary
Modern full-stack app ready for cloud deployment and scaling.


