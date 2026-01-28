import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../auth';
import { query } from '../db';
import { sendSupportEmail } from '../services/mailer';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// --- Templates catalog ---
const TEMPLATE_CATALOG = [
  { id: 'classic_pro', name: 'Classic Professional', tag: 'Conservative' },
  { id: 'modern_tech', name: 'Modern Tech', tag: 'Modern' },
  { id: 'creative_bold', name: 'Creative Bold', tag: 'Creative' },
  { id: 'executive_lead', name: 'Executive Lead', tag: 'Leadership' },
  { id: 'minimalist_clean', name: 'Minimalist Clean', tag: 'Simple' },
  { id: 'compact_grid', name: 'Compact Grid', tag: 'Technical' },
];

router.use(authMiddleware, requireRole(['admin']));

// =============================
// Admin: Users & activity logs
// =============================

router.get('/users', async (_req, res) => {
  const rows = await query(
    `SELECT id, name, email, role, plan, status, paid_amount::float8 AS paid_amount, auth_provider, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT 1000`
  );
  return res.json({ users: rows });
});

router.get('/activity-logs', async (_req, res) => {
  const rows = await query(
    `SELECT id, user_id AS "userId", user_name AS "userName", action, details, timestamp
     FROM activity_logs
     ORDER BY timestamp DESC
     LIMIT 2000`
  );
  return res.json({ logs: rows });
});

router.get('/templates', async (_req, res) => {
  return res.json({ templates: TEMPLATE_CATALOG });
});

// --- Profile sources catalog (admin-managed) ---
router.get('/profile-sources', async (_req, res) => {
  const rows = await query(
    `SELECT id, name, icon, oauth_provider AS "oauthProvider", is_enabled AS "isEnabled", created_at AS "createdAt"
     FROM profile_sources_catalog
     ORDER BY created_at DESC`
  );
  return res.json({ sources: rows });
});

const createSourceSchema = z.object({
  name: z.string().min(2).max(80),
  icon: z.string().min(1).max(40).default('link'),
  oauthProvider: z.string().min(2).max(40).optional(),
});

router.post('/profile-sources', async (req, res) => {
  const parsed = createSourceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { name, icon, oauthProvider } = parsed.data;
  const id = `psc-${uuidv4()}`;

  await query(
    `INSERT INTO profile_sources_catalog (id, name, icon, oauth_provider, is_enabled)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (name) DO NOTHING`,
    [id, name.trim(), icon.trim(), oauthProvider?.trim() ?? null]
  );

  const rows = await query(
    `SELECT id, name, icon, oauth_provider AS "oauthProvider", is_enabled AS "isEnabled", created_at AS "createdAt"
     FROM profile_sources_catalog
     ORDER BY created_at DESC`
  );

  return res.status(201).json({ sources: rows });
});

router.patch('/profile-sources/:id/toggle', async (req, res) => {
  const id = req.params.id as string;
  const rows = await query<{ is_enabled: boolean }>(
    `SELECT is_enabled FROM profile_sources_catalog WHERE id = $1`,
    [id]
  );
  const current = rows[0];
  if (!current) return res.status(404).json({ error: 'Not found' });

  const next = !current.is_enabled;
  await query(`UPDATE profile_sources_catalog SET is_enabled = $1 WHERE id = $2`, [next, id]);

  const updated = await query(
    `SELECT id, name, icon, oauth_provider AS "oauthProvider", is_enabled AS "isEnabled", created_at AS "createdAt"
     FROM profile_sources_catalog
     ORDER BY created_at DESC`
  );

  return res.json({ sources: updated });
});


// =============================
// Admin: Activity data
// =============================

// Contact messages list
router.get('/contact-messages', authMiddleware, requireRole(['admin']), async (_req, res) => {
  const rows = await query(
    `SELECT id::text AS id, user_id AS "userId", name, email, subject, message, status, created_at AS "createdAt"
     FROM contact_messages
     ORDER BY created_at DESC
     LIMIT 500`
  );
  return res.json({ messages: rows });
});

const replySchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
});

router.post('/contact-messages/:id/reply', authMiddleware, requireRole(['admin']), async (req: any, res) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { subject, message } = parsed.data;
  const id = req.params.id;

  const rows = await query<{ email: string; name: string }>(
    `SELECT email, name FROM contact_messages WHERE id::text = $1`,
    [id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const recipient = rows[0];

  try {
    await sendSupportEmail({ to: recipient.email, subject, text: message });

    await query(`UPDATE contact_messages SET status = 'replied' WHERE id::text = $1`, [id]);

    await query(
      `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        uuidv4(),
        req.user.userId,
        req.user.name,
        'contact_reply',
        JSON.stringify({ contactMessageId: id, to: recipient.email, subject }),
      ]
    );

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to send email', details: e?.message || String(e) });
  }
});

// Resumes list (admin)
router.get('/resumes', authMiddleware, requireRole(['admin']), async (_req, res) => {
  const rows = await query(
    `SELECT r.id, r.user_id AS "userId", u.email AS "userEmail", u.name AS "userName",
            r.template_id AS "templateId", r.title, r.created_at AS "createdAt", r.updated_at AS "updatedAt"
     FROM resumes r
     JOIN users u ON u.id = r.user_id
     ORDER BY r.created_at DESC
     LIMIT 500`
  );
  return res.json({ resumes: rows });
});

// Agent updates list (admin)
router.get('/agent-updates', authMiddleware, requireRole(['admin']), async (_req, res) => {
  const rows = await query(
    `SELECT a.id, a.user_id AS "userId", u.email AS "userEmail", u.name AS "userName",
            a.source, a.type, a.title, a.description, a.date_found AS "dateFound", a.status
     FROM agent_updates a
     JOIN users u ON u.id = a.user_id
     ORDER BY a.date_found DESC
     LIMIT 500`
  );
  return res.json({ updates: rows });
});

export default router;
