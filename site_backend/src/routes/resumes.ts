import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const createSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.any(), // JSON payload from frontend
});

const updateSchema = z.object({
  templateId: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.any().optional(),
});

// Workspace autosave draft (UserInputData/editor state)
const draftSchema = z.object({
  templateId: z.string().optional(),
  content: z.any(),
});

// Save a generated resume payload (JSON only)
router.post('/', authMiddleware, async (req: any, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const userId = req.user.userId as string;
  const { templateId, title, content } = parsed.data;
  const id = `res-${uuidv4()}`;

  await query(
    `INSERT INTO resumes (id, user_id, template_id, title, content, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())`,
    [id, userId, templateId, title, JSON.stringify(content ?? {})]
  );

  // audit
  await query(
    `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
     SELECT $1, u.id, u.name, 'RESUME_SAVE', $2, now()
     FROM users u WHERE u.id = $3`,
    [`log-${uuidv4()}`, `Template: ${templateId}`, userId]
  );

  return res.status(201).json({ id });
});

// List saved resumes (newest first)
router.get('/', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  const rows = await query(
    `SELECT id, template_id AS "templateId", title, updated_at AS "createdAt"
     FROM resumes
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );
  return res.json({ resumes: rows });
});

// ----------------------------
// Drafts (autosave / workspace)
// NOTE: These routes must appear before /:id to avoid route collisions.
// ----------------------------

// Upsert a draft for the current user and (optional) template
router.post('/draft', authMiddleware, async (req: any, res) => {
  const parsed = draftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }
  const userId = req.user.userId as string;
  const { templateId, content } = parsed.data;

  // Draft id is deterministic per user+template bucket (but keep UUID for easier debugging)
  const id = `draft-${uuidv4()}`;
  const bucket = templateId ?? '';
  await query(
    `INSERT INTO resume_drafts (id, user_id, template_id, content, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, now(), now())
     ON CONFLICT (user_id, template_id) DO UPDATE
       SET content = EXCLUDED.content,
           updated_at = now()`,
    [id, userId, bucket, JSON.stringify(content ?? {})]
  );

  // audit
  await query(
    `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
     SELECT $1, u.id, u.name, 'RESUME_DRAFT_SAVE', $2, now()
     FROM users u WHERE u.id = $3`,
    [`log-${uuidv4()}`, `Template: ${bucket || 'default'}`, userId]
  );

  return res.status(200).json({ ok: true });
});

// Fetch the latest draft (optionally for a template)
router.get('/latest-draft', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  const templateId = typeof req.query.templateId === 'string' ? (req.query.templateId as string) : undefined;
  const bucket = templateId ?? '';

  const rows = await query(
    `SELECT id, template_id AS "templateId", content, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM resume_drafts
     WHERE user_id = $1
       AND ($2::text = '' OR template_id = $2)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, bucket]
  );

  const row = rows[0];
  if (!row) return res.json({ draft: null });
  return res.json({ draft: row });
});

// Fetch a single resume (for JSON download)
// Update an existing saved resume (overwrite JSON content)
router.put('/:id', authMiddleware, async (req: any, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const userId = req.user.userId as string;
  const id = req.params.id as string;
  const { templateId, title, content } = parsed.data;

  if (!templateId && !title && typeof content === 'undefined') {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  const rows = await query(
    `UPDATE resumes
     SET template_id = COALESCE($1, template_id),
         title = COALESCE($2, title),
         content = COALESCE($3::jsonb, content),
         updated_at = now()
     WHERE user_id = $4 AND id = $5
     RETURNING id`,
    [
      templateId ?? null,
      title ?? null,
      typeof content === 'undefined' ? null : JSON.stringify(content ?? {}),
      userId,
      id
    ]
  );

  if (!rows[0]) return res.status(404).json({ error: 'Not found' });

  // audit
  await query(
    `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
     SELECT $1, u.id, u.name, 'RESUME_UPDATE', $2, now()
     FROM users u WHERE u.id = $3`,
    [`log-${uuidv4()}`, `Resume: ${id}`, userId]
  );

  return res.json({ ok: true });
});

router.get('/:id', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  const id = req.params.id as string;
  const rows = await query(
    `SELECT id, template_id AS "templateId", title, content, created_at AS "createdAt"
     FROM resumes
     WHERE user_id = $1 AND id = $2`,
    [userId, id]
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });

  // audit download view
  await query(
    `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
     SELECT $1, u.id, u.name, 'RESUME_DOWNLOAD', $2, now()
     FROM users u WHERE u.id = $3`,
    [`log-${uuidv4()}`, `Resume: ${id}`, userId]
  );

  return res.json({ resume: row });
});

router.delete('/:id', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  const id = req.params.id as string;

  await query(`DELETE FROM resumes WHERE user_id = $1 AND id = $2`, [userId, id]);
  return res.json({ ok: true });
});

export default router;
