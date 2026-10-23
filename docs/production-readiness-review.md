# MyResume Production Readiness Review

Historical baseline review. See the [implementation status](implementation-status.md) for repository fixes and the [production runbook](production-runbook.md) for outstanding operator gates.

Review date: October 19, 2026 (America/New_York).

Reviewed baseline: commit `6cd7ebc`. Scope: backend, frontend, migrations, container builds, GitHub Actions, existing tests, and the supplied Adminer SQL dump. No live database, Render settings, DNS configuration, production logs, or backup service was inspected. Credentials and resume contents are intentionally omitted.

## Readiness Decision

**MyResume is a functional beta, but it is not ready for unrestricted public production.** The resume editor, import pipeline, account authentication, resume persistence, cover letters, and deterministic career tools provide a working foundation. Security, deployment reproducibility, database recovery, and several user-facing workflows still need completion.

A focused release of resume editing, import, saved resumes, cover letters, and career analysis is substantially closer than a release that also promises live profile sync, job discovery, auto-apply, public sharing, and paid subscriptions. Choose that release scope explicitly; unfinished modules should be hidden or clearly unavailable.

## Verification Results

| Check | Result | Interpretation |
| --- | --- | --- |
| Backend pytest suite | 52 passed, 1 dependency deprecation warning | Existing automated behavior passes against an isolated SQLite database. |
| Frontend Vitest suite | 87 passed across 11 test files | Existing component and service tests pass. |
| Frontend production build | Passed | Build warns about local Node 20.15.0 being below Vite's required version and a JavaScript chunk above 500 kB. |
| TypeScript `tsc --noEmit` | Failed | Errors occur in application components and test fixtures. The Vite build does not provide this gate. |
| Empty-database Alembic upgrade | Passed through `0004_career_profile_analysis` on SQLite | Migration chain works on SQLite; PostgreSQL permissions, upgrades, and restores remain unverified. |
| Production settings validation | Accepted the default JWT signing secret | Confirmed by constructing production settings and calling runtime validation. |
| Backend PDF export edge cases | Failed | A long-text example placed 127 text lines below the page; a non-Latin name became question marks. |
| Supplied SQL dump versus ORM tables | 11 dump tables versus 17 current application tables | Six current tables and the Alembic revision record are missing. |

Windows sandbox restrictions blocked the initial frontend test run and stalled backend checks. Both suites were rerun successfully outside the sandbox. Backend tests used an explicitly selected review-only database, not the app's configured database.

These results do not establish live-site availability, PostgreSQL correctness, browser end-to-end behavior, accessibility, load capacity, or a clean current dependency audit.

## Findings to Resolve Before Launch

### 1. P1: Remove Committed Credentials and Reject Unsafe Production Settings

Evidence: `services/docker-compose.yml:10`, `services/docker/host/docker-compose.yml:10`, and `services/app/core/config.py:11`.

Both compose files contain a database URL with embedded credentials, and the backend defaults to a known JWT signing secret. `validate_runtime_settings()` only checks whether the secret is empty. Production settings currently accept that default, which would allow forged application tokens if a deployment used it.

Required work:

- Remove credentials from tracked configuration and inject them through the deployment secret store.
- Rotate any committed credential that is still valid; deleting it from the latest file does not invalidate old copies.
- Reject missing, placeholder, or insufficiently strong JWT secrets in production.
- Require an intentional production database URL, HTTPS OAuth configuration, and exact allowed frontend origins.
- Make `CORS_ORIGINS` authoritative in production. `allowed_origins` currently always adds localhost and historical deployment origins, even when a narrower variable is supplied.

Done when production startup rejects insecure defaults and a secret scan passes without exposing working credentials.

### 2. P1: Close the Job-URL Fetching SSRF Gap

Evidence: `services/app/api/routes/cover_letters.py:135` and `services/app/api/routes/cover_letters.py:293`.

The URL validator blocks some literal private IP addresses, but it does not check the IP addresses resolved from hostnames. The HTTP client also follows redirects automatically without validating each destination. A public-looking URL could therefore direct the backend toward an internal service. The response is downloaded before the text is truncated, so the character limit does not bound network response size.

Required work: validate resolved IPv4/IPv6 destinations, validate every redirect or disallow redirects, restrict ports and outbound destinations, stream responses with byte limits, and enforce total timeouts. Add regression tests for private destinations, redirects, DNS behavior, and oversized responses.

Done when user-supplied URLs cannot cause requests to internal or metadata services, including through redirects. This approach follows the [OWASP SSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

### 3. P1: Make Database Provisioning, Migrations, and Recovery Repeatable

Evidence: `services/Dockerfile:15`, `.github/workflows/deploy-render.yml:21`, `services/alembic/env.py:18`, and the supplied Adminer dump.

The production Dockerfile starts Uvicorn without running migrations. The checked-in Render workflow only triggers deploy hooks; it does not provision schema permissions or run a database release step. An external Render pre-deploy command might exist, but it was not available for this review. Alembic also uses the raw URL while the application engine normalizes Render-style PostgreSQL URLs; align these paths.

The restore error you reported means the executing role lacks permission to create objects in schema `public`. The preceding missing-table notice is informational. Database access alone does not grant schema creation rights. See [PostgreSQL schema privileges](https://www.postgresql.org/docs/16/ddl-schemas.html#DDL-SCHEMAS-PRIV).

The supplied dump is also older than the current schema. It lacks:

- `career_onboarding_profiles`
- `career_profile_analyses`
- `job_applications`
- `achievements`
- `resume_versions`
- `resume_shares`

It also lacks `alembic_version`. Fixing the permission error alone will therefore not recreate a database compatible with the entire app.

Required work: use a migration role with schema ownership or scoped creation rights, a separate runtime role with necessary data permissions, a documented release migration command, automated backups, and a rehearsed restore procedure. Test empty PostgreSQL creation and upgrades from the actual deployed schema.

For the reported error, first inspect the target connection:

```sql
SELECT current_database(), current_user;
SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS can_use_public,
       has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public;
```

A schema owner or authorized administrator can grant the migration role the needed schema privileges while connected to the target database:

```sql
-- Replace migration_role with the actual migration/restore role.
GRANT USAGE, CREATE ON SCHEMA public TO migration_role;
```

This is guidance, not a command executed during the review. Existing objects may require ownership to alter or drop. Keep DDL privileges separate from the routine application role.

For an empty new database, prefer `alembic upgrade head`. For an existing restored database, reconcile its schema and migration history first. Do not blindly stamp `head`, and do not run the initial migration over already-existing tables. Only stamp a historical baseline after verifying that the restored schema actually matches it. Preserve a separate backup before any restore script containing `DROP TABLE` is used.

Done when a clean PostgreSQL instance can be provisioned and a backup can be restored to the current schema through a documented, tested process.

### 4. P1: Fix the Production UI Container's API Configuration

Evidence: `ui/Dockerfile:8`, `ui/.dockerignore`, `.github/workflows/deploy-images.yml`, and `ui/services/apiClient.ts:1`.

The UI image runs `npm run build` without accepting `VITE_API_URL`, its Docker context excludes environment files, and CI supplies no build argument. The resulting image uses the fallback `http://localhost:3000`. In a user's browser, that points to the user's own computer rather than the hosted API. An HTTPS deployment can also encounter mixed-content blocking.

Required work: either pass a validated API origin into the Vite build or provide a runtime-loaded configuration file. Verify the built image against staging. Setting an environment variable on the already-running Nginx container will not rewrite the compiled JavaScript.

Done when the exact published UI image calls the correct staging/production API without localhost URLs.

### 5. P1: Bound Document Processing and Preserve Uploaded Data

Evidence: `services/app/schemas/resumes.py:19`, `services/app/services/resume_parser/framework.py:107`, `services/app/services/resume_parser/framework.py:133`, `services/app/api/routes/uploads.py:58`, `services/Dockerfile:11`, and `services/.dockerignore`.

Resume base64 data has no maximum input length. PDF extraction iterates all pages, and DOCX extraction reads XML from ZIP entries without expanded-size or compression-ratio limits. Truncating extracted text afterward does not bound parsing memory or CPU. Profile photos have a byte limit, but the server relies on the declared content type rather than decoding and validating the image.

The application writes photos to local disk. The Docker ignore file does not exclude `uploads/` or `protected_uploads/`, while the Dockerfile copies the entire context. Local container builds can therefore include existing user uploads. Live storage persistence was not verified. Render documents that its default filesystem is ephemeral; persistent storage requires explicit configuration: [Render persistent disks](https://render.com/docs/disks).

Required work: enforce request and decoded byte limits, PDF page limits, DOCX expansion limits, image validation, parsing timeouts, and per-user quotas. Exclude runtime uploads from container builds. Configure and test persistent private storage, replacement/deletion cleanup, and backup coverage.

Done when malformed or oversized files fail within defined limits and uploaded photos survive deployment without being embedded in images.

### 6. P1: Finish Account Security and Recovery

Evidence: `services/app/api/routes/auth.py:18`, `services/app/api/deps.py:35`, `services/app/core/security.py:32`, `services/app/services/oauth.py:303`, and `services/app/services/oauth.py:415`.

The application has password hashing and role checks, but lacks password reset/change and email-verification flows. Login and request authentication do not reject non-active user status. Password verification also accepts a legacy plaintext value when a stored password is not an Argon2 hash.

OAuth redirects carry the application JWT in the query string, and the UI stores it in `localStorage`. Browser history, server logs, third-party scripts, and XSS therefore deserve explicit treatment. Automatic account linking uses email, with a missing `email_verified` field treated as verified.

Required work: add recovery and verified-email flows, enforce account status, migrate and remove plaintext password compatibility, rate-limit login/signup/contact endpoints, and define session expiry/revocation behavior. Use a short-lived one-time OAuth handoff or a secure server-side session design; validate provider-specific identity guarantees before automatic linking. Add a restrictive browser security policy and appropriate response headers.

Done when account recovery works, disabled users lose access, abuse controls are tested, and session tokens are protected through login, OAuth, logout, and password reset.

### 7. P1: Enforce Ownership for Linked Career Records

Evidence: `services/app/api/routes/career.py:290`, `services/app/api/routes/career.py:329`, `services/app/api/routes/career.py:378`, and `services/app/api/routes/career.py:403`.

Jobs accept `resumeId` and `coverLetterId`, achievements accept `sourceResumeId`, and versions accept linked resume/job IDs without checking that those referenced objects belong to the current user. The owning career record is scoped, and restore performs its own resume ownership check, but the linked-ID invariant is missing at creation/update time. A foreign key only checks existence, not account ownership.

Required work: validate every linked resource with the current user ID, return a consistent not-found response for unavailable references, and add two-account negative tests for create, patch, restore, export, photos, and admin operations.

Done when one account cannot attach another account's resources, regardless of whether it knows their IDs.

### 8. P1: Repair PDF Pagination and Character Support

Evidence: `services/app/services/career_tools.py:717`, `services/app/services/career_tools.py:764`, and `services/app/api/routes/cover_letters.py:352`.

Career PDF export paginates 45 source lines before wrapping them. Long source lines expand into many rendered lines without creating additional pages. A local example produced text coordinates down to `-1895`, placing 127 lines below the page. Both backend PDF generators encode text as Latin-1 with replacement, so non-Latin names and content become question marks. The returned `pdfValidation` object reports success without checking these conditions.

Required work: paginate after layout/wrapping, use embedded fonts with the supported character coverage, and validate that exported text and page bounds match the source. Test long resumes, long bullets, international names, and multiple pages. Label any unsupported import/export format honestly; legacy DOC extraction currently uses printable-byte heuristics and scanned PDFs have no OCR pipeline.

Done when the downloadable documents preserve all supported user content, with no off-page text or silent character replacement.

### 9. P1: Make Release Gates Verify the Actual Deployment

Evidence: `.github/workflows/deploy.yml`, `.github/workflows/deploy-render.yml:21`, `.github/workflows/deploy-ui.yml:33`, `.github/workflows/deploy-appsec.yml:52`, and `services/tests/conftest.py:16`.

The current checks run on pushes to `main` and `stage`, not pull requests. Both branches invoke the same deployment secret names without checked-in environment separation. Deploy hooks use plain `curl -X POST`; HTTP failures are not explicitly failed, and the workflow does not wait for deployment completion or exercise the new site. Built GHCR image identities are not passed through as an explicit release artifact.

TypeScript checking fails locally but is absent from CI. Tests construct ORM tables directly, so passing tests do not validate migrations or PostgreSQL behavior. The test fixture also drops tables in whichever `DATABASE_URL` it inherits; the suite needs a guard that rejects non-test targets. The security job runs `npm audit fix`, which can audit different dependencies from those used by other jobs.

Required work: add pull-request checks and required branch gates, fix TypeScript errors, test PostgreSQL migrations, guard destructive test fixtures, and audit an unchanged lockfile. Separate staging and production environments. Deploy a known commit/image, fail HTTP errors, wait for deployment status, run smoke tests, and document rollback. Verify Render auto-deploy does not bypass the intended gate.

Done when a failing check cannot reach production and a green release proves that the deployed app can authenticate, import, save, reload, and export a resume.

### 10. P1: Complete or Hide Demonstration Workflows

Evidence: `services/app/services/profile_sync.py:7`, `services/app/services/profile_sync.py:27`, `ui/App.tsx:1430`, `ui/components/JobsToApplyWorkflowPage.tsx:20`, `ui/components/AutoApplyPrepWorkflowPage.tsx:14`, and `ui/components/HumanApprovalWorkflowPage.tsx:32`.

Profile sources are initially marked connected without a real provider connection, updates are generated from fixed examples, and agent approval changes browser state and displays a simulation alert. The jobs screen substitutes sample jobs and derives fit scores from list position. Application preparation uses a fixed packet list. Approval buttons have no submit/approve handlers. Several admin policy toggles are visual elements without persistence.

Required work: remove sample data from authenticated production workflows, show honest empty/error states, persist source connections and review decisions, compute scores from actual data, and connect controls to authorized backend operations. If auto-apply is in scope, build a durable packet/approval/submission state machine with explicit consent, idempotency, retries, and receipts. Otherwise disable that module for launch.

Done when every available action persists its advertised result and no user mistakes generated examples for actual jobs, certifications, or applications.

## Additional Production Work

| Priority | Area | What remains | Completion evidence |
| --- | --- | --- | --- |
| P1 | Monitoring and recovery | Add database-aware readiness, structured error logs, request IDs, error monitoring, uptime alerts, backup/restore ownership, and an incident runbook. `/health` currently returns a constant result without checking the DB. | A database outage fails readiness and triggers an alert; a restore exercise meets documented recovery targets. |
| P1 | Account data lifecycle | `/career/data` only deletes career records; resumes, drafts, letters, photos, OAuth links, and the account remain. Its export also omits portions of account data. Define and implement full-account export/deletion and retention rules separately. | An exercised export/deletion workflow covers each data store and accurately describes exclusions. |
| P2 | Frontend asset delivery | Replace the Tailwind browser CDN in `ui/index.html:7` with compiled CSS. Tailwind describes Play CDN as development-only. Add caching, compression, code splitting, and tested security headers. | Production styling works without the browser compiler; mobile performance and security-header checks meet agreed targets. |
| P2 | User-facing completeness | Implement account profile edits or remove the corresponding policy claim; show actionable errors instead of empty-list fallbacks; verify mobile layouts, keyboard use, screen-reader labels, and long content. | Browser tests and a documented accessibility/responsive QA pass. |
| P2 | Capacity and database performance | Paginate large lists, add measured user/date indexes, define DB connection budgets, and load-test parsing, exports, draft saves, and admin queries. Use background workers where observed processing time warrants them. | Query plans and concurrency tests meet explicit latency/error budgets. |
| P2 | Public sharing | `/career/shares` creates metadata, but no public resume retrieval/revocation workflow was found. Implement the full lifecycle or keep sharing unavailable. | Share visibility, revocation, redaction, and authorization tests pass. |
| P2 | Commercial plans | Paid plans are disabled; no billing lifecycle is implemented. The UI advertises a daily resume limit without matching backend quota enforcement. A free-only launch does not need billing. | Plan copy matches behavior; a paid launch additionally has tested checkout, webhook verification, entitlements, cancellation, and support handling. |
| P2 | Operational email | Configure delivery and sender authentication, use timeouts, and fail closed when TLS is required. `mailer.py` currently ignores STARTTLS failure and can continue. | Staging delivery succeeds and transport failures produce safe, actionable errors. |
| P2 | Contracts and setup | Regenerate the sparse `services/openapi.yaml`, align template catalogs, remove unused mock service implementations, provide sanitized environment examples, and standardize supported Node/Python versions. | A new developer can run the documented setup and generated API contract matches the app. |

Tailwind's production limitation is documented in its [Play CDN installation guide](https://tailwindcss.com/docs/installation/play-cdn).

## Recommended Delivery Order

1. **Agree on the launch scope.** Keep the functioning resume/career core and disable incomplete profile-sync, auto-apply, sharing, and paid features unless they will be fully implemented.
2. **Resolve security and database blockers.** Rotate credentials, enforce production configuration, fix URL fetching and ownership checks, bound uploads, and establish PostgreSQL roles/migrations/recovery.
3. **Make builds and deploys reproducible.** Fix the UI API configuration, require TypeScript checks, test PostgreSQL migrations, and separate staging from production.
4. **Finish core user journeys.** Account recovery, persistence across restart, trustworthy PDF exports, full data lifecycle, and honest empty/error states.
5. **Prove operations.** Run deployed browser tests, restore drills, monitoring alerts, load tests, and a rollback exercise.
6. **Expand beyond the core release.** Implement provider sync, sharing, application automation, reminders, and billing only when their complete workflows are testable.

## Release Acceptance Checklist

- [ ] Production configuration rejects placeholder secrets and unintended local settings.
- [ ] Committed credentials are removed and any active exposed credentials are rotated.
- [ ] PostgreSQL provisioning, migrations, least-privilege runtime access, and backup restore are tested.
- [ ] Exact production UI and API artifacts pass staging smoke tests with the correct API origin.
- [ ] Backend tests, frontend tests, TypeScript, dependency scans, and migration checks are required and passing.
- [ ] Account recovery, disabled-user enforcement, abuse limits, and session handling are tested.
- [ ] Cross-account access, linked IDs, private photos, and admin actions have negative tests.
- [ ] Upload limits and parser resource limits hold under malformed and concurrent inputs.
- [ ] Supported PDF/DOCX/TXT exports preserve long and international content.
- [ ] Included product controls work; demonstration modules and unimplemented promises are removed or unavailable.
- [ ] Data export/deletion, persistent uploads, and retention behavior match the published product policy.
- [ ] Readiness, alerts, rollback, incident ownership, accessibility, and agreed capacity checks are exercised.

The next concrete milestone should be a hardened, reproducible staging release of the core resume workflows. Promotion to production should follow these acceptance results rather than the presence of additional screens.
