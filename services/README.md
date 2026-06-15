# ResumeForge Services - Production Python Port

This is a second-pass FastAPI conversion of the original TypeScript services. It upgrades the first port with SQLAlchemy 2.0 ORM models, Alembic migrations, stricter Pydantic v2 schemas, pytest coverage, and a cleaner service layout.

## Quick start

```bash
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 3000
```

## Run tests

```bash
pytest
```

## SSO setup

Email/password authentication remains enabled. To enable SSO, create OAuth/OIDC apps with each provider and configure these backend environment variables:

```bash
OAUTH_FRONTEND_URL=http://localhost:4000
OAUTH_REDIRECT_BASE_URL=http://localhost:3000
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
MICROSOFT_OAUTH_CLIENT_ID=...
MICROSOFT_OAUTH_CLIENT_SECRET=...
MICROSOFT_OAUTH_TENANT=common
LINKEDIN_OAUTH_CLIENT_ID=...
LINKEDIN_OAUTH_CLIENT_SECRET=...
```

Register these callback URLs with the matching providers:

```text
http://localhost:3000/auth/oauth/google/callback
http://localhost:3000/auth/oauth/microsoft/callback
http://localhost:3000/auth/oauth/linkedin/callback
```

Use your deployed API origin instead of `http://localhost:3000` in production, and set `OAUTH_COOKIE_SECURE=true` when the callback is served over HTTPS.
