# Production Configuration Template

This document records the production domain, DNS, Render, and Google OAuth configuration pattern without committing environment-specific service identifiers or secrets. Replace every `<PLACEHOLDER>` with the real value in your deployment platform, password manager, or private runbook.

Do not commit OAuth client secrets, API keys, database URLs with credentials, JWT secrets, SMTP passwords, or private Render service identifiers.

Production releases must follow the [main-only deployment policy](docs/deployment-policy.md). Set both production Render services to branch `main` and disable their independent Auto-Deploy when GitHub Actions hooks control releases. Workflow guards alone cannot disable Render's branch-triggered auto-deploys.

Read the [production runbook](docs/production-runbook.md) for secrets rotation, database roles, migrations, private storage, backup/restore and launch evidence. Live profile sync, billing, job discovery/submission and scheduled delivery remain disabled for the core release.

## Placeholders

| Placeholder | Meaning |
| --- | --- |
| `<FRONTEND_ORIGIN>` | Public frontend origin, for example `https://www.example.com` |
| `<ROOT_DOMAIN>` | Root domain, for example `example.com` |
| `<ROOT_ORIGIN>` | Root origin, for example `https://example.com` |
| `<API_ORIGIN>` | Public API origin, for example `https://api.example.com` |
| `<RENDER_FRONTEND_HOST>` | Render-managed frontend hostname shown in the Render dashboard |
| `<RENDER_BACKEND_HOST>` | Render-managed backend hostname shown in the Render dashboard |
| `<RENDER_APEX_A_RECORD>` | Apex/root A record value shown by Render |

## Production Domains

| Purpose | Value |
| --- | --- |
| Frontend app | `<FRONTEND_ORIGIN>` |
| Root domain | `<ROOT_ORIGIN>` |
| Backend API | `<API_ORIGIN>` |
| Render frontend origin | `https://<RENDER_FRONTEND_HOST>` |
| Render backend origin | `https://<RENDER_BACKEND_HOST>` |

Users should open the app from `<FRONTEND_ORIGIN>`. The frontend should call the API through `<API_ORIGIN>`.

## DNS

Do not use domain forwarding with masking for the application domain. Masking can serve a frameset page that embeds the Render app, which breaks OAuth because the browser-visible origin no longer matches the real application context.

Current intended DNS records:

```text
CNAME
Name: www
Value: <RENDER_FRONTEND_HOST>
```

```text
A
Name: @
Value: <RENDER_APEX_A_RECORD>
```

```text
CNAME
Name: api
Value: <RENDER_BACKEND_HOST>
```

Remove stale forwarding, parking, masking, or provider-managed records that conflict with these values. If root forwarding is used, use a normal redirect to `<FRONTEND_ORIGIN>`, not masking.

## Render Custom Domains

Frontend Render static site / web service:

```text
www.<ROOT_DOMAIN>
<ROOT_DOMAIN>
```

Backend Render web service:

```text
api.<ROOT_DOMAIN>
```

Render must show the custom domains as verified/active before OAuth testing. A `404 Not Found` from `<FRONTEND_ORIGIN>/` while the Render-provided frontend URL works usually means the custom domain is not attached to the frontend Render service yet.

## Render Environment Variables

Backend service:

```text
APP_ENV=production
DATABASE_URL=<POSTGRES_RUNTIME_URL>
JWT_SECRET=<RANDOM_SECRET_AT_LEAST_32_CHARACTERS>
OAUTH_FRONTEND_URL=<FRONTEND_ORIGIN>
OAUTH_REDIRECT_BASE_URL=<API_ORIGIN>
CORS_ORIGINS=<FRONTEND_ORIGIN>,<ROOT_ORIGIN>
OAUTH_COOKIE_SECURE=true
```

Frontend static service (build time):

```text
VITE_API_URL=<API_ORIGIN>
```

After changing `VITE_API_URL`, redeploy/rebuild the frontend because Vite bakes environment variables into the compiled bundle.

If users also open the existing Render UI directly, include its origin in the **backend** service's environment:

```text
CORS_ORIGINS=https://myresumes.net,https://www.myresumes.net,https://myresume-rrcy.onrender.com
```

Restart/redeploy the API after changing this setting. `INCLUDE_LEGACY_FRONTEND_ALIASES=true` (default) preserves these exact three aliases when at least one is configured; no other Render hosts are trusted. Set it to `false` when only the explicitly listed origins should be accepted. Custom deployments on unrelated domains are not expanded.

An `OPTIONS /auth/login` response of `400 Disallowed CORS origin` blocks the browser before credential validation. It is not evidence that the database password is incorrect. Verify preflight independently of login:

```powershell
$headers = @{
  Origin = 'https://myresume-rrcy.onrender.com'
  'Access-Control-Request-Method' = 'POST'
  'Access-Control-Request-Headers' = 'content-type'
}
Invoke-WebRequest -Method Options -Uri 'https://api.myresumes.net/auth/login' -Headers $headers
```

Expect 200 and `Access-Control-Allow-Origin` matching the requested origin. Do not add `*`, remove authentication, or reset passwords to work around a preflight failure.

If preflight succeeds but the login POST returns 500 without that header, the browser is masking a backend exception. Check API logs and `/ready`, then run `python -m app.db.diagnostics --auth-summary` in the API hosting shell. See [upgrade/login recovery](docs/production-runbook.md#login-fails-after-upgrade) for connection failures, missing `users.token_version` and safe migration steps. Never drop/recreate existing users to resolve this.

For the UI Docker image, use runtime `API_PUBLIC_URL=<API_ORIGIN>` instead. With a same-origin proxy use `API_PUBLIC_URL=/api` and `API_UPSTREAM=<PRIVATE_API_ORIGIN>`. Restart the container after changing these values; no frontend rebuild is needed. These settings are public configuration, not a place for credentials.

Secrets must stay outside Git. Store these in Render environment variables or a secret manager, not in documentation:

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
JWT_SECRET
DATABASE_URL
```

## Google OAuth Client

Use the same Google OAuth client ID that is configured in the backend as `GOOGLE_OAUTH_CLIENT_ID`. Do not commit the client secret.

Authorized JavaScript origins:

```text
<ROOT_ORIGIN>
<FRONTEND_ORIGIN>
```

Authorized redirect URI:

```text
<API_ORIGIN>/auth/oauth/google/callback
```

OAuth consent / Branding:

```text
App homepage: <FRONTEND_ORIGIN>
Authorized domain: <ROOT_DOMAIN>
```

If the app is still in Google OAuth testing mode, add the signing-in Google account under test users.

## Verification Commands

Check frontend DNS:

```powershell
Resolve-DnsName www.<ROOT_DOMAIN>
```

Expected direction:

```text
www.<ROOT_DOMAIN> -> <RENDER_FRONTEND_HOST>
```

Check root DNS:

```powershell
Resolve-DnsName <ROOT_DOMAIN>
```

Expected result should include the Render apex/root record shown in the Render dashboard.

Check frontend response:

```powershell
curl.exe -I <FRONTEND_ORIGIN>/
```

Expected result:

```text
HTTP/1.1 200 OK
```

The response body should be the React app HTML and should not contain:

```html
<frameset>
```

Check API health:

```powershell
curl.exe <API_ORIGIN>/health
curl.exe <API_ORIGIN>/ready
```

Expected result:

```json
{"status":"ok"}
```

Check OAuth diagnostics:

```powershell
curl.exe <API_ORIGIN>/auth/oauth/google/diagnostics
```

Expected important values:

```json
{
  "redirectUri": "<API_ORIGIN>/auth/oauth/google/callback",
  "frontendRedirectBaseUrl": "<FRONTEND_ORIGIN>",
  "googleAuthorizedRedirectUri": "<API_ORIGIN>/auth/oauth/google/callback"
}
```

## Troubleshooting Notes

- If `<FRONTEND_ORIGIN>/` returns a `<frameset>`, forwarding with masking is still active.
- If `<FRONTEND_ORIGIN>/` returns Render `404 Not Found`, DNS is reaching Render but the custom domain is not verified/attached to the frontend service.
- If Google shows `403 Forbidden` before returning to the app, check OAuth consent publishing/test-user status and confirm the exact redirect URI is registered.
- If Google shows `redirect_uri_mismatch`, the Google OAuth client does not contain the exact callback URI used by the backend.
- If the frontend still calls an old API domain, redeploy the frontend after setting `VITE_API_URL=<API_ORIGIN>`.
- If using the UI image, check its generated `/runtime-config.js` and restart with the intended `API_PUBLIC_URL` instead.
