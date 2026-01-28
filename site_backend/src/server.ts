import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth';
import agentRoutes from './routes/agent';
import resumesRoutes from './routes/resumes';
import coverLettersRoutes from './routes/coverLetters';
import profileRoutes from './routes/profile';
import adminRoutes from './routes/admin';

const app = express();

// Fail fast if critical env vars are missing (avoid runtime surprises).
const required = ['JWT_SECRET', 'DATABASE_URL', 'GEMINI_API_KEY'];
for (const k of required) {
  if (!process.env[k]) {
    // eslint-disable-next-line no-console
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

app.use(helmet());

// Allow local dev frontend (Vite) + configurable origins for prod.
const defaultOrigins = ['http://localhost:4000', 'http://127.0.0.1:4000'];
const extra = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...extra])];

app.use(cors({
  origin: (origin, cb) => {
    // Allow non-browser tools (no Origin header) like curl/postman
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

// Resume uploads (base64) can be larger than 1MB.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '15mb' }));

// Note: OAuth/SSO is currently disabled (passport removed).


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});
app.use(limiter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Services
app.use('/auth', authRoutes);
app.use('/agent', agentRoutes);
app.use('/resumes', resumesRoutes);
app.use('/cover-letters', coverLettersRoutes);
app.use('/profile', profileRoutes);
app.use('/admin', adminRoutes);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
});
