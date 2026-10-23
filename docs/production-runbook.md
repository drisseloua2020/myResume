# Production Deployment Runbook

This runbook describes required operator actions. It is not evidence that a live environment has been configured or deployed.

## Release Boundaries

The core release supports a free resume workspace, deterministic imports and analysis, text PDF/DOCX/TXT export, cover letters, manual job tracking, local packet preparation and human review. Approved packets are not submitted externally. Profile synchronization, job-board discovery, billing and scheduled email reminders remain unavailable.

Development/test environments may enable the [mock-provider sandbox](mock-providers.md) to mimic provider operations using synthetic data. `MOCK_PROVIDERS_ENABLED` defaults to false and must remain false in production; startup rejects it otherwise. This does not remove any live-integration release gate.

PDF export is an ATS-oriented text layout, not a pixel-identical export of every preview template. Unsupported font characters return a clear error; TXT/DOCX remain alternatives. Review free-text content before publishing a redacted text share. Shares are live views of saved resumes, expire after 30 days, and can be revoked.

## Secrets and Configuration

1. Rotate database credentials previously committed in Compose files. Removing their current values does not remove Git history or revoke old credentials. Review provider access logs. Rotate any reused passwords too.
2. Create separate development, staging and production secrets. Do not commit real `.env` files or put secrets in frontend configuration.
3. Set `APP_ENV=production`, a random `JWT_SECRET` of at least 32 characters, PostgreSQL `DATABASE_URL`, explicit HTTPS-only `CORS_ORIGINS`, `OAUTH_FRONTEND_URL`, and `OAUTH_COOKIE_SECURE=true`. Use TLS-verified database connections, preferably `sslmode=verify-full` with the provider CA.
4. Set `FORWARDED_ALLOW_IPS` to the actual trusted reverse proxy IPs/CIDRs. Never use `*`. The API rate limiter must see the genuine client address. Add distributed rate limits at the gateway across all API workers; the application limiter is per process.
5. Mount durable private storage at `UPLOAD_DIR` (`/data/protected_uploads` in the API image). Keep it outside the web root. Back it up with the database; do not bake uploads into images.
6. Configure SMTP with verified sender identity and credentials. Non-SSL SMTP requires successful STARTTLS; plaintext fallback is refused. Password recovery and support replies require a working mail service.
7. Configure OAuth client IDs/secrets and exact provider redirect URIs only for enabled sign-in providers. Test verified-email behavior with each real provider. OAuth identity sign-in is not a career-profile connector.

For the frontend image, set `API_PUBLIC_URL` to `/api` for the same-origin proxy, or an HTTPS API origin. Set `API_UPSTREAM` to the reachable API service origin for the proxy. The startup script writes non-secret runtime configuration. A static-host build can instead set `VITE_API_URL` at build time. Unconfigured production builds no longer point to a visitor's localhost.

List every browser-visible frontend origin in `CORS_ORIGINS`, including the existing Render UI if users access it directly. By default, `INCLUDE_LEGACY_FRONTEND_ALIASES` preserves the exact MyResumes apex/www/Render aliases when one is configured; set false for strict explicit-only behavior. Unrelated/custom deployments are not expanded. Test anonymous login preflights for each supported origin after deployment. A 400 `Disallowed CORS origin` means the login handler has not evaluated credentials; see [configuration troubleshooting](../README_Configuration.md).

## Database Roles and the Public Schema Error

`NOTICE: table ... does not exist, skipping` is informational. SQLSTATE `42501` on `CREATE TABLE public...` means the restoring/migration role lacks schema permission. Run DDL through a dedicated migration role, not the API runtime account.

Example provisioning, performed by a database administrator and adapted to the actual database and role names:

```sql
CREATE ROLE myresume_migrator LOGIN;
CREATE ROLE myresume_runtime LOGIN;
CREATE DATABASE myresume OWNER myresume_migrator;
-- Connect to myresume before the following schema grants.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO myresume_migrator;
GRANT USAGE ON SCHEMA public TO myresume_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO myresume_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO myresume_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE myresume_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO myresume_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE myresume_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO myresume_runtime;
```

Set passwords through the provider secret-management flow or an interactive administration client, not checked-in SQL. Restrict database network access and verify the runtime role cannot create/drop tables. Default grants apply only to objects created by the named migration role. Existing objects owned by a different role require an ownership/grant review before migration.

The old pasted dump predates several career tables and migration metadata. Do not run its `DROP TABLE` statements over a live application database. For a fresh environment, create the complete schema with Alembic, then migrate compatible data separately. For an existing pre-Alembic database, compare its actual schema with the migration baseline before deciding whether it can be stamped. Never stamp `head` to conceal missing tables.

## Reproducible Build and Migration

Use Python 3.13 and Node 24. Production dependencies are in `services/requirements.lock`; test dependencies are in `services/requirements-dev.lock`. Both contain exact versions and hashes. `requirements.txt` and `requirements-dev.in` are resolver inputs, not release installation targets.

```powershell
cd services
python -m pip install --require-hashes -r requirements-dev.lock
python -m alembic upgrade head
python -m alembic check
```

Run migrations as a single pre-deploy job using the migration credential. Start the API afterward with the restricted runtime credential. The canonical Compose file supplies a separate migration service for local validation. Its database credentials must point to its `db` host, not localhost. Legacy Compose entry points include the canonical file; Dockerfiles under those legacy folders were removed. Use the root service Dockerfile.

The current required revision is `0007_mock_provider_operations`. Migration `0005_sessions_and_drafts` is forward-only because merging distinct drafts would lose data. Rollback means redeploying a compatible application image or restoring a verified backup into a replacement database, not dropping columns on live data.

## Release Gates

- Backend tests, UI tests, TypeScript check, production build and dependency audits must pass on the locked dependencies.
- Run PostgreSQL 16 migration and `alembic check` in CI. Run a representative application smoke test against a disposable PostgreSQL database too. SQLite unit tests do not prove PostgreSQL behavior.
- Validate the built images, non-root filesystem permissions, private upload persistence, runtime API configuration, proxy headers, CORS, CSP and HTTPS in staging.
- Protect the GitHub `production` environment with required reviewers. Only pushes to `main` trigger the production hook workflow; PRs never publish images or deploy. Configure an independent staging deployment deliberately.
- Render hooks report request acceptance only. Configure commit/image pinning, deploy-status polling, authenticated smoke checks, readiness checks and rollback automation in the actual hosting environment. A successful HTTP hook response is not a proven deployment.
- Test real OAuth, password-reset email, support replies and expired/replayed sessions using non-production accounts. Passwords require at least 12 characters. Email ownership verification and email-address changes are not yet implemented; decide whether these are required before opening registration.
- Load-test imports, exports and account-data export with realistic data sizes. Set CPU/memory/process limits, an overall request deadline, worker concurrency and network egress restrictions. Current file/page/ZIP limits are defense in depth, not a process sandbox for hostile PDFs.
- Confirm public shares are disabled/private by default, redaction matches the intended privacy policy, revoked links return 404, and deletion covers the private storage mount.

## Backup and Recovery

Define an owner, recovery-point objective, recovery-time objective and retention schedule before launch. Enable managed PostgreSQL point-in-time recovery where available. Keep encrypted, access-controlled backups in a separate failure domain. Back up private profile photos as well as the database. Restrict backup credentials and audit backup access.

1. Create a custom-format `pg_dump` using a private connection configuration. Record time, migration revision, object counts and checksum. Do not log connection passwords.
2. Restore into a new isolated recovery database using `pg_restore --no-owner --no-acl --exit-on-error`. Never use a live database for the rehearsal.
3. Verify migration revision, user/resume/job counts, ownership, foreign keys, representative document reads, login and protected photos. Measure elapsed recovery time.
4. Record the rehearsal evidence and repeat after schema/storage changes. A backup file without a proven restore is not a completed recovery control.

Document how account deletion propagates to backups on retention expiry, legal holds and support mail. The app deletes active database records and current private photos; it cannot erase provider backups or mailboxes by itself.

## Monitoring and Incident Response

Use `/health` for process liveness and `/ready` for database connectivity plus expected migration revision. Collect JSON request logs containing generated request IDs, method, status and duration, without bodies, query strings or tokens. Set alerts for readiness failures, elevated 5xx/429, import/export failures, SMTP failures, disk usage and backup failures. Export these logs to the chosen monitoring platform and test alert delivery.

Maintain a release/rollback owner, credential-rotation procedure and data-incident contact. Establish support response targets and a retention policy. No external monitoring account, on-call rota, backup service or hosting setting is configured merely by these repository changes.
