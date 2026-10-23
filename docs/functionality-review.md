# MyResume Functionality Review

Historical baseline review. For subsequent fixes and remaining limitations, see the [implementation status](implementation-status.md).

Browser/API checks performed October 19, 2026. Source rechecked and review finalized October 22, 2026, against unchanged commit `6cd7ebc`.

This complements the [production-readiness review](production-readiness-review.md). It evaluates whether user journeys work, whether controls perform their advertised actions, and whether state survives normal navigation. It does not implement fixes.

For the prioritized work packages, dependencies, and completion criteria, see the [functionality completion plan](functionality-completion-plan.md).

## Method and Scope

- Traced the current React navigation, editor state, service calls, and corresponding FastAPI routes.
- Ran the app locally with a separate migrated SQLite database and synthetic user/admin accounts. Production accounts and data were not used.
- Exercised sign-in, explicit save, library preview, draft persistence, tab navigation, jobs, approval, admin user actions, and mobile navigation in a browser.
- Checked a 390 x 844 mobile viewport and restored the default viewport afterward.
- Downloaded a synthetic library resume and checked its text layer and compatibility with the application's own parser.
- Ran focused API smoke checks for import, cover letters, scoring, jobs, versions, profile analysis, exports, and admin reads.

Browser testing used localhost ports 4101 and 3101. The earlier review's automated suites passed 52 backend and 87 frontend tests; those counts are not a substitute for the additional workflow checks here. Live OAuth providers, external job applications, SMTP delivery, and every template/import combination were not tested in this pass.

## Overall Assessment

The backend has more working functionality than users can reach through the current frontend. The editor and library can save and display real data, but state synchronization between pages is unreliable. Some prominent career and admin screens combine real records with demonstration content or controls that do nothing.

The first functionality milestone should be a complete, reliable journey from editing to saving, leaving the page, returning, exporting, and applying the correct resume to analysis. Adding more screens before that journey is reliable would make the gaps harder to diagnose.

## High-Priority Findings

### F1. P1: Editor Navigation Restores Stale Content, Including After Save

**Verified in the browser and database.**

Sources: `ui/App.tsx:808`, `ui/App.tsx:1608`, `ui/components/ResumeInput.tsx:1283`, and `ui/components/ResumeInput.tsx:1350`.

Reproduction:

1. Open a saved resume with target role `Saved Engineer Role`.
2. Change it to `Unsaved Review Role` and allow the draft debounce to finish.
3. The database contains the new draft value, while the saved resume retains the old value, as expected.
4. Switch to Improvements and back to Resume Editor.
5. The field returns to `Saved Engineer Role`; the autosaved draft is not restored.
6. Repeat with `Saved Review Role` and explicitly click Save Resume. The save succeeds and the library displays the new title.
7. Switch to Improvements and back. The editor still restores `Saved Engineer Role` from the parent's stale state.

Saving currently updates the child editor and database without updating the parent's active resume content. Draft callbacks write to the API without synchronizing `editorData`. Leaving the page unmounts the editor; returning hydrates stale parent data. Startup also fetches the latest saved resume rather than recovering a newer draft. A later Save can overwrite the recently saved content with this older editor state.

**Needed:** a shared active-resume state that receives edits and save results; drafts associated with a resume identity rather than just user/template; deliberate recovery rules; an unsaved-change policy; and visible handling of asynchronous autosave failures.

**Acceptance:** edit, wait for autosave, change tabs, reload, and reopen from the library without losing or reverting content. Explicitly saved changes must appear consistently in the editor, library, and analysis pages.

### F2. P1: Important Working Features Have No Reachable Signed-In Entry Point

**Verified through navigation inspection and code tracing.**

Sources: `ui/components/Header.tsx:16`, `ui/App.tsx:1487`, `ui/App.tsx:1495`, and `ui/App.tsx:1537`.

The current user menu exposes All Resumes, Resume Editor, Improvements, Analysis, Jobs, Auto-Apply, Approval, and Account. It has no entry for the implemented Cover Letters page, Career Toolkit, Profile Sync, or signed-in Contact page. No reachable control was found that sets those app tabs. The editor also retains cover-letter generation logic but exposes only Editor and Import File mode buttons.

Consequently, ATS analysis against a pasted job description, job-tracker editing, achievements, version creation, LinkedIn text import, text export, and cover-letter management are present in code but unavailable through ordinary signed-in navigation. The public footer's Cover Letters link only points to `#`.

**Needed:** explicit navigation for supported tools, direct links from relevant workflows, and removal or correction of dead links. Use one clear navigation model across desktop, mobile, and admin views.

**Acceptance:** a user can reach each supported capability without developer tools, hidden state manipulation, or knowledge of component names.

### F3. P1: Mobile Navigation Hides the Workflow Tabs Without a Replacement

**Verified in the browser at 390 x 844.**

Source: `ui/components/Header.tsx:53`.

Primary navigation uses `hidden ... md:flex`, with no mobile menu or equivalent control. The account dropdown offers Account, disabled Payment Settings, and Log Out. Analysis, Improvements, Jobs, Auto-Apply, and Approval cannot be reached through that menu. The logo can open the library, and an existing resume's Edit action can reopen the editor, but those paths do not replace the missing workflow navigation. The inline template switcher is also hidden on small screens.

**Needed:** a keyboard-accessible mobile navigation control containing the same available workflows, plus a mobile-accessible template selection path.

**Acceptance:** a new mobile user and a returning mobile user can complete the supported desktop journeys without resizing the browser.

### F4. P1: Downloaded Resume PDFs Have No Text Layer and Fail Re-Import

**Verified using an actual browser download and the backend parser.**

Sources: `ui/components/ResumeLibraryPage.tsx:130`, `ui/components/ResumeLibraryPage.tsx:150`, and `ui/components/ResumeInput.tsx:1090`.

Both resume download paths capture the rendered document with `html2canvas` and place images into jsPDF pages. They do not add selectable resume text.

The tested library download contained two pages, two image objects, and **zero extracted text characters**. Re-importing that PDF produced:

```text
422: Could not extract readable text from this PDF.
Please upload a text-based PDF or a DOCX file.
```

The document can look like a resume while failing the application's own text-based import requirements. Backend cover-letter PDF generation is a separate path: the smoke-test letter had 1,020 extractable text characters. The previous production review also identified pagination and character-support problems in backend resume PDF export.

**Needed:** a reliable text-based resume export path with fonts, pagination, and layout matching the selected template. Keep image export explicitly distinct if it is retained. Validate text fidelity and an export/import round trip.

**Acceptance:** downloads preserve the candidate's supported text, have selectable/searchable content, and can be parsed again without OCR. Visual layout needs its own test; text extraction alone does not establish layout quality.

### F5. P1: Jobs and Application Preparation Display Samples Rather Than a Working Pipeline

**Verified in the browser and source.**

Sources: `ui/components/JobsToApplyWorkflowPage.tsx:20`, `ui/components/JobsToApplyWorkflowPage.tsx:48`, `ui/components/AutoApplyPrepWorkflowPage.tsx:14`, and `ui/components/HumanApprovalWorkflowPage.tsx:32`.

With no saved jobs, the Jobs page displayed four example employers, numerical fit scores, and a batch count of five. For actual saved jobs, the score is derived from list position rather than a resume/job comparison. Jobs are labeled selected without an implemented selection operation.

Build apply batch navigates to a fixed preparation screen. That screen and the approval queue use hard-coded packets rather than records selected by the user. Clicking Approve selected caused no workflow change; the button has no action handler. Approve all safe, packet editing, and rejection likewise lack a persisted application workflow.

**Needed:** truthful empty states, job selection, real matching inputs, persisted packets, validation, approve/edit/reject actions, and a visible status history. External submission should be presented as unavailable until an actual connector and submission lifecycle exist.

**Acceptance:** a user selects real saved jobs, prepares matching packets, reviews the exact documents/answers, records a decision, and sees that decision after reload. Displayed counts must come from those records.

### F6. P1: Admin Screens Suggest Management Capabilities That Are Not Implemented

**Verified using the synthetic admin account.**

Sources: `ui/components/AdminWorkflowConsolePage.tsx:43`, `ui/components/AdminWorkflowConsolePage.tsx:123`, `ui/components/AdminWorkflowConsolePage.tsx:255`, `ui/components/AdminWorkflowConsolePage.tsx:340`, and `ui/App.tsx:1557`.

The overview showed 8,942 resumes and 19 queued approvals in a review database containing one saved resume and no application queue. These metrics are hard-coded. Users were read correctly from the API, but clicking Open did nothing. Search/role/plan/status controls are badges rather than filters; only eight users are rendered without pagination. Save policy and feature/automation switches have no persistence. Privacy requests and several attention items are examples.

The newer `admin_users` branch also returns before the older `AdminUsersPage` branch, leaving the latter unreachable. Admin contact-message and resume-management pages have no entry in the current header.

**Needed:** connect administrative actions to authorized API operations, replace example metrics with database-backed values, provide real filtering/pagination/detail views, and restore access to actual support/resume tools.

**Acceptance:** every visible admin action either changes a real authorized record and survives reload, or is clearly unavailable. Operational counts must match the underlying database.

## Further Functional Gaps

### F7. P2: Version Creation Does Not Produce a Restorable Linked Version

Sources: `ui/components/CareerToolkitPage.tsx:161` and `services/app/api/routes/career.py:403`.

Career Toolkit's Save Base Version and Save Tailored Version omit `resumeId`. A focused API check using that payload created a version successfully, then restore returned `400: Version is not linked to a saved resume`. The UI lists snapshots but does not expose restore, comparison, or selection controls. Calling a snapshot tailored also does not apply any job-specific content changes.

**Needed:** retain the selected resume ID, distinguish snapshot creation from actual tailoring, link the relevant job when applicable, and implement version view/compare/restore with clear confirmation and history.

### F8. P2: Analysis Does Not Consistently Follow the Resume the User Opened

Sources: `ui/components/CareerProfileAnalysisPage.tsx:252`, `ui/components/CareerToolkitPage.tsx:103`, and `services/app/api/routes/career.py:218`.

Profile analysis refresh does not pass the active resume ID, so the backend selects the latest saved resume. Career Toolkit also replaces its supplied `currentResume` with the latest saved resume when it mounts. These choices can analyze a different document from the one opened in the editor. Saved profile analysis has no automatic stale-content indication after later edits.

**Needed:** one explicit selected-resume context, an analysis source/version label, and invalidation or refresh guidance when resume or onboarding data changes.

### F9. P2: Import Diagnostics Are Returned but Not Shown

Sources: `ui/App.tsx:1367` and `ui/App.tsx:1372`.

The parser returns warnings, confidence, document metadata, and an ATS report. Import orchestration reads the resume but does not surface those diagnostics. Users can therefore receive incomplete or normalized content without seeing what needs checking. Parser success, resume creation, draft save, and onboarding completion are also separate operations; a late failure can leave earlier writes completed, making retry behavior important.

**Needed:** an import review/result state, clear missing-field warnings, safe retry behavior, and field-preservation checks for supported formats. The current legacy DOC implementation and image-only PDFs also need explicit capability messaging.

### F10. P2: International Address Inputs Corrupt Valid Postal Codes

**Verified in the browser.**

Sources: `ui/components/ResumeInput.tsx:1012` and `ui/components/ResumeInput.tsx:1642`.

The form allows Canada and other countries, but strips every non-digit character from the postal code, limits it to five characters, and requires a five-digit US ZIP. Entering `K1A 0B1` resulted in `101`. This changes user data rather than merely rejecting unsupported formatting.

**Needed:** preserve entered values and use country-appropriate validation, or clearly restrict the product to supported countries. Imported addresses must follow the same preservation rules.

### F11. P2: Authentication UI Mounts Duplicate Dialogs and Disables Available Paths

**Duplicate sign-in controls and disabled Google sign-in verified in the browser.**

Sources: `ui/components/AuthScreen.tsx:511`, `ui/components/AuthScreen.tsx:602`, `ui/components/AuthScreen.tsx:818`, and `ui/components/AuthScreen.tsx:897`.

Opening Log In mounts two AuthModal instances. The browser DOM contained two email inputs, two password inputs, and two Sign In controls. The first general modal block also treats pricing as signup while the dedicated pricing modal is mounted separately. This creates overlapping dialog state and makes focus/accessibility behavior unreliable.

Continue with Google is always disabled in the frontend, independently of backend configuration. The login dialog's Sign up switch is disabled, although registration is reachable through the public free-plan path. Email login itself worked for both review accounts.

**Needed:** one modal render path, proper dialog focus management, a working registration switch, and provider buttons that reflect intentional provider availability. Password recovery is also missing, as noted in the production review.

### F12. P2: Several Remaining Tools Stop Before Completing the User's Goal

| Tool | Current behavior | Needed to complete the workflow |
| --- | --- | --- |
| LinkedIn text import | Replaces Career Toolkit's local resume state only. | Let the user review, save, and open the imported content in the main editor. |
| Job tracker | Backend supports lifecycle updates; the Toolkit's card click only moves saved to applied and otherwise writes the existing status. | Explicit status selection, editing, archive/delete controls, filtering, and error handling. |
| Improvements | Renders useful local completeness rules, but always includes support-role keyword defaults; progress charts are derived values, not recorded improvement history. | Match guidance to the user's role/job, distinguish recommendations from edits, and label computed charts accurately. |
| Profile sync/agent review | Uses fixed detected updates and simulated approval rather than provider ingestion and resume changes. | Real source authorization, ingestion, deduplication, review decisions, and controlled application to a resume. |
| Sharing | Creates share metadata; no public viewer/revoke workflow was found. | A complete visibility, redaction, retrieval, and revocation lifecycle. |
| Export formats | The API returns multiple formats, but Toolkit exposes only TXT/redacted TXT downloads. | Reachable format selection and tested PDF/DOCX/TXT downloads. |
| Account settings | Name and email are displayed rather than editable; password/recovery controls are absent. | Supported profile/account maintenance or accurate read-only labeling. |
| Onboarding maintenance | Initial questionnaire/import flow exists; no normal edit path for completed answers was found. | A profile-edit path with analysis refresh and retry behavior. |
| Search and notifications | Header search is a text span; notification count is fixed at three. | Real controls/data or removal of the apparent functionality. |
| Navigation history | Major pages use component state at the same URL. | Deliberate Back/Forward, reload, deep-link, and bookmark behavior. |
| Data deletion | Career deletion is scoped; admin privacy buttons are inert and full account deletion is absent. | A complete, truthful user/support workflow across all stored account data. |
| Public product claims | Homepage copy advertises an AI writer, advanced tailoring, and a daily limit that do not match the currently reachable implementation. | Align copy, plan availability, and feature behavior with the release scope. |

## Functionality Status Matrix

Status labels distinguish a working API from a complete user-facing workflow.

| User journey | Status | Evidence and remaining gap |
| --- | --- | --- |
| Email login/logout | Working, with UI defects | User/admin browser login and logout worked; duplicate dialogs and recovery gaps remain. |
| Registration | Implemented, partially reachable | Free-plan signup path exists; dialog switch is disabled. Account creation was not submitted in this browser pass. |
| OAuth sign-in | Unavailable through current UI | Provider backend code exists; Google button disabled. Live provider authentication not tested. |
| Initial onboarding | Implemented, not fully exercised here | Questionnaire, import, persistence, and analysis orchestration exist; retry/edit lifecycle needs work. |
| Resume explicit save and library preview | Working backend/browser path | Saved title/content reached the DB and library; editor navigation can restore stale content. |
| Draft recovery and editor navigation | Failing | New draft value reached the DB, then UI navigation restored the older content. |
| PDF/DOCX resume import | Working for tested inputs | Sample ATS DOCX parse returned 200. Existing tests cover other cases; browser import and every source format were not re-exercised here. |
| Template selection/rendering | Implemented, partially reviewed | UI catalog has 20 entries; admin API reports six. Mobile inline switching is hidden. |
| Resume PDF download | Visually generated; text compatibility fails | Actual download had zero extractable text; own parser rejected it with 422. |
| Cover-letter generation | API works; normal UI entry missing | Generation returned 201; backend PDF returned 200 and extractable text. |
| ATS/job-description analysis | API works; Toolkit entry missing | Focused request returned 200 with a score. |
| Career profile analysis | API works; resume context incomplete | Generation returned 200; refresh does not select the active resume. |
| Improvements | Partial | Rules render, but can use stale parent state and generic role keywords. |
| Job tracker | API works; complete UI workflow missing | Create returned 201 and interview update returned 200. Main Jobs screen uses samples/artificial ranking. |
| Versions | Partial/failing restore linkage | UI-equivalent create returned 201; restore returned 400 because resume ID was omitted. |
| Data export | Career API works | Returned 200; full-account coverage and reachable UI need completion. |
| Profile sync | Demonstration behavior | Source flags and updates do not establish a live sync. |
| Auto-apply preparation/approval | Demonstration behavior | Fixed records; Approve selected had no effect. |
| Admin reads | Working API, misleading dashboard metrics | Users returned 200 and were displayed; several counts are hard-coded. |
| Admin management actions | Incomplete | Open user did nothing; switches/policy/privacy controls are not wired. |
| Paid plans | Explicitly unavailable | Plans marked coming soon; billing was not tested. |
| Contact/support | Implemented, not exercised here | Form persistence and SMTP reply code exist; signed-in entry and actual delivery need verification. |

## Recommended Functional Completion Order

1. Fix shared editor state, save callbacks, draft identity/recovery, and navigation preservation.
2. Make supported tools reachable on desktop and mobile; remove overlapping auth dialogs.
3. Produce reliable text-based resume downloads and validate export/import round trips.
4. Carry the selected resume/version consistently into analysis, cover letters, jobs, and snapshots.
5. Replace sample jobs, packets, admin metrics, and inactive controls with real operations or clearly unavailable features.
6. Complete secondary lifecycles: versions, tracker status changes, LinkedIn import/save, onboarding edits, sharing, and account maintenance.
7. Add browser regressions around the complete journeys, including failure and reload cases.

## Regression Scenarios to Add

- Save an edit, navigate through every supported tab, return, and verify exact field values and the saved record ID.
- Autosave without explicit Save, reload, and verify the defined recovery behavior; ensure a stale mount cannot overwrite the newer draft.
- Create a new resume, save, leave, return, and update it without creating an unintended duplicate or reverting to another resume.
- Open resume A while resume B is newer; verify analysis, letters, job packets, and versions use the explicitly selected document.
- Complete supported journeys at mobile width using the same available features as desktop.
- Download each supported resume format, compare text with the editor, and parse the exported text-based PDF again.
- Save a linked version, edit the resume, restore the version, and verify the restored content after reload.
- Start with zero jobs/packets; verify honest empty states and counts. Then prepare and approve real records and reload.
- Use admin search/detail/policy actions and verify database-backed results, authorization, and persistence.
- Enter supported international names/addresses and verify they survive editing, saving, import, and export unchanged.
- Interrupt import, autosave, analysis, and onboarding requests; verify accurate errors and safe retry without duplicated or lost records.

Application source was not changed during this review. The findings are supported by a combination of browser reproduction, focused API requests, existing automated tests, and explicitly labeled code inspection.
