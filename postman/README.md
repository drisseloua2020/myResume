# ResumeForge Postman project

This Postman project was generated from the **original Express/TypeScript codebase** in `services.zip`, not from the Python port.

## Files
- `ResumeForge_Original_API.postman_collection.json`
- `ResumeForge_Local.postman_environment.json`

## What it covers
It includes requests for every original endpoint:

- `GET /health`
- Auth: signup, login, provider login, me, me/plan, logout, activity, contact
- Admin-in-auth: users, logs, user plan update
- Agent: sources, toggle, check, updates, generate-resume
- Resumes: create, list, save draft, latest draft, update, get, delete
- Cover letters: generate, list, get, delete
- Profile: sources, connect, sync, updates
- Admin: users, activity-logs, templates, profile-sources, contact-messages, reply, resumes, agent-updates

## Default environment assumptions
- Base URL: `http://localhost:3000`
- Admin credentials come from the original seed SQL:
  - email: `admin@resumeforge.com`
  - password: `password`

The collection generates a fresh normal user automatically on every run.

## Flags
Two requests are included but skipped by default:

- `runAiTests=false`
  - skips `POST /agent/generate-resume`
  - skips `POST /cover-letters/generate`
- `runMailerTests=false`
  - skips `POST /admin/contact-messages/:id/reply`

Set either flag to `true` in the Postman environment if your app is configured with live Gemini / SMTP credentials.

## Known issues in the original codebase
These are not Postman problems; they come from the original service implementation:

1. `POST /auth/activity` is likely to fail on the untouched original code.
   - The JWT payload contains `userId`, `email`, and `role`
   - the route inserts `req.user.name` into `activity_logs.user_name`
   - `user_name` is `NOT NULL`

2. `POST /admin/contact-messages/:id/reply` may fail for the same JWT-name reason, and also depends on working SMTP settings.

The collection leaves those requests in place so the run can surface the implementation issues.

## How to use
1. Import the collection JSON into Postman
2. Import the environment JSON
3. Select the environment
4. Start the original service stack
5. Run the collection in order

## Suggested startup for the original project
```bash
docker compose up --build
```
