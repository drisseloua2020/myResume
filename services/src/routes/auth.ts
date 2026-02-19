import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, optionalAuthMiddleware, requireRole, findUserByEmail, findUserById, signToken, verifyPassword, hashPassword, formatPaidAmount } from '../auth';
import { query, withTransaction } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const planEnum = z.enum(['free', 'monthly', 'yearly']);
const providerEnum = z.enum(['google', 'linkedin', 'microsoft', 'github']);

function publicUser(u: any) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    plan: u.plan,
    status: u.status,
    createdAt: u.created_at ?? u.createdAt,
    paidAmount: formatPaidAmount(typeof u.paid_amount === 'number' ? u.paid_amount : parseFloat(u.paidAmount?.replace('$','') ?? '0') || 0),
    authProvider: u.auth_provider ?? u.authProvider ?? 'email',
  };
}

async function logActivity(userId: string, userName: string, action: string, details?: string) {
  await query(
    `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [`log-${uuidv4()}`, userId, userName, action, details ?? null]
  );
}

// --------- Auth: email/password ----------
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const verdict = await verifyPassword(user.password_hash, password);
  if (!verdict.ok) return res.status(401).json({ error: 'Invalid credentials' });

  // Optional: upgrade legacy plaintext to argon2 on successful login
  if (verdict.needsUpgrade) {
    const newHash = await hashPassword(password);
    await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [newHash, user.id]);
  }

  await logActivity(user.id, user.name, 'USER_LOGIN');

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  return res.json({ token, user: publicUser({ ...user, created_at: undefined }) });
});

// --------- Auth: signup ----------
const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  plan: planEnum.default('free'),
});

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { name, email, password, plan: requestedPlan } = parsed.data;
  // Pro plans are disabled (coming soon). Force everyone to FREE.
  const plan: 'free' = 'free';

  const existing = await findUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email already exists' });

  const userId = `u-${uuidv4()}`;
  // Pro plans are disabled.
  const paid = 0.0;

  const hashed = await hashPassword(password);

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, plan, status, paid_amount, auth_provider, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'user', $5, 'Active', $6, 'email', now(), now())`,
      [userId, name.trim(), email.toLowerCase(), hashed, plan, paid]
    );

    await client.query(
      `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
       VALUES ($1, $2, $3, 'USER_SIGNUP', $4, now())`,
      [`log-${uuidv4()}`, userId, name.trim(), `Plan: ${plan}${requestedPlan !== 'free' ? ' (requested upgrade: coming soon)' : ''}`]
    );
  });

  const created = await findUserById(userId);
  if (!created) return res.status(500).json({ error: 'Failed to create user' });

  const token = signToken({ userId: created.id, email: created.email, role: created.role });
  return res.status(201).json({ token, user: publicUser(created) });
});

// --------- Auth: provider (mock SSO) ----------
const providerSchema = z.object({
  provider: providerEnum,
  plan: planEnum.optional().default('free'),
});

router.post('/provider', async (req, res) => {
  const parsed = providerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { provider, plan: requestedPlan } = parsed.data;
  // Pro plans are disabled (coming soon). Force everyone to FREE.
  const plan: 'free' = 'free';
  const email = `user@${provider}.com`;

  const existing = await findUserByEmail(email);
  if (existing) {
    await logActivity(existing.id, existing.name, 'USER_LOGIN', `via ${provider}`);
    const token = signToken({ userId: existing.id, email: existing.email, role: existing.role });
    return res.json({ token, user: publicUser(existing) });
  }

  const userId = `u-${uuidv4()}`;
  const name = `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`;
  const paid = 0.0;

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, plan, status, paid_amount, auth_provider, created_at, updated_at)
       VALUES ($1, $2, $3, NULL, 'user', $4, 'Active', $5, $6, now(), now())`,
      [userId, name, email, plan, paid, provider]
    );

    await client.query(
      `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
       VALUES ($1, $2, $3, 'USER_SIGNUP', $4, now())`,
      [`log-${uuidv4()}`, userId, name, `via ${provider} (Plan: ${plan})${requestedPlan !== 'free' ? ' (requested upgrade: coming soon)' : ''}`]
    );
  });

  const created = await findUserById(userId);
  if (!created) return res.status(500).json({ error: 'Failed to create user' });

  const token = signToken({ userId: created.id, email: created.email, role: created.role });
  return res.status(201).json({ token, user: publicUser(created) });
});

// --------- Session ----------
router.get('/me', authMiddleware, async (req: any, res) => {
  const user = await findUserById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: publicUser(user) });
});

// User: change own plan (allows upgrades/downgrades). In a real app this would
// be guarded by payment-provider verification. Here we just update DB + audit.
const updateMyPlanSchema = z.object({
  plan: planEnum,
});

router.patch('/me/plan', authMiddleware, async (req: any, res) => {
  const parsed = updateMyPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const userId = req.user.userId as string;
  const { plan: requestedPlan } = parsed.data;

  if (requestedPlan !== 'free') {
    return res.status(409).json({ error: 'Pro plans are coming soon. Your account remains on the Free plan.' });
  }

  const plan: 'free' = 'free';

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.plan === plan) {
    return res.json({ user: publicUser(user) });
  }

  // Pro plans are disabled.
  const planPrice = 0.0;

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users
       SET plan = $1,
           paid_amount = CASE WHEN $2 > 0 THEN paid_amount + $2 ELSE paid_amount END,
           updated_at = now()
       WHERE id = $3`,
      [plan, planPrice, userId]
    );

    await client.query(
      `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
       VALUES ($1, $2, $3, 'PLAN_SELECTED', $4, now())`,
      [`log-${uuidv4()}`, userId, user.name, `Plan: ${plan}`]
    );

    if (planPrice > 0) {
      await client.query(
        `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
         VALUES ($1, $2, $3, 'PAYMENT_SUCCEEDED', $4, now())`,
        [`log-${uuidv4()}`, userId, user.name, `Amount: $${planPrice.toFixed(2)}`]
      );
    }
  });

  const updated = await findUserById(userId);
  return res.json({ user: publicUser(updated) });
});

router.post('/logout', (_req, res) => {
  // Stateless JWT: client discards token
  return res.json({ ok: true });
});

// --------- Activity logging (best-effort client audit) ----------
const activitySchema = z.object({
  action: z.string().min(1).max(80),
  details: z.string().max(4000).optional(),
});

router.post('/activity', authMiddleware, async (req: any, res) => {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { action, details } = parsed.data;

  try {
    await query(
      `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        `log-${uuidv4()}`,
        req.user.userId,
        req.user.name,
        action,
        details ?? '',
      ]
    );
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to log activity', details: e?.message || String(e) });
  }
});

// --------- Admin tools (part of auth service) ----------
router.get('/users', authMiddleware, requireRole(['admin']), async (_req, res) => {
  const rows = await query(
    `SELECT id, name, email, role, plan, status, paid_amount::float8 AS paid_amount, auth_provider, created_at
     FROM users
     ORDER BY created_at DESC`
  );
  return res.json({ users: rows.map(publicUser) });
});

router.get('/logs', authMiddleware, requireRole(['admin']), async (_req, res) => {
  const rows = await query(
    `SELECT id, user_id AS "userId", user_name AS "userName", action, details, timestamp
     FROM activity_logs
     ORDER BY timestamp DESC`
  );
  return res.json({ logs: rows });
});

const updatePlanSchema = z.object({
  plan: planEnum,
  amount: z.string().min(1), // "$1.00" or "$1.00 / month"
});

router.patch('/users/:id/plan', authMiddleware, requireRole(['admin']), async (req: any, res) => {
  const parsed = updatePlanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }
  const userId = req.params.id as string;
  const { plan: requestedPlan } = parsed.data;

  if (requestedPlan !== 'free') {
    return res.status(409).json({ error: 'Pro plans are coming soon. Only the Free plan is available.' });
  }

  const plan: 'free' = 'free';

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Pro plans are disabled.
  const toAdd = 0;

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users
       SET plan = $1,
           paid_amount = paid_amount + $2,
           updated_at = now()
       WHERE id = $3`,
      [plan, toAdd, userId]
    );

    await client.query(
      `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
       VALUES ($1, $2, $3, 'PLAN_SELECTED', $4, now())`,
      [`log-${uuidv4()}`, userId, user.name, `Switched to ${plan}`]
    );

    if (toAdd > 0) {
      await client.query(
        `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
         VALUES ($1, $2, $3, 'PAYMENT_SUCCEEDED', $4, now())`,
        [`log-${uuidv4()}`, userId, user.name, `Amount: $${toAdd.toFixed(2)}`]
      );
    }
  });

  const updated = await findUserById(userId);
  return res.json({ user: updated ? publicUser(updated) : null });
});

const contactSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  subject: z.string().min(2).max(160),
  message: z.string().min(5).max(5000),
});

// POST /contact
// Accepts messages from authenticated OR anonymous users.
router.post("/contact", optionalAuthMiddleware, async (req: any, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: parsed.error.flatten(),
    });
  }

  const { name, email, subject, message } = parsed.data;
  const userId = req.user?.userId ?? null;

  const id = uuidv4();

  await query(
    `
    INSERT INTO contact_messages (id, user_id, name, email, subject, message)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [id, userId, name, email, subject, message]
  );

  return res.json({ ok: true, id });
});

export default router;
