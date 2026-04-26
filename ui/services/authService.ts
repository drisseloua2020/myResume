import { api, setSession, clearSession, getCachedUser, getToken } from "./apiClient";



import { SubscriptionPlan, User } from "../types";

function toBackendPlan(_plan: any): "free" | "monthly" | "yearly" {
  // Pro plans are disabled (coming soon). Force FREE.
  return "free";
}

function fromBackendPlan(plan: any): SubscriptionPlan {
  if (plan === SubscriptionPlan.FREE || plan === SubscriptionPlan.MONTHLY || plan === SubscriptionPlan.YEARLY) return plan;
  switch (String(plan).toLowerCase()) {
    case "free":
      return SubscriptionPlan.FREE;
    case "monthly":
      return SubscriptionPlan.MONTHLY;
    case "yearly":
      return SubscriptionPlan.YEARLY;
    default:
      return SubscriptionPlan.FREE;
  }
}

function normalizeUser(raw: any): User {
  const u = { ...raw };
  u.plan = fromBackendPlan(u.plan);
  // ensure paidAmount is a string like "$0.00"
  if (typeof u.paidAmount === "number") u.paidAmount = `$${u.paidAmount.toFixed(2)}`;
  if (typeof u.paidAmount === "string" && u.paidAmount.trim() && !u.paidAmount.trim().startsWith("$")) {
    const n = Number(u.paidAmount);
    if (!Number.isNaN(n)) u.paidAmount = `$${n.toFixed(2)}`;
  }
  return u as User;
}

type Provider = "google" | "linkedin" | "microsoft" | "github";

class AuthService {
  async login(email: string, password: string): Promise<User> {
    const res = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    const user = normalizeUser(res.user);
    setSession(res.token, user);
    return user;
  }

  async signup(name: string, email: string, password: string, plan: SubscriptionPlan): Promise<User> {
    const res = await api.post<{ token: string; user: User }>("/auth/signup", { name, email, password, plan: toBackendPlan(plan) });
    const user = normalizeUser(res.user);
    setSession(res.token, user);
    return user;
  }

  async loginWithProvider(provider: Provider, plan?: SubscriptionPlan): Promise<User> {
    const res = await api.post<{ token: string; user: User }>("/auth/provider", { provider, plan: toBackendPlan(plan) });
    const user = normalizeUser(res.user);
    setSession(res.token, user);
    return user;
  }

  async logout(): Promise<void> {
    // Best-effort: tell backend we logged out (useful for audit logs).
    // JWTs are stateless, so the main effect is client discards token.
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore network/backend errors on logout
    } finally {
      clearSession();
    }
  }

  // User: change own plan (feature #9)
  async updateMyPlan(plan: SubscriptionPlan): Promise<User> {
    const res = await api.patch<{ user: User }>("/auth/me/plan", { plan: toBackendPlan(plan) });
    // Keep token, refresh cached user
    setSession(getToken()!, normalizeUser(res.user));
    return res.user;
  }

  getCurrentUser(): User | null {
    return getCachedUser<User>();
  }

  async refreshMe(): Promise<User | null> {
    if (!getToken()) return null;
    const res = await api.get<{ user: User }>("/auth/me");
    setSession(getToken()!, normalizeUser(res.user));
    return res.user;
  }

  // Admin only
  async getAllUsers(): Promise<User[]> {
    const res = await api.get<{ users: User[] }>("/auth/users");
    return res.users;
  }

  // Admin only
  async getLogs() {
    const res = await api.get<{ logs: any[] }>("/auth/logs");
    return res.logs;
  }

  /**
   * Client-side activity logging (best-effort).
   * The backend derives user identity from the JWT; client-supplied userId/name are ignored.
   */
  async logActivity(_userId: string, _userName: string, action: string, details?: string): Promise<void> {
    try {
      await api.post('/auth/activity', { action, details: details ?? '' });
    } catch {
      // Never block UX on audit logging failures
    }
  }

  // Admin only
  async updateUserPlan(userId: string, plan: SubscriptionPlan, amount: string) {
    const res = await api.patch<{ user: User }>(`/auth/users/${userId}/plan`, { plan, amount });
    return res.user;
  }
}

export const authService = new AuthService();