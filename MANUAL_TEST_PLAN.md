# Manual End-to-End Test Plan

This plan validates the ResumeForge / My Resumes site from public entry through authenticated user workflows, admin workflows, generated artifacts, and production-domain behavior.

Use placeholders for environment-specific values:

```text
<FRONTEND_ORIGIN>  Example: https://www.example.com
<API_ORIGIN>       Example: https://api.example.com
<USER_EMAIL>       Test user email
<ADMIN_EMAIL>      Test admin email
```

Do not put real passwords, OAuth secrets, API keys, database URLs, or production customer data in this file or in screenshots.

## 1. Scope

In scope:

- Production DNS and deployment smoke tests
- Public pages and auth entry points
- Email/password signup, login, logout, and session behavior
- Google OAuth SSO
- Resume editor, template selection, autosave, save, preview, and download
- Resume import from PDF/DOC/DOCX
- Profile photo upload and protected image loading
- Resume library view/load/delete/download flows
- Cover letter generation, list/detail/delete/download flows
- Contact form
- Account settings and plan behavior
- Profile sync pages
- Admin-only pages and access control
- Responsive, cross-browser, and basic accessibility checks

Out of scope:

- Load testing
- Automated API fuzzing
- Payment processing, unless a payment provider is added later
- Real third-party data source validation beyond configured test connectors

## 2. Test Environments

Run the plan in each environment before release:

| Environment | Frontend | API | Notes |
| --- | --- | --- | --- |
| Local | `http://localhost:4000` | `http://localhost:3000` | Developer smoke test |
| Staging | `<STAGING_FRONTEND_ORIGIN>` | `<STAGING_API_ORIGIN>` | Preferred pre-release environment |
| Production | `<FRONTEND_ORIGIN>` | `<API_ORIGIN>` | Final release validation |

Recommended browsers:

- Chrome latest
- Edge latest
- Safari latest, if available
- Firefox latest
- Mobile Safari or Chrome on a real mobile device, if available

Recommended viewport checks:

- Desktop: 1440 x 900
- Laptop: 1280 x 800
- Tablet: 768 x 1024
- Mobile: 390 x 844

## 3. Test Accounts And Data

Create dedicated test accounts:

| Account | Purpose | Notes |
| --- | --- | --- |
| `<USER_EMAIL>` | Standard user | Must not have admin role |
| `<ADMIN_EMAIL>` | Admin user | Must have admin role in the database |
| Google test account | OAuth SSO | Must be allowed in Google OAuth test users if app is in testing mode |

Prepare files:

- `sample-resume.pdf`, text-based PDF with readable resume text
- `sample-resume.docx`, valid DOCX resume
- `unsupported-file.txt`, negative upload test
- `profile-photo.png`, under max configured file size
- `large-profile-photo.png`, over max configured file size

Prepare job inputs:

```text
Target role: Senior Software Engineer
Job URL: https://example.com/jobs/senior-software-engineer
Job description: Use a short copied test job description, not private company data.
```

## 4. Release Entry Criteria

Before starting manual QA:

- Backend deploy is complete.
- Frontend deploy is complete.
- Database migrations are applied.
- Required backend environment variables are set.
- Frontend `VITE_API_URL` points to the intended API origin.
- Google OAuth client uses the intended callback URL.
- Test accounts exist.
- Browser cache is cleared or an incognito window is used for auth tests.

## 4.1 QA Checkpoints

Use these checkpoints as go/no-go gates during manual testing. If a P0 checkpoint fails, stop the release test run, open a defect, and continue only after the issue is fixed or explicitly waived.

| Checkpoint | Run After | Required Evidence | Go / No-Go Criteria | Owner |
| --- | --- | --- | --- | --- |
| CP-00 Readiness | Section 4 | Deploy links, env var confirmation, test account confirmation | All entry criteria are met before testing begins. | Release owner |
| CP-01 Domain and API | Section 5 | DNS output, frontend `200 OK`, API health, OAuth diagnostics | Public frontend and API are reachable; OAuth callback points to the API origin. | Release owner |
| CP-02 User Auth | Section 6 | Email login result, Google SSO result, logout result | Standard user can sign up/log in/log out and Google SSO returns to the app. | QA |
| CP-03 Core User Journey | Sections 7-12 | Saved resume, loaded resume, downloaded PDF, generated cover letter | Standard user can create, save, reload, download, and generate core artifacts. | QA |
| CP-04 Admin and Access Control | Section 15 | Admin screenshots/logs, normal-user 403 evidence | Admin can load admin views; standard users cannot access admin data. | QA |
| CP-05 Security and Release | Sections 16-19 | Console/network pass, privacy scan notes, failed-test list | No P0 failures remain; sensitive data is not exposed; release recommendation is recorded. | QA + release owner |

Checkpoint sign-off format:

```text
Checkpoint:
Status: Pass / Fail / Waived
Tester:
Date/time:
Evidence:
Open defects:
Approver, if waived:
```

## 5. Production Domain Smoke Tests

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| DEP-01 | P0 | Frontend loads | Open `<FRONTEND_ORIGIN>/`. | Site returns `200 OK`; React app loads; no domain masking or frameset page is shown. |
| DEP-02 | P0 | API health | Open `<API_ORIGIN>/health`. | Response is `{"status":"ok"}`. |
| DEP-03 | P0 | OAuth diagnostics | Open `<API_ORIGIN>/auth/oauth/google/diagnostics`. | `redirectUri` is `<API_ORIGIN>/auth/oauth/google/callback`; `frontendRedirectBaseUrl` is `<FRONTEND_ORIGIN>`. |
| DEP-04 | P0 | DNS frontend | Run `Resolve-DnsName www.<ROOT_DOMAIN>`. | `www` points to the frontend hosting provider, not a forwarding or parking service. |
| DEP-05 | P0 | Browser console | Load `<FRONTEND_ORIGIN>/` and open DevTools Console and Network. | No failed app JS/CSS loads; no unexpected 401/403/404 calls on initial public load. |

## 6. Public And Auth Flows

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| AUTH-01 | P0 | Public auth screen loads | Open `<FRONTEND_ORIGIN>/` while signed out. | Auth screen displays; no authenticated navigation is visible. |
| AUTH-02 | P0 | Email signup | Sign up with a new test email and valid password. | User lands in the editor/workspace; token is stored; `/auth/me` succeeds. |
| AUTH-03 | P0 | Email login | Log out, then log in with the same test email. | User lands in the editor/workspace; previous saved data may load. |
| AUTH-04 | P0 | Logout | Click Log Out. | Session is cleared; auth screen appears; protected API calls stop. |
| AUTH-05 | P0 | Invalid login | Attempt login with wrong password. | Clear error is shown; user remains signed out. |
| AUTH-06 | P0 | Google SSO | Click Google login and complete the Google flow. | User returns to `<FRONTEND_ORIGIN>` authenticated; URL token/query params are cleaned up. |
| AUTH-07 | P0 | Google SSO callback | During SSO, inspect the Google auth URL. | `redirect_uri` points to `<API_ORIGIN>/auth/oauth/google/callback`. |
| AUTH-08 | P1 | Expired session | Clear/modify token in local storage, then reload. | App signs user out or prompts login; no broken authenticated UI state remains. |
| AUTH-09 | P1 | Non-admin access to admin URLs | As a normal user, attempt to navigate to admin-only views if possible. | Admin data does not load; backend returns 403; user cannot see admin content. |

## 7. Resume Editor And Template Flow

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| RES-01 | P0 | Start editor | Log in as standard user. | Editor/workspace loads. |
| RES-02 | P0 | Select template | Start a new resume and choose each available template once. | Selected template is reflected in preview; layout does not break. |
| RES-03 | P0 | Create resume from scratch | Fill personal details, experience, education, skills, target role, and preferences. | Live preview updates as fields change. |
| RES-04 | P0 | Save resume | Click Save Resume. | Success message appears; resume is persisted and appears in library. |
| RES-05 | P0 | Autosave draft | Edit a field, wait for debounce, refresh page. | Draft/latest resume reloads without losing recent edits. |
| RES-06 | P1 | New resume confirmation | With an existing loaded resume, click New Resume. | Confirmation appears; choosing template starts fresh without overwriting old resume. |
| RES-07 | P1 | Required field validation | Try to save/generate with missing required resume fields. | User sees clear validation; no invalid resume is saved. |
| RES-08 | P1 | Long text handling | Paste long summary, long skill list, and multi-line bullets. | Text stays readable; no overlap or layout collapse on desktop/mobile. |

## 8. Resume Import Flow

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| IMP-01 | P0 | Import PDF | Open Import File, upload `sample-resume.pdf`, click Import to Editor. | Text is parsed; editor fields populate; imported binary data is not saved in resume content. |
| IMP-02 | P0 | Import DOCX | Upload `sample-resume.docx`, click Import to Editor. | Editor fields populate correctly. |
| IMP-03 | P1 | Unsupported file | Upload `unsupported-file.txt`. | User sees supported format error; file is not processed. |
| IMP-04 | P1 | Empty/scanned PDF | Upload a scanned or unreadable PDF. | Clear error says readable text could not be extracted. |
| IMP-05 | P1 | Imported address parsing | Import resume with full street/city/state/postal code. | Address parts land in correct fields. |

## 9. Profile Photo Flow

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| PHOTO-01 | P0 | Upload valid photo | In editor, upload `profile-photo.png` and enable Include photo. | Photo appears in preview and is saved with protected upload URL. |
| PHOTO-02 | P0 | Reload protected photo | Save resume, refresh page, reopen resume. | Photo reloads using authenticated request; no visible broken image. |
| PHOTO-03 | P1 | Invalid photo type | Upload unsupported image/file type. | Clear validation message is shown. |
| PHOTO-04 | P1 | Too-large photo | Upload file larger than configured max. | API rejects upload; UI keeps local photo or shows clear upload error. |
| PHOTO-05 | P1 | Other user photo access | Try to fetch another user's protected photo URL, if available in test data. | Access is denied or not found. |

## 10. AI Resume Generation And Results

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| GEN-01 | P0 | Generate resume content | Complete editor data and click generate/resume action. | Generation completes; results view shows ATS, Human, Targeted, Photo, Gap/Fix, and cover letter sections as applicable. |
| GEN-02 | P0 | Save generated result | Save from results view. | Resume is saved and appears in library. |
| GEN-03 | P1 | Generation error handling | Temporarily use invalid AI provider config in staging or simulate backend error. | UI shows a non-crashing error message; user data remains in editor. |
| GEN-04 | P1 | Activity logging | Generate resume as standard user. | Activity appears in admin logs as a resume generation event. |

## 11. Resume Library

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| LIB-01 | P0 | List resumes | Open View Resume / Resume Library. | Saved resumes list with title, template, and timestamps. |
| LIB-02 | P0 | Load resume | Select a saved resume and load it into editor. | Editor fields and template match saved resume. |
| LIB-03 | P0 | Download resume PDF | Open a saved resume and download PDF. | PDF downloads; content is readable; no clipped or overlapping major sections. |
| LIB-04 | P1 | Delete resume | Delete a test resume and confirm modal. | Resume disappears from library; refresh confirms deletion. |
| LIB-05 | P1 | Cancel delete | Start delete and cancel. | Resume remains. |

## 12. Cover Letters

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| CL-01 | P0 | Generate from job URL | Open Cover Letters, enter target role and valid test job URL, generate. | Cover letter is created and saved. |
| CL-02 | P0 | Generate from pasted JD | Switch to pasted job description, enter test JD, generate. | Cover letter is created and saved. |
| CL-03 | P0 | List and open letter | Open saved cover letter from list. | Detail view shows full generated content. |
| CL-04 | P0 | Download PDF | Download cover letter PDF. | PDF downloads and is readable. |
| CL-05 | P1 | Delete letter | Delete a saved test cover letter. | Letter disappears from list. |
| CL-06 | P1 | Invalid job URL | Enter malformed URL. | Validation prevents generation with clear message. |
| CL-07 | P1 | No resume context | Generate with no saved resume/draft. | UI explains missing resume context or handles fallback gracefully. |

## 13. Contact And Account

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| CONTACT-01 | P0 | Submit contact message | Open Contact, fill subject/message, submit. | Success state appears; admin can see message. |
| CONTACT-02 | P1 | Contact validation | Submit empty or invalid form. | Required field errors appear. |
| ACCT-01 | P0 | Account page loads | Open Account. | Current user info and plan display correctly. |
| ACCT-02 | P1 | Plan update behavior | Try selecting unsupported/pro plan if UI exposes it. | User sees "coming soon" or remains on free plan as designed. |

## 14. Profile Sync

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| PROF-01 | P1 | Profile sources list | Open Profile Sync. | Available sources load. |
| PROF-02 | P1 | Connect source | Connect a test source if available. | Source status changes to connected or shows clear provider limitation. |
| PROF-03 | P1 | Sync profile | Click sync/check updates. | Updates list refreshes; no crash if no updates exist. |

## 15. Admin Workflows

Run these as `<ADMIN_EMAIL>`.

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| ADM-01 | P0 | Admin login routing | Log in as admin. | User lands on admin activity logs or admin navigation. |
| ADM-02 | P0 | Activity logs | Open Activity Logs. | Logs load; recent user actions are visible. |
| ADM-03 | P0 | Users | Open Users. | User list loads without exposing sensitive token/password data. |
| ADM-04 | P1 | Resumes | Open Admin Resumes. | Resume list loads with user metadata and no private binary blobs. |
| ADM-05 | P1 | Contact messages | Open Contact Messages. | Submitted contact messages are visible. |
| ADM-06 | P1 | Reply to contact | Send a reply if SMTP test config is available. | Reply succeeds or shows clear SMTP configuration error. |
| ADM-07 | P1 | Agent updates | Open Agent Updates. | Page loads and handles empty state. |
| ADM-08 | P1 | Admin-only API protection | As standard user, call or navigate to admin endpoints. | Backend returns 403; no admin data is displayed. |

## 16. Responsive, Accessibility, And UX

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| UX-01 | P0 | Mobile auth and editor | Test signup/login and editor on mobile viewport. | Controls are usable; text does not overlap. |
| UX-02 | P1 | Keyboard navigation | Tab through auth, editor, modals, and library. | Focus order is logical; modals can be dismissed. |
| UX-03 | P1 | Screen reader labels | Inspect main form fields/buttons. | Inputs have labels or accessible names. |
| UX-04 | P1 | Loading states | Trigger save/generate/upload actions. | Buttons show loading/disabled states and recover. |
| UX-05 | P1 | Error states | Disconnect API or simulate failed requests in staging. | UI shows clear error, not blank page. |

## 17. Security And Privacy Checks

| ID | Priority | Test | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| SEC-01 | P0 | No secrets in frontend bundle | Search built frontend JS for API keys, OAuth secrets, database URLs, and JWT secret values. | No secrets are present. |
| SEC-02 | P0 | Auth headers | Inspect protected API calls in Network tab. | Calls include bearer token only when authenticated; token is not placed in URL. |
| SEC-03 | P0 | Logout clears state | Log out and inspect local storage. | Session token and cached user are removed. |
| SEC-04 | P1 | Cross-user data isolation | Test two standard users. | User A cannot see User B resumes, cover letters, photos, or drafts. |
| SEC-05 | P1 | CORS | From frontend origin, call API normally. From an unapproved origin in staging, attempt API call. | Approved origin works; unapproved origin is blocked by browser CORS. |

## 18. Browser Console And Network Pass

Perform once after completing the main happy path:

1. Open DevTools Console.
2. Hard refresh the app.
3. Log in.
4. Save a resume.
5. Generate a cover letter.
6. Download a PDF.
7. Log out.

Expected:

- No uncaught JavaScript exceptions.
- No unexpected `403`, `404`, or CORS failures.
- Expected `401` only appears when intentionally testing expired/invalid sessions.
- No request URLs contain access tokens except transient OAuth provider redirects where expected.

## 19. Exit Criteria

Release can proceed when:

- All P0 tests pass.
- P1 failures are documented with owner, severity, and workaround.
- Google SSO succeeds from the public frontend origin.
- Resume save/load/download succeeds.
- Cover letter generate/list/download succeeds.
- Admin access is restricted to admin accounts.
- No sensitive values are found in frontend bundles, docs, screenshots, or logs prepared for GitHub.

## 20. Test Report Template

```text
Build/version:
Environment:
Tester:
Date:
Browser/device:

Summary:
- P0 passed:
- P0 failed:
- P1 passed:
- P1 failed:

Checkpoints:
- CP-00:
- CP-01:
- CP-02:
- CP-03:
- CP-04:
- CP-05:

Failed tests:
- ID:
  Result:
  Evidence:
  Expected:
  Actual:
  Owner:

Release recommendation:
```
