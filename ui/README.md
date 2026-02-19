# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1lgwf3xrHNiKW5x4Q-gwfOeQKRwVJjGVn

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Security note: do not expose Gemini API keys in the browser

This project now calls Gemini from the backend (`site_backend`) so your API key is **never** shipped to the client.

1) Set your key in `site_backend/.env` as:
- `GEMINI_API_KEY=...`

2) (Optional) Point the frontend to your backend:
- Create `myResume/.env.local` with `VITE_API_URL=http://localhost:3000`

3) Run:
- Backend: `cd site_backend && npm i && npm run dev`
- Frontend: `npm i && npm run dev`

Also: never commit `.env` files containing secrets.

