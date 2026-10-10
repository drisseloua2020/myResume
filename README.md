# ResumeForge / MyResume

ResumeForge, surfaced in the UI as MyResume, is a full-stack resume and career workspace. It lets users import ATS-friendly resumes, edit structured resume content, generate deterministic cover-letter and career artifacts, track job applications, manage profile sources, and administer users, resumes, messages, and activity logs.

The application is intentionally built around deterministic backend logic. Resume parsing, ATS scoring, career analysis, exports, and cover-letter generation are implemented in local Python services and do not depend on LLM or agentic-AI API calls.

## Table of Contents

- [What This App Does](#what-this-app-does)
- [Architecture](#architecture)
- [Repository Layout](#repository-layout)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Database and Migrations](#database-and-migrations)
- [Core Features](#core-features)
- [API Surface](#api-surface)
- [Testing](#testing)
- [Docker](#docker)
- [CI/CD and Deployment](#cicd-and-deployment)
- [Security and Privacy Notes](#security-and-privacy-notes)
- [Troubleshooting](#troubleshooting)

## What This App Does

ResumeForge is a career operating system centered on structured resume data:

- Import PDF, DOC, and DOCX resumes through an ATS-aware parser.
- Normalize uploaded resumes into editable JSON fields.
- Save resumes, drafts, versions, shares, and export payloads.
- Render multiple resume templates from one structured content model.
- Generate cover letters from deterministic scripts and stored resume context.
- Score resumes against job descriptions with keyword gaps, risk checks, section-level reporting, and bullet-quality feedback.
- Track jobs, packets, reminders, achievements, and saved application answers.
- Manage onboarding answers and generate profile/category analysis.
- Sync profile-source placeholders and review generated updates.
- Support email/password auth plus OAuth callback plumbing for Google, Microsoft, and LinkedIn.
- Provide admin views for users, resumes, activity logs, agent updates, contact messages, templates, and profile sources.

## Architecture

```mermaid
flowchart LR
    Browser[React + Vite UI] -->|JSON, JWT auth| API[FastAPI backend]
    API --> DB[(SQL database)]
    API --> Parser[Deterministic resume parser]
    API --> Career[Deterministic career tools]
    API --> Uploads[Protected uploads]
    API --> Mailer[SMTP support email]
```

The frontend stores only session state and editor state in the browser. Durable career data is owned by the backend and persisted in relational tables, with resume content stored as JSON so the editor can preserve a flexible document shape.

### Runtime Flow

1. The user signs up or logs in through `/auth/*`.
2. The React app stores the JWT in `localStorage` and sends it as a bearer token.
3. Resume imports call `POST /resumes/parse-upload` with base64 document bytes.
4. The backend extracts text, validates or normalizes ATS sections, and returns structured parser JSON.
5. The UI maps parser JSON into editor JSON and saves it with `POST /resumes` plus draft autosaves through `POST /resumes/draft`.
6. Career Toolkit actions call `/career/*` endpoints using the saved resume JSON and pasted job descriptions.
7. Admin-only routes under `/admin/*` use role checks before returning operational data.

For a deeper resume-import walkthrough, see [docs/resume-import-data-flow.md](docs/resume-import-data-flow.md).

## Repository Layout

```text
.
|-- services/                 FastAPI backend, SQLAlchemy models, Alembic migrations
|   |-- app/
|   |   |-- api/routes/        Auth, resumes, career, cover letters, admin, uploads
|   |   |-- core/              Settings, security, enums
|   |   |-- db/                Engine/session setup
|   |   |-- models/            SQLAlchemy entities
|   |   |-- schemas/           Pydantic request/response models
|   |   `-- services/          Parser, career tools, OAuth, mailer, activity helpers
|   |-- alembic/               Database migration history
|   |-- tests/                 Pytest suite
|   |-- Dockerfile             Backend container
|   `-- openapi.yaml           API contract snapshot
|-- ui/                        React 19 + TypeScript + Vite frontend
|   |-- components/            Product pages, editor, admin screens, workflows
|   |-- services/              API clients and frontend service wrappers
|   |-- utils/                 Resume import helpers
|   |-- public/                Static UI assets
|   `-- Dockerfile             Frontend Nginx container
|-- docs/                      Technical documentation
|-- examples/                  Sample ATS resume documents
|-- postman/                   Local API collection and environment
|-- ux_proposals/              Design proposal artifacts and screenshots
|-- .github/workflows/         CI, tests, security checks, image build, Render deploy
|-- README_Configuration.md    Production DNS, Render, and OAuth configuration template
`-- MANUAL_TEST_PLAN.md        Manual QA checklist
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Vitest, Testing Library |
| Backend | Python 3.13-ready FastAPI, Starlette, Uvicorn |
| Data | SQLAlchemy 2, Alembic, SQLite for simple local use, PostgreSQL for production-like deployments |
| Auth | JWT, Argon2 password hashing, OAuth callback support |
| Documents | PDF/DOC/DOCX resume import support via backend parser utilities |
| Export | Browser-side PDF tooling plus backend ATS-safe export payloads |
| Deployment | Render static/web services, Docker, GitHub Actions |

## Local Development

### Prerequisites

- Python 3.13 or a compatible Python 3 version for the backend.
- Node.js 20+ for the frontend.
- PostgreSQL if you want production-like local development. SQLite works with the default backend configuration.

### 1. Clone and Enter the Repo

```bash
git clone <repo-url>
cd myResume
```

### 2. Start the Backend

From the repository root:

```bash
cd services
python -m venv .venv
```

Activate the virtual environment:

```powershell
.\.venv\Scripts\Activate.ps1
```

On macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies and run migrations:

```bash
pip install -r requirements.txt
alembic upgrade head
```

Start the API on port `3000`:

```bash
uvicorn app.main:app --reload --port 3000
```

Health check:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok"}
```

### 3. Start the Frontend

In a second terminal:

```bash
cd ui
npm install
npm run dev
```

The Vite dev server is configured for:

```text
http://localhost:4000
```

The frontend API client defaults to `http://localhost:3000`. To override it, create `ui/.env.local`:

```text
VITE_API_URL=http://localhost:3000
```

Vite bakes `VITE_*` variables into the built bundle, so restart/rebuild the UI after changing them.

## Environment Variables

The backend reads `.env` from the `services/` working directory via Pydantic settings.

### Backend Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` | Runtime mode: `development`, `test`, or `production`. |
| `DATABASE_URL` | `sqlite+pysqlite:///./app.db` | SQLAlchemy database URL. Use PostgreSQL in production. |
| `JWT_SECRET` | `change-me` | Signing secret for JWT auth. Must be changed outside local throwaway use. |
| `JWT_EXPIRES_IN` | `15m` | Token lifetime string used by auth helpers. |
| `PORT` | `3000` in settings, container defaults to `10000` | API port, depending on runner. |
| `CORS_ORIGINS` | Localhost plus deployed origins | Comma-separated allowed frontend origins. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Empty | Optional contact-message reply email transport. |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Empty / `admin@myresume.net` | Optional support email credentials and sender. |
| `UPLOAD_DIR` | `protected_uploads` | Private upload storage root. |
| `UPLOAD_URL_PREFIX` | `/uploads` | URL prefix for protected uploaded assets. |
| `MAX_PROFILE_PHOTO_BYTES` | `5242880` | Profile photo size limit. |
| `OAUTH_FRONTEND_URL` | `http://localhost:4000` | Frontend redirect target after OAuth. |
| `OAUTH_REDIRECT_BASE_URL` | Empty | Public backend origin for OAuth callbacks. |
| `OAUTH_COOKIE_SECURE` | `false` | Set `true` when OAuth callback is served over HTTPS. |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Empty | Google OAuth credentials. |
| `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET` | Empty | Microsoft OAuth credentials. |
| `MICROSOFT_OAUTH_TENANT` | `common` | Microsoft tenant selector. |
| `LINKEDIN_OAUTH_CLIENT_ID` / `LINKEDIN_OAUTH_CLIENT_SECRET` | Empty | LinkedIn OAuth credentials. |

Example `services/.env` for local SQLite:

```text
APP_ENV=development
DATABASE_URL=sqlite+pysqlite:///./app.db
JWT_SECRET=replace-with-a-long-local-secret
CORS_ORIGINS=http://localhost:4000,http://127.0.0.1:4000
OAUTH_FRONTEND_URL=http://localhost:4000
OAUTH_REDIRECT_BASE_URL=http://localhost:3000
```

Example PostgreSQL URL:

```text
DATABASE_URL=postgresql+psycopg://app_user:app_password@localhost:5432/myresumes
```

### Frontend Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:3000` | Backend API origin used by the UI service clients. |

## Database and Migrations

Alembic migrations live in `services/alembic/versions`.

Common commands from `services/`:

```bash
alembic upgrade head
alembic current
alembic history
```

Important persisted entities include:

- `users` and `oauth_accounts`
- `activity_logs`
- `resumes` and `resume_drafts`
- `cover_letters`
- `career_onboarding_profiles`
- `career_profile_analyses`
- `job_applications`
- `achievements`
- `resume_versions`
- `resume_shares`
- `data_sources`, `profile_sync_updates`, and `profile_sources_catalog`
- `agent_updates`
- `contact_messages`

Resume editor content is stored as JSON in `resumes.content` and `resume_drafts.content`. This keeps the editor flexible while still letting the backend own persistence, auth, and audit events.

## Core Features

### Resume Workspace

- Multi-template resume builder with template IDs such as `classic_pro`, `modern_tech`, `ats_single_column`, `data_science`, `product_manager`, `academic_cv`, and more.
- Structured editor fields for personal details, target role, job details, experience, education, certifications, skills, additional sections, preferences, and profile media.
- Latest resume loading, library browsing, edit flows, draft autosave, and protected profile-photo upload.

### ATS Resume Import

- Accepts PDF, DOC, and DOCX documents.
- Sends base64 document payloads to the backend rather than raw browser `File` objects.
- Extracts readable text, validates ATS structure, and normalizes non-ATS text into canonical sections when possible.
- Returns warnings, confidence data, document metadata, and an ATS report for import diagnostics.
- Maps parser output into the same editor JSON used by manually created resumes.

### Career Toolkit

The `/career/*` backend module supports deterministic career workflows:

- Resume-to-job analysis and ATS scoring.
- Keyword gap detection.
- Job-description parsing.
- Section-level match reports.
- Bullet quality checks.
- Resume risk/completeness checks.
- ATS-safe text/DOCX/PDF export payloads.
- LinkedIn profile text import.
- Job tracker records.
- Application packet metadata.
- Achievement library.
- Resume versioning and restore.
- Share-link metadata with PII redaction flags.
- User data export and career-data deletion.
- No-LLM feature catalog.

### Cover Letters

Cover-letter routes generate and store deterministic cover-letter records tied to authenticated users. Stored letters can be listed, fetched, exported as PDF, and deleted.

### Profile Sync and Agent Review

Profile and agent routes model connected career sources and reviewable updates. Current local behavior uses deterministic/mock update generation rather than external automation.

### Admin Console

Admin-only views and routes include:

- Users and plans.
- Activity logs.
- Saved resumes.
- Contact messages and reply handling.
- Agent updates.
- Template catalog.
- Profile source catalog and toggles.

## API Surface

The backend OpenAPI app title is `ResumeForge API - Python`, version `2.0.0`.

### Health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Runtime health check. |

### Auth

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/signup` | Create an email/password user and return a JWT. |
| `POST` | `/auth/login` | Authenticate and return a JWT. |
| `GET` | `/auth/me` | Return the current user. |
| `POST` | `/auth/logout` | Client-friendly logout acknowledgement. |
| `PATCH` | `/auth/me/plan` | Select the current user's plan. |
| `POST` | `/auth/activity` | Record an authenticated activity event. |
| `POST` | `/auth/contact` | Store a contact/support message. |
| `GET` | `/auth/oauth/{provider}/start` | Start OAuth for supported providers. |
| `GET` | `/auth/oauth/{provider}/callback` | OAuth callback endpoint. |
| `GET` | `/auth/oauth/{provider}/diagnostics` | Inspect computed OAuth redirect values. |

### Resumes

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/resumes/` | Create a saved resume. |
| `GET` | `/resumes/` | List current user's resume summaries. |
| `GET` | `/resumes/latest` | Fetch current user's latest full resume. |
| `POST` | `/resumes/draft` | Save or update the latest draft for a template. |
| `GET` | `/resumes/latest-draft` | Fetch latest draft, optionally by template. |
| `POST` | `/resumes/parse-upload` | Parse uploaded PDF/DOC/DOCX resume data. |
| `GET` | `/resumes/{resume_id}` | Fetch one full resume. |
| `PUT` | `/resumes/{resume_id}` | Update title, template, or content. |
| `DELETE` | `/resumes/{resume_id}` | Delete a resume. |

### Career Toolkit

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` / `PUT` | `/career/onboarding-profile` | Read or save onboarding questionnaire answers. |
| `GET` / `POST` | `/career/profile-analysis` | Read or generate deterministic profile analysis. |
| `POST` | `/career/analyze` | Analyze resume JSON against a job description. |
| `POST` | `/career/exports/resume` | Create ATS-safe export payloads. |
| `POST` | `/career/import/linkedin` | Import pasted LinkedIn profile text. |
| `GET` | `/career/features` | Return the no-LLM feature catalog. |
| `POST` / `GET` | `/career/jobs` | Create and list job tracker records. |
| `PATCH` / `DELETE` | `/career/jobs/{job_id}` | Update or delete a job tracker record. |
| `GET` | `/career/jobs/analytics` | Summarize job tracker analytics. |
| `POST` / `GET` | `/career/achievements` | Create and list achievements. |
| `POST` / `GET` | `/career/resume-versions` | Create and list resume versions. |
| `POST` | `/career/resume-versions/{version_id}/restore` | Restore a stored version to a resume. |
| `POST` | `/career/shares` | Create share metadata for a resume. |
| `GET` | `/career/data-export` | Export current user's career-toolkit data. |
| `DELETE` | `/career/data` | Delete current user's career-toolkit data. |

### Cover Letters, Profile, Agent, Uploads, Admin

| Area | Paths |
| --- | --- |
| Cover letters | `/cover-letters/generate`, `/cover-letters/`, `/cover-letters/{id}`, `/cover-letters/{id}/pdf` |
| Profile sync | `/profile/updates`, `/profile/sources`, `/profile/sources/{source}/connect`, `/profile/sync` |
| Agent review | `/agent/sources`, `/agent/sources/{source_id}/toggle`, `/agent/check`, `/agent/updates`, `/agent/generate-resume` |
| Uploads | `/uploads/profile-photo`, `/uploads/profile-photo/{filename}`, `/uploads/profile-photos/{user_id}/{filename}` |
| Admin | `/admin/users`, `/admin/activity-logs`, `/admin/templates`, `/admin/profile-sources`, `/admin/contact-messages`, `/admin/resumes`, `/admin/agent-updates` |

For request/response details, run the backend and open:

```text
http://localhost:3000/docs
```

## Testing

### Backend

Run from `services/`:

```bash
pytest
```

The backend tests cover authentication, resume persistence, resume imports, career toolkit behavior, cover-letter job-source handling, agent import compatibility, and Postman-style E2E checks.

### Frontend

Run from `ui/`:

```bash
npm test
```

The UI tests use Vitest and Testing Library and cover key components and service behavior such as OAuth redirects, resume input, templates, library flows, cover letters, onboarding, and career pages.

### Manual QA

Use [MANUAL_TEST_PLAN.md](MANUAL_TEST_PLAN.md) for end-to-end product checks.

Useful manual smoke path:

1. Start backend on `http://localhost:3000`.
2. Start frontend on `http://localhost:4000`.
3. Sign up with a local test user.
4. Import one sample from `examples/`.
5. Confirm the editor is hydrated.
6. Save the resume.
7. Open the resume library and reload the saved resume.
8. Paste a job description into Career Toolkit and run analysis.

## Docker

### Backend Image

From `services/`:

```bash
docker build -t resumeforge-api .
docker run --rm -p 3000:10000 -e PORT=10000 -e JWT_SECRET=local-dev-secret resumeforge-api
```

Add `DATABASE_URL` if you want PostgreSQL instead of the default SQLite database inside the container.

### Frontend Image

From `ui/`:

```bash
docker build -t resumeforge-ui .
docker run --rm -p 4000:8080 -e PORT=8080 resumeforge-ui
```

The frontend image serves the built Vite app with Nginx.

### Compose Notes

There are compose files under `services/` and `services/docker/`. Treat them as local/deployment scaffolding and replace any committed example credentials before use. New secrets should live in private environment files, Render settings, or a secret manager, not in Git.

## CI/CD and Deployment

GitHub Actions are split into reusable workflow pieces:

- `deploy-setup.yml`
- `deploy-backend-e2e.yml`
- `deploy-ui.yml`
- `deploy-appsec.yml`
- `deploy-images.yml`
- `deploy-render.yml`

The top-level `CI-CD` workflow runs on pushes to `main`, `stage`, and version tags. It performs setup, backend E2E tests, UI tests, appsec checks, image versioning, and branch deployments through Render deploy hooks.

Production configuration details are documented in [README_Configuration.md](README_Configuration.md), including:

- Render frontend/backend domain mapping.
- DNS records.
- OAuth redirect URIs.
- CORS settings.
- Verification commands.
- Common `redirect_uri_mismatch` and domain-masking failures.

Minimum production environment:

```text
Backend:
DATABASE_URL=<postgres-url>
JWT_SECRET=<long-random-secret>
CORS_ORIGINS=<frontend-origin>,<root-origin>
OAUTH_FRONTEND_URL=<frontend-origin>
OAUTH_REDIRECT_BASE_URL=<api-origin>
OAUTH_COOKIE_SECURE=true

Frontend:
VITE_API_URL=<api-origin>
```

## Security and Privacy Notes

- Do not commit `.env` files, OAuth client secrets, SMTP passwords, JWT secrets, private Render deploy hooks, or database URLs with credentials.
- Replace the default `JWT_SECRET` for any shared, staged, or production environment.
- The backend stores profile photos under `UPLOAD_DIR` and serves them only through authenticated routes.
- CORS should be restricted to browser-visible frontend origins.
- OAuth redirect URIs must match the provider configuration exactly, including scheme, host, path, and absence or presence of ports.
- Career Toolkit features are deterministic and expose a no-LLM feature catalog through `/career/features`.
- `/career/data-export` and `/career/data` support user-facing data portability and deletion for career-toolkit records.

## Troubleshooting

### Frontend Cannot Reach Backend

Check that:

- Backend is running on `http://localhost:3000`.
- `ui/.env.local` points `VITE_API_URL` at the backend if you changed ports.
- You restarted Vite after changing `VITE_API_URL`.
- `CORS_ORIGINS` includes `http://localhost:4000`.

### Login Works, Then Requests Fail

The frontend clears local session state when an API request returns `401`. Check:

- `JWT_SECRET` is stable between backend restarts.
- The token has not expired.
- Browser local storage does not contain an old token from another environment.

### Alembic Cannot Connect

Check:

- `DATABASE_URL` is visible in the `services/` shell.
- PostgreSQL is running if you are using a PostgreSQL URL.
- The URL uses the SQLAlchemy driver form, for example `postgresql+psycopg://...`.

### OAuth Redirect Errors

Use:

```text
http://localhost:3000/auth/oauth/google/diagnostics
```

or the matching deployed API URL to inspect the redirect URI the backend is actually sending. That exact URI must exist in the OAuth provider configuration.

### Resume Import Produces Empty Sections

Try a different source document from `examples/`, then inspect:

- `warnings`
- `confidence`
- `document.textExtracted`
- `document.normalizedToAts`
- `atsReport.sectionsDetected`

The parser can normalize readable text, but scanned image-only documents may need OCR before import.

## Useful Links Inside This Repo

- [Production configuration template](README_Configuration.md)
- [Manual test plan](MANUAL_TEST_PLAN.md)
- [ATS resume import data flow](docs/resume-import-data-flow.md)
- [Postman collection notes](postman/README.md)
- [Backend README](services/README.md)
- [Frontend README](ui/README.md)
