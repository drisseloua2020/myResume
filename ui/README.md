# Run and deploy MyResumes

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Point the frontend to the FastAPI backend if needed:
   `VITE_API_URL=http://localhost:3000`
3. Run the app:
   `npm run dev`


## Security note

Resume parsing and cover letter generation are deterministic backend scripts. They do not call Gemini, LLMs, or agentic AI services.

1) (Optional) Point the frontend to your backend with `VITE_API_URL`.

2) Run:
- Backend: `cd services && python -m uvicorn app.main:app --reload`
- Frontend: `npm i && npm run dev`

Also: never commit `.env` files containing secrets.
