# Core Release Implementation Status

Updated October 23, 2026. Review baseline: `6cd7ebc`. This document describes the current working-tree changes, not a deployed release or production approval.

The selected scope is **a free core release with live integrations deferred and optional mocked provider operations for testing**. The [mock-provider sandbox](mock-providers.md) is explicit, opt-in and blocked in production. The original reviews remain historical evidence. The [production runbook](production-runbook.md) defines operator actions still required before launch.

## Functional Changes

| Review package | Implemented behavior | Boundary or remaining limitation |
| --- | --- | --- |
| C01: editor identity | Immediate parent/editor synchronization; saved ID/title retained across navigation; subsequent saves update the same record. | Concurrent editing in multiple tabs has no optimistic-concurrency conflict UI. |
| C02: drafts | Per-resume draft keys, recovery prompts, saving/saved/error states, serialized writes and session guards. | Single-tab ordering is protected; cross-device conflicting drafts still need an explicit merge policy. |
| C03: navigation | Desktop/mobile navigation, mobile template selection, hash/history handling, reachable letters/toolkit/support/admin views. | Browser acceptance was sampled, not an exhaustive accessibility audit of every legacy screen. |
| C04: exports | Selectable-text, paginated Unicode PDF; TXT/DOCX downloads; library/editor use backend PDF. TXT/DOCX do not depend on PDF font support. | ATS text layout differs from visual templates. Complex-script shaping and every Unicode glyph are not guaranteed; unsupported PDF characters return an error. |
| C05: authentication | One keyboard-accessible dialog; signup switch; configured-provider availability; password recovery/change; name maintenance; server session revocation. | Recovery/replies require configured SMTP. Email ownership verification and email changes are not implemented. |
| C06: truthful states | Real job/packet empty/loading/error states; no fabricated connections, jobs, metrics or automatic submission success. | Disabled integrations are not completed integrations. |
| C07: selected context | Active resume flows into tools, letters and analysis; stored profile analysis detects changed resume/onboarding inputs. | Job-analysis scores are local heuristics, not hiring predictions or a proprietary ATS certification. |
| C08: import review | Parser warnings/confidence, editable results, file limits, stable import-attempt keys and nonfatal late-stage analysis/draft failures. | No OCR for image-only scans. Legacy DOC extraction remains less reliable than PDF/DOCX; review all imports. |
| C09: letters | Reachable generation, selected resume, pasted text/safely fetched job URL, saved records and text PDF download. | No generative provider; results use deterministic rules. |
| C10: improvements | Reachable job-description analysis, selected-resume context, role-aware advice and cleared outdated reports. | Broader occupation/language coverage still needs representative quality evaluation. |
| C11: job tracking | Create/edit/delete/filter jobs, lifecycle status, resume/letter links, notes and deadlines persisted. | Manual tracking only; deadlines do not schedule delivered reminders. |
| C12: versions | Snapshots linked to saved resumes; current/snapshot comparison; restore with a backup of the previous content. | A labeled snapshot is not automatic job-specific tailoring. |
| C13: preferences | Editable career onboarding/preferences, international postal entry, non-US address persistence. | International address validation is deliberately permissive; not every country's format is certified. |
| C14: achievements/profile text | Achievement edit/delete/copy, full pasted profile text retained, import review before save/open in the editor. | Profile text parsing is basic; experience may need manual restructuring from retained notes. Copy/reuse is intentional, not automatic insertion. |
| C15: administration | Database aggregates, server-side user/audit search and pagination, user details/recent activity, supported status changes and catalog toggles. | Legacy support/resume lists are still bounded; comprehensive server pagination across every list remains scale work. |
| C16: account data | Account-wide owned-record export, current photos, confirmed active-account deletion, separate career-only controls. | Backups, external mail and legal retention need an operator policy; the application cannot erase those stores by itself. |
| C17: support | Reachable persisted contact form/inbox, reply operation, delivery failure feedback and persisted replied status. | Real delivery needs SMTP testing; no general-purpose ticket assignment/SLA engine. |
| C18: product claims | Removed inert global search/fake notifications; aligned 20-template catalog; paid plans disabled; feature catalog limited to available core operations. | Existing marketing/help content still needs owner approval before public launch. |

## Extended Features

- X01 live profile sync, X03 external job discovery, X05 external submission, X06 scheduled reminder delivery and X07 subscriptions remain disabled by the selected release scope. No fake success or entitlement grant substitutes for a provider.
- Development/test Provider Demo mimics profile connect/sync, job discovery/save, approved-packet submission, billing and email with success/failure/timeout responses. It persists isolated owned history and replay-safe receipts; no live delivery or paid access is implied.
- X02 is implemented as expiring, revocable public **text** shares of saved resumes, with contact-field redaction and no-index headers. It is not a hosted portfolio builder. Shares reflect later saved edits; free-text PII needs manual review.
- X04 supports owned job/resume/letter snapshots, structured preview, audit trail, approve/reject decisions, stale-input protection and downloadable packets. It does not submit externally, and advanced answer editing/hold/scheduling workflows are not claimed complete.

## Nonfunctional Changes

- Removed current committed database credentials; documented mandatory rotation of historical credentials.
- Added production configuration validation, Argon2-only passwords, required JWT claims/issuer/audience, account-status checks and token-version revocation.
- Moved OAuth tokens out of query strings, tightened verified-email account linking and prevented OAuth plan escalation.
- Bounded request bodies, auth attempts, file/page/ZIP expansion, image dimensions and network fetches. Public URL fetching rejects private destinations and validates every redirect.
- Added ownership checks for linked records, private normalized photo storage, sanitized errors, request IDs/security headers and readiness tied to migration revision.
- Added migrations `0005_sessions_and_drafts`, `0006_import_idempotency` and `0007_mock_provider_operations`; protected destructive test fixtures from non-test databases.
- Hash-locked Python production/test dependencies; removed browser raster PDF tooling/CDN styling; upgraded locked frontend dependencies. Node 24/Python 3.13 are the validation runtimes.
- Added non-root container definitions, private upload persistence, canonical Compose startup ordering, runtime frontend API configuration and PostgreSQL migration CI.
- PRs run checks without publishing images; production hook execution is limited to pushes on `main` and a protected deployment environment.

## Verification

Latest backend regression results: **86 tests passed**, including six CORS compatibility/rejection checks. The prior unchanged-frontend checks passed **95 tests across 16 files**, TypeScript and the production build. The backend reports one Starlette/httpx test-client deprecation warning. The checked-in tests cover session/password replay, quotas/idempotency, cross-user references, draft isolation, packet decisions, PDF text/pagination, malformed uploads, SSRF, shares, account deletion, admin authorization/pagination and mock-provider isolation/replays. Frontend tests cover editor/navigation state, delayed parent echoes, dialogs, imports, draft ordering, export clients and provider-demo retries.

Login regression follow-up: removing the legacy Render origin blocked browser login before credentials were evaluated. The public API returned `400 Disallowed CORS origin` for `https://myresume-rrcy.onrender.com`. Configuration now preserves the exact MyResumes apex/www/Render aliases when one is explicitly configured, with `INCLUDE_LEGACY_FRONTEND_ALIASES=false` available for strict allowlists. The exact preflight returns 200 in the local real application, and unrelated origins remain blocked. This repository fix still requires deployment; alternatively add the Render origin directly to the live API's `CORS_ORIGINS` and restart it. No database users or passwords were modified.

Fresh and populated isolated SQLite databases were upgraded through `0007_mock_provider_operations`; `alembic check` found no pending model/schema operations. Browser checks used synthetic records on an isolated database, including mobile navigation, retained edits, save/reopen, selected-source letters, manual job preparation and approval, mock job discovery/save, duplicate submission replay, profile connect/sync, billing timeout/recovery and local email outbox. The mobile provider page had no horizontal overflow and the sampled browser console had no warnings/errors. No production database was modified.

Dependency audits reported zero known vulnerabilities for the production Python lock and npm dependency graph at validation time. Audits are point-in-time results, not a security guarantee. The frontend build still reports a roughly 590 KB main chunk; measure startup performance and expand code splitting against a real performance budget.

Docker's local daemon was unavailable, so image execution and local PostgreSQL smoke testing were not completed. A PostgreSQL migration job is configured in CI but has not been observed running in this workspace. Live OAuth/SMTP, production TLS/proxy behavior, backups and provider deployment settings were not exercised.

## Required Before Public Launch

1. Rotate previously exposed database credentials and any reused secrets; review access logs.
2. Provision separate migration/runtime PostgreSQL roles and validate the full migration path on representative data. The runbook addresses SQLSTATE `42501` on schema `public` without granting the API unrestricted DDL.
3. Build/run images in CI and staging; verify persistent private uploads, non-root permissions, runtime API routing, HTTPS/CSP/CORS and trusted proxy addresses.
4. Configure chosen SMTP/OAuth providers or retain disabled states. Decide whether email verification is a launch requirement.
5. Configure monitoring/alerts, distributed gateway limits, upload CPU/memory isolation, request deadlines and load tests.
6. Prove encrypted backup/restore with measured recovery targets and document retention/deletion propagation.
7. Configure production environment reviewers, exact release/image selection, deploy-status checks, authenticated smoke tests and rollback. Hook acceptance is insufficient.
8. Complete owner acceptance, accessibility and privacy review on staging. Address scale/concurrency limits above before allowing workloads that require them.

These gates cannot be satisfied by repository edits alone. This is a tested core release candidate with explicit limitations, not a claim that the entire originally advertised platform is complete.
