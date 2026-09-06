# Run and deploy MyResumes

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Point the frontend to the FastAPI backend if needed:
   `VITE_API_URL=http://localhost:3000`
   Optional Career OS migration flags:
   `VITE_FEATURE_CAREER_OS_EXPERIENCE=false`
   `VITE_FEATURE_CAREER_OS_NAVIGATION=false`
3. Run the app:
   `npm run dev`


## Security note

Resume parsing and cover letter generation are deterministic backend scripts by default. They do not call Gemini, LLMs, or agentic AI services unless a future backend AI gateway is explicitly enabled.

1) (Optional) Point the frontend to your backend with `VITE_API_URL`.
   To preview Career OS navigation during migration, set `VITE_FEATURE_CAREER_OS_EXPERIENCE=true`.

2) Run:
- Backend: `cd services && python -m uvicorn app.main:app --reload`
- Frontend: `npm i && npm run dev`

Also: never commit `.env` files containing secrets.
