import argon2 from 'argon2';
import jwt, { Secret } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { query } from './db';

export type UserRole = 'admin' | 'user';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface DbUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  plan: 'free' | 'monthly' | 'yearly';
  status: string;
  paid_amount: number; // numeric from pg => JS number
  auth_provider: string;
  password_hash: string | null;
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

/**
 * Supports two formats:
 * 1) argon2 hash (preferred): string starts with "$argon2"
 * 2) legacy plaintext (seed/dev only): compares directly and can be upgraded after a successful login
 */
export async function verifyPassword(stored: string | null, plain: string): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (!stored) return { ok: false, needsUpgrade: false };

  const trimmed = stored.trim();

  // Argon2 hash
  if (trimmed.startsWith('$argon2')) {
    try {
      const ok = await argon2.verify(trimmed, plain);
      return { ok, needsUpgrade: false };
    } catch {
      return { ok: false, needsUpgrade: false };
    }
  }

  // Legacy plaintext
  const ok = trimmed === plain;
  return { ok, needsUpgrade: ok };
}

export function signToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET as Secret;
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
}

export function authMiddleware(req: Request & { user?: JwtPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Like authMiddleware, but does NOT fail the request when no/invalid token is provided.
 * Useful for endpoints that accept both authenticated and anonymous traffic.
 */
export function optionalAuthMiddleware(req: Request & { user?: JwtPayload }, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = payload;
  } catch {
    // ignore
  }
  return next();
}

export function requireRole(roles: UserRole[]) {
  return (req: Request & { user?: JwtPayload }, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const rows = await query<DbUser>(
    `SELECT id, email, name, role, plan, status, paid_amount::float8 AS paid_amount, auth_provider, password_hash
     FROM users
     WHERE lower(email) = lower($1)`,
    [email]
  );
  return rows[0] || null;
}

export async function findUserById(userId: string): Promise<DbUser | null> {
  const rows = await query<DbUser>(
    `SELECT id, email, name, role, plan, status, paid_amount::float8 AS paid_amount, auth_provider, password_hash
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export function formatPaidAmount(n: number): string {
  const val = Number.isFinite(n) ? n : 0;
  return `$${val.toFixed(2)}`;
}
