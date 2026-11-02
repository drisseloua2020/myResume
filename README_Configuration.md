# Production Configuration Template

This document records the production domain, DNS, Render, and Google OAuth configuration pattern without committing environment-specific service identifiers or secrets. Replace every `<PLACEHOLDER>` with the real value in your deployment platform, password manager, or private runbook.

Do not commit OAuth client secrets, API keys, database URLs with credentials, JWT secrets, SMTP passwords, or private Render service identifiers.

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
OAUTH_FRONTEND_URL=<FRONTEND_ORIGIN>
OAUTH_REDIRECT_BASE_URL=<API_ORIGIN>
CORS_ORIGINS=<FRONTEND_ORIGIN>,<ROOT_ORIGIN>
OAUTH_COOKIE_SECURE=true
```

Frontend service:

```text
VITE_API_URL=<API_ORIGIN>
```

After changing `VITE_API_URL`, redeploy/rebuild the frontend because Vite bakes environment variables into the compiled bundle.

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
