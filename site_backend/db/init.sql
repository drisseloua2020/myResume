-- Refactored DB schema: Authentication + Agent services only
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role          TEXT NOT NULL CHECK (role IN ('admin','user')),
  plan          TEXT NOT NULL CHECK (plan IN ('free','monthly','yearly')),
  status        TEXT NOT NULL DEFAULT 'Active',
  paid_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  auth_provider TEXT NOT NULL DEFAULT 'email',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ACTIVITY LOGS
CREATE TABLE activity_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name  TEXT NOT NULL,
  action     TEXT NOT NULL,
  details    TEXT,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DATA SOURCES (per-user)
CREATE TABLE data_sources (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  last_sync    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- AGENT UPDATES (per-user)
CREATE TABLE agent_updates (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source       TEXT NOT NULL,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  date_found   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL CHECK (status IN ('pending','accepted','rejected')) DEFAULT 'pending'
);

-- Seed users (NOTE: password_hash contains legacy plaintext 'password' to allow first login; it will be upgraded to argon2 on first successful login)
INSERT INTO users (id, name, email, password_hash, role, plan, status, paid_amount, auth_provider, created_at, updated_at)
VALUES
  ('1', 'Admin User', 'admin@resumeforge.com', 'password', 'admin', 'yearly', 'Active', 0.00, 'email', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
  ('2', 'Demo User',  'user@example.com',     'password', 'user',  'free',   'Active', 0.00, 'email', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z');

INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
VALUES
  ('101', '2', 'Demo User', 'USER_SIGNUP', NULL, '2024-01-02T10:00:00Z');

-- Default sources for demo user (will also be auto-created on-demand for any user)
INSERT INTO data_sources (id, user_id, name, icon, is_connected, last_sync)
VALUES
  ('s1', '2', 'LinkedIn', 'linkedin', true,  now() - interval '2 hours'),
  ('s2', '2', 'GitHub',   'github',   true,  now() - interval '10 minutes'),
  ('s3', '2', 'University Portal', 'school', false, NULL);

-- Contact messages (users -> us)
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY,
  -- Align with users.id which is TEXT (e.g. "u-...")
  user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id ON contact_messages(user_id);

-- =============================
-- Resume Library
-- =============================
CREATE TABLE IF NOT EXISTS resumes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  -- Full resume payload (ParsedResponse + metadata) stored as JSONB
  content       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_created_at ON resumes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_template_id ON resumes(template_id);

-- =============================
-- Resume Drafts (autosave workspace state)
-- =============================
CREATE TABLE IF NOT EXISTS resume_drafts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Empty string means "default" bucket
  template_id   TEXT NOT NULL DEFAULT '',
  -- Workspace/editor state stored as JSONB
  content       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep one draft per user per template bucket (idempotent)
DO $$
BEGIN
  ALTER TABLE resume_drafts
    ADD CONSTRAINT ux_resume_drafts_user_template UNIQUE (user_id, template_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_resume_drafts_user_updated_at
  ON resume_drafts(user_id, updated_at DESC);

-- =============================
-- Cover Letters
-- =============================
CREATE TABLE IF NOT EXISTS cover_letters (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id     TEXT,
  title           TEXT NOT NULL,
  job_description TEXT NOT NULL,
  content         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cover_letters_user_created_at ON cover_letters(user_id, created_at DESC);

-- =============================
-- Profile Sync Updates (external profile -> resume delta feed)
-- =============================
CREATE TABLE IF NOT EXISTS profile_sync_updates (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source     TEXT NOT NULL,
  category   TEXT NOT NULL,
  title      TEXT NOT NULL,
  details    TEXT NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_sync_updates_user_created_at ON profile_sync_updates(user_id, created_at DESC);

-- =============================
-- OAuth Accounts (SSO connections)
-- =============================
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_email   TEXT,
  access_token     TEXT,
  refresh_token    TEXT,
  scope            TEXT,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_provider ON oauth_accounts(user_id, provider);

-- =============================
-- Profile Source Catalog (admin-managed)
-- =============================
CREATE TABLE IF NOT EXISTS profile_sources_catalog (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT 'link',
  oauth_provider TEXT,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

-- Seed catalog (idempotent)
INSERT INTO profile_sources_catalog (id, name, icon, oauth_provider, is_enabled)
VALUES
  ('psc-linkedin',  'LinkedIn',  'linkedin',  'linkedin',  true),
  ('psc-github',    'GitHub',    'github',    'github',    true),
  ('psc-google',    'Google',    'google',    'google',    true),
  ('psc-microsoft', 'Microsoft', 'microsoft', 'microsoft', true)
ON CONFLICT (name) DO NOTHING;
