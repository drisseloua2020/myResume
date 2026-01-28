import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth';
import { query, withTransaction } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

type SourceRow = {
  id: string;
  name: string;
  icon: string;
  is_connected: boolean;
  last_sync: string | null;
};

const DEFAULT_SOURCES: Array<{ name: string; icon: string }> = [
  { name: 'LinkedIn', icon: 'linkedin' },
  { name: 'GitHub', icon: 'github' },
  // "Universal" source (internal name kept as University Portal for backwards-compat)
  { name: 'University Portal', icon: 'school' },
];

async function ensureDefaultSources(userId: string) {
  const existing = await query<{ name: string }>(
    `SELECT name FROM data_sources WHERE user_id = $1`,
    [userId]
  );
  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
  for (const s of DEFAULT_SOURCES) {
    if (!existingNames.has(s.name.toLowerCase())) {
      await query(
        `INSERT INTO data_sources (id, user_id, name, icon, is_connected, last_sync)
         VALUES ($1, $2, $3, $4, false, NULL)`,
        [`ds-${uuidv4()}`, userId, s.name, s.icon]
      );
    }
  }
}

function normalizeSourceKey(key: string) {
  const k = (key || '').toLowerCase().trim();
  if (k === 'linkedin') return 'LinkedIn';
  if (k === 'github') return 'GitHub';
  if (k === 'universal' || k === 'university' || k === 'university portal') return 'University Portal';
  return null;
}

type UpdateRow = {
  id: string;
  source: string;
  category: string;
  title: string;
  details: string;
  payload: any;
  created_at: string;
};

function toDto(r: UpdateRow) {
  return {
    id: r.id,
    source: r.source,
    category: r.category,
    title: r.title,
    details: r.details,
    payload: r.payload,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

// List sync updates (newest first)
router.get('/updates', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  await ensureDefaultSources(userId);
  const rows = await query<UpdateRow>(
    `SELECT id, source, category, title, details, payload, created_at
     FROM profile_sync_updates
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [userId]
  );
  return res.json({ updates: rows.map(toDto) });
});

// List available sources + connection state
router.get('/sources', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  await ensureDefaultSources(userId);
  const rows = await query<SourceRow>(
    `SELECT id, name, icon, is_connected, last_sync
     FROM data_sources
     WHERE user_id = $1
     ORDER BY name ASC`,
    [userId]
  );

  return res.json({
    sources: rows.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      isConnected: r.is_connected,
      lastSync: r.last_sync ? new Date(r.last_sync).toISOString() : null,
    })),
  });
});

// "Connect" a source (stub for now; production would require OAuth)
router.post('/sources/:source/connect', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  await ensureDefaultSources(userId);

  const sourceName = normalizeSourceKey(req.params.source);
  if (!sourceName) {
    return res.status(400).json({ error: 'Unknown source' });
  }

  await query(
    `UPDATE data_sources
     SET is_connected = true, last_sync = COALESCE(last_sync, now())
     WHERE user_id = $1 AND name = $2`,
    [userId, sourceName]
  );

  const rows = await query<SourceRow>(
    `SELECT id, name, icon, is_connected, last_sync
     FROM data_sources
     WHERE user_id = $1
     ORDER BY name ASC`,
    [userId]
  );

  return res.json({
    sources: rows.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      isConnected: r.is_connected,
      lastSync: r.last_sync ? new Date(r.last_sync).toISOString() : null,
    })),
  });
});

const syncSchema = z.object({
  // In the future, could accept a list of providers to sync.
  providers: z.array(z.string()).optional(),
});

// Trigger a "bot" sync (mock) based on connected sources
router.post('/sync', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  await ensureDefaultSources(userId);
  const parsed = syncSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const providerFilter = new Set((parsed.data.providers ?? []).map((p) => p.toLowerCase()));

  const sources = await query<{ name: string; is_connected: boolean }>(
    `SELECT name, is_connected FROM data_sources WHERE user_id = $1`,
    [userId]
  );

  const oauth = await query<{ provider: string }>(
    `SELECT provider FROM oauth_accounts WHERE user_id = $1`,
    [userId]
  );

  const connectedNames = new Set(
    sources.filter((s) => s.is_connected).map((s) => s.name.toLowerCase())
  );
  for (const o of oauth) connectedNames.add(o.provider.toLowerCase());

  const effectiveProviders = providerFilter.size > 0
    ? [...connectedNames].filter((p) => providerFilter.has(p))
    : [...connectedNames];

  if (effectiveProviders.length === 0) {
    return res.json({ updates: [] });
  }

  const nowIso = new Date().toISOString();
  const candidates = [
    {
      source: 'LinkedIn',
      category: 'Certification',
      title: 'New certification detected',
      details: 'A new certification was added to your LinkedIn profile.',
      payload: { kind: 'certification', example: 'AWS Solutions Architect' },
    },
    {
      source: 'GitHub',
      category: 'Project',
      title: 'New repository activity',
      details: 'Recent repository activity suggests a new project worth adding.',
      payload: { kind: 'repo', example: 'resume-builder-ai' },
    },
    {
      source: 'Microsoft',
      category: 'Education',
      title: 'New course completion',
      details: 'Detected a completed course / learning path.',
      payload: { kind: 'course', example: 'Azure Fundamentals' },
    },
    {
      source: 'Google',
      category: 'Experience',
      title: 'New achievement',
      details: 'Detected a new achievement that can improve your resume impact section.',
      payload: { kind: 'achievement' },
    },
  ];

  const toInsert = candidates.filter((c) => effectiveProviders.some((p) => p === c.source.toLowerCase()));

  await withTransaction(async (client) => {
    for (const u of toInsert) {
      await client.query(
        `INSERT INTO profile_sync_updates (id, user_id, source, category, title, details, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [
          `psu-${uuidv4()}`,
          userId,
          u.source,
          u.category,
          u.title,
          u.details,
          JSON.stringify(u.payload),
          nowIso,
        ]
      );
    }
  });

  // Update last_sync timestamps for any connected data_sources that were part of this sync
  const syncedSourceNames = Array.from(new Set(
    effectiveProviders
      .map((p) => normalizeSourceKey(p))
      .filter((n): n is Exclude<typeof n, null> => n !== null)
  ));
  if (syncedSourceNames.length > 0) {
    await query(
      `UPDATE data_sources
       SET last_sync = now()
       WHERE user_id = $1 AND name = ANY($2)`,
      [userId, syncedSourceNames]
    );
  }

  const rows = await query<UpdateRow>(
    `SELECT id, source, category, title, details, payload, created_at
     FROM profile_sync_updates
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );

  return res.json({ updates: rows.map(toDto) });
});

export default router;
