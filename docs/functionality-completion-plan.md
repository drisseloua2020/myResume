# MyResume Functionality Completion Plan

Historical review backlog. Current implementation progress and release boundaries are tracked in [implementation status](implementation-status.md).

Prepared October 22, 2026. Baseline: commit `6cd7ebc`.

This is a proposed implementation backlog based on the [functionality review](functionality-review.md). It defines the work still required; it does not imply that those changes have been implemented. Deployment, security, database recovery, and operational gates are documented separately in the [production-readiness review](production-readiness-review.md).

## Recommended Release Scope

The nearest practical release is a dependable free resume workspace: registration/login, onboarding, resume creation/import, editing, templates, saved resumes, drafts, text-based export, cover letters, job-description analysis, and basic job tracking.

Live profile syncing, public sharing, automatic job applications, scheduled reminders, and paid subscriptions should only be offered when their complete workflows exist. They are required to deliver the broader advertised platform, but do not need to delay a clearly scoped core release if they are hidden or accurately marked unavailable.

## Phase 1: Fix Core Workflow Failures

These packages address data correctness and access to existing functionality. Complete them before adding more user-facing modules.

| ID | Priority | Work to complete | Depends on | Done when |
| --- | --- | --- | --- | --- |
| C01 | P1 | Synchronize the active editor content and saved resume ID/title with the parent app. Capture save results; avoid remounting stale content. | None | Save, navigate away, return, and save again without reverting fields, creating an unintended duplicate, or updating another resume. |
| C02 | P1 | Define draft ownership and recovery. Distinguish drafts for different resumes using the same template; compare saved/draft freshness; expose saving/saved/failed status; handle rejected autosave promises. | C01 | Unsaved edits survive the documented recovery flow. Reload and a failed request cannot silently erase or overwrite a newer draft. |
| C03 | P1 | Restore reachable navigation to supported tools and supply mobile navigation. Include Cover Letters and Career Toolkit; make template selection accessible on small screens. Define URL/history behavior. | None | Each supported page is reachable on desktop and mobile, and Back/Forward/reload follow the documented behavior. No dead menu/footer links remain. |
| C04 | P1 | Replace image-only resume PDF downloads with text-based output. Resolve the backend pagination and unsupported-character issues; make supported TXT/DOCX/PDF downloads accessible. | C01 | Exported documents preserve supported names/content, PDF text is selectable/extractable, long sections stay on-page, and text-based PDF exports can be imported again. |
| C05 | P1 | Remove duplicate authentication dialogs, restore the registration switch, and make enabled sign-in methods reflect actual configuration. Add account recovery and supported profile maintenance. | None | One dialog mounts at a time, keyboard focus is correct, signup/login/logout/recovery complete successfully, and unavailable providers are honestly identified. |
| C06 | P1 | Remove misleading sample records and inert production controls from visible workflows. Show correct empty/loading/error states while unfinished actions remain disabled or hidden. | None | An account with zero jobs or packets sees zero records/counts; no available action silently does nothing. |

C01 and C02 resolve functionality finding F1. C03 resolves F2/F3, C04 resolves F4, C05 addresses F11, and C06 provides an honest interim state for F5/F6. Hiding incomplete modules does not count as implementing them; it permits a smaller, truthful release.

## Phase 2: Connect the Core User Journeys

The backend already supports much of this phase. The remaining work is selection context, user-facing controls, persistence, and error/retry behavior.

| ID | Priority | Work to complete | Depends on | Done when |
| --- | --- | --- | --- | --- |
| C07 | P1 | Carry the selected resume ID/content/version into analysis, letters, jobs, and version operations. Show which document an output used. Detect stale analysis after edits. | C01, C03 | Opening resume A while B is newer still analyzes and generates documents from A when A is selected. Outputs identify their source. |
| C08 | P1 | Complete import review. Display parser warnings, missing-field checks, normalization/confidence information, and editable results. Handle partial save/onboarding failures without duplicate resumes on retry. | C01, C02 | Supported inputs preserve expected fields and custom sections; incomplete parses are clearly flagged; retry after a late failure does not duplicate or lose content. |
| C09 | P1 | Finish the cover-letter journey: choose a resume, use pasted job text or a supported URL, generate, view, manage saved letters, and download. Replace the inaccessible menu reference with an actual route/action. | C03, C04, C07 | A user can complete the entire journey from normal navigation, then reload and reopen the correct saved letter. |
| C10 | P1 | Expose job-description ATS analysis and make Improvements use the intended resume/job context. Make role-specific rules appropriate for the chosen field. Label computed readiness and charts accurately. | C03, C07 | Two different target jobs produce explainable reports based on the selected resume, and advice does not silently default to an unrelated support role. |
| C11 | P1 | Complete basic job tracking: add/edit/view jobs, explicitly change lifecycle status, attach the correct resume/letter, filter lists, and handle update failures. | C03, C07 | Users can move an application through saved/applied/interview/offer/rejected, edit its details, and recover the same records after reload. |
| C12 | P2 | Link resume snapshots to `resumeId` and jobs where appropriate. Add version view/compare/restore. Distinguish a labeled snapshot from actual job-specific tailoring. | C01, C07 | A UI-created snapshot can be restored to its linked resume, with the restored content and history visible after reload. |
| C13 | P2 | Complete onboarding maintenance and account address handling. Allow completed answers to be edited; preserve supported international names/addresses; use country-appropriate postal validation. | C05, C07, C08 | A returning user can update career goals and regenerate analysis; valid non-US postal codes survive entry, save, reload, and export unchanged. |
| C14 | P2 | Finish achievement and LinkedIn-text workflows. Let users review imported content, save it, and open it in the main editor. Provide the supported achievement edit/delete/reuse lifecycle. | C01, C03 | Imported or reused content becomes an intentional saved resume change and remains available after leaving the tool. |

## Phase 3: Complete Administration and Account Data Workflows

| ID | Priority | Work to complete | Depends on | Done when |
| --- | --- | --- | --- | --- |
| C15 | P1 | Replace hard-coded admin metrics with real aggregates. Wire user details, real search/filtering/pagination, and the supported status/policy operations. Make older support/resume tools reachable or consolidate them. | C03, C06 | Counts match the database, user detail opens, changes persist, and unauthorized users cannot invoke management actions. |
| C16 | P1 | Complete user/support data portability and deletion. Clearly distinguish career-only deletion from full-account deletion, include uploaded files and linked records, and implement a real request/status flow where needed. | C03, C15 | The request can be submitted, tracked, and completed across the declared data stores; exports and deletion messages accurately describe coverage. |
| C17 | P2 | Complete contact/support handling: reachable signed-in form, persisted inbox, reply flow, delivery/error feedback, and resolution status. | C03, C15 | A test message reaches the admin inbox, a configured test reply is delivered or reports a useful error, and support status remains correct after reload. |
| C18 | P2 | Replace search/notification placeholders with working behavior or remove them. Align the template catalog, help text, pricing claims, and feature descriptions with actual availability. | C03, C06, C15 | Search performs its advertised operation, counts come from real records, and every product claim has a working route or an accurate unavailable state. |

## Phase 4: Deliver the Broader Platform

These packages are required if the associated features remain part of the complete product promise. They can be deferred for the scoped core release above.

| ID | Feature | Work to complete | Depends on | Done when |
| --- | --- | --- | --- | --- |
| X01 | Live profile sync | Implement actual provider connections, consent, sync timestamps, import/deduplication, error states, disconnect, and persistent review/apply/reject decisions. | C01, C07, C14 | A real supported source change is detected, reviewed, and intentionally applied once to the chosen resume. Disconnected sources produce no new data. |
| X02 | Public sharing | Implement a public viewer, supported visibility controls, PII redaction, revocation, and source/version selection. | C04, C07, C12, C16 | An authorized share displays only the intended document/data; revocation blocks future access; private records stay inaccessible. |
| X03 | Job discovery and matching | Ingest actual supported job sources or accept user-provided jobs, calculate fit from resume/job evidence, expose matching reasons, and persist user selection. | C07, C10, C11 | Real jobs and reproducible scores replace sample employers/list-position scores; saved filters/selections survive reload. |
| X04 | Packet preparation and approval | Persist packets linked to the chosen job, resume version, letter, and answers. Implement validation and prepare/edit/approve/hold/reject transitions with an audit trail. | C09, C11, C12, X03 | Each visible packet contains the exact documents/answers shown; a decision changes its status and survives reload; unapproved packets remain ineligible for submission. |
| X05 | External submission | Add supported application connectors, final user consent, idempotency, retries, failure recovery, receipts, and tracker updates. | X04 | A test application is submitted only after approval, retries do not submit duplicates, and success/failure is visible and recoverable. |
| X06 | Scheduled reminders | Add scheduling, cancellation, delivery, retries, timezone handling, and user notification preferences. | C11, C17 | A reminder fires once at the intended time, cancellation prevents delivery, and failed delivery is handled explicitly. Storing reminder JSON alone is insufficient. |
| X07 | Paid subscriptions | Implement checkout, verified payment events, entitlements/quotas, plan changes, cancellation, failed-payment behavior, and billing support. | C05, C15, C17 | Test purchase/change/cancel/failure events produce the correct server-enforced access without duplicate charges or incorrect access. Keep the product free-only until this exists. |

## User Acceptance Journeys

### New Candidate

1. Register or sign in using an available method.
2. Complete or intentionally skip onboarding.
3. Create a resume or import a supported file and review any warnings.
4. Select a template, edit fields, and save.
5. Leave the editor, return, reload, and confirm content and resume identity are unchanged.
6. Download a supported format and verify its content.
7. Analyze the selected resume against a job and generate a letter using that same resume.
8. Save the job/application and reopen it after reload.

### Returning Candidate With Multiple Resumes

1. Open resume A while a different resume B is newer.
2. Make a change and verify draft and saved state are clearly distinguished.
3. Use analysis, cover letters, and version operations for A.
4. Restore a linked version without affecting B.
5. Verify all supported steps at mobile width and after a failed network request.

### Administrator and Support

1. View actual user, resume, activity, and support counts.
2. Search for a user and open a real detail view.
3. Perform a supported authorized action and verify its persisted result.
4. Handle a support message or data request through completion with an auditable outcome.

## Definition of Functionally Complete

A feature is complete only when it has a reachable entry point, correct inputs and selected-record context, a working authorized operation, persistent results where appropriate, useful empty/loading/error states, and passing acceptance checks. A backend endpoint, a demo screen, or a success label alone does not meet that definition.

For the proposed core release, complete Phase 1, the included Phase 2 journeys, and the necessary administration/data/support work in Phase 3. Any deferred item must be removed from available controls and current feature promises. For the full advertised platform, complete every included Phase 4 feature as well.

Before public launch, the separate production-readiness gates must also pass. Functional completeness does not establish secure deployment, recoverable storage, or operational reliability.
