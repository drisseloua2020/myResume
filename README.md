# ResumeForge

##  Overview
ResumeForge is a full-stack web application for parsing ATS resumes, editing structured resume content, and managing saved resumes.

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

VITE_API_URL=<API_ORIGIN>

---

##  CI/CD

- CI: GitHub Actions (test + build)
- CD: Render auto deploy

---

##  Summary
Modern full-stack app ready for cloud deployment and scaling.


