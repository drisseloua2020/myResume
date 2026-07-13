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

For Render, do not add local development ports to HTTPS public service URLs. Use the browser-visible origins:

```bash
# UI static site / web service
VITE_API_URL=https://myresume-services-04rb.onrender.com

# Backend web service
OAUTH_FRONTEND_URL=https://www.myresumes.net
OAUTH_REDIRECT_BASE_URL=https://myresume-services-04rb.onrender.com
CORS_ORIGINS=https://www.myresumes.net,https://myresumes.net
OAUTH_COOKIE_SECURE=true
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
```

These are wrong in production and will cause Google `403` / `redirect_uri_mismatch` errors:

```bash
OAUTH_FRONTEND_URL=https://myresume-rrcy.onrender.com:4000
OAUTH_REDIRECT_BASE_URL=https://myresume-rrcy.onrender.com:3000
```

Then register this Google Authorized redirect URI:

```text
https://myresume-services-04rb.onrender.com/auth/oauth/google/callback
```

This is the exact `redirect_uri` currently sent by the app. If Google returns `redirect_uri_mismatch`, add or correct this exact value in the same Google OAuth client ID used by `GOOGLE_OAUTH_CLIENT_ID`.

Recommended Google OAuth client settings:

```text
Authorized JavaScript origins:
https://www.myresumes.net
https://myresume-rrcy.onrender.com

Authorized redirect URIs:
https://myresume-services-04rb.onrender.com/auth/oauth/google/callback
```

If the API also gets a custom domain, use that API domain consistently instead:

```bash
VITE_API_URL=https://api.myresumes.net
OAUTH_REDIRECT_BASE_URL=https://api.myresumes.net
```

```text
https://api.myresumes.net/auth/oauth/google/callback
```

In Google Cloud Console, the value under **Authorized redirect URIs** must match the `redirect_uri` exactly, including scheme, host, path, and absence of a port.

If Google has already been configured to redirect to the UI origin, the frontend also supports forwarding this path to the API callback:

```text
https://www.myresumes.net/auth/oauth/google/callback
```

For a Render Static Site, add a rewrite rule for SPA callback paths:

```text
Source: /auth/oauth/*
Destination: /index.html
Action: Rewrite
```
