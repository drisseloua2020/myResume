import { User, UserRole, SubscriptionPlan, ActivityLog } from '../types';

// Initial Mock Data
const INITIAL_USERS: User[] = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@resumeforge.com',
    password: 'password',
    role: UserRole.ADMIN,
    plan: SubscriptionPlan.YEARLY,
    status: 'Active',
    createdAt: new Date('2024-01-01').toISOString(),
    paidAmount: '$0.00',
    authProvider: 'email'
  },
  {
    id: '2',
    name: 'Demo User',
    email: 'user@example.com',
    password: 'password',
    role: UserRole.USER,
    plan: SubscriptionPlan.FREE,
    status: 'Active',
    createdAt: new Date('2024-01-02').toISOString(),
    paidAmount: '$0.00',
    authProvider: 'email'
  }
];

const INITIAL_LOGS: ActivityLog[] = [
  {
    id: '101',
    userId: '2',
    userName: 'Demo User',
    action: 'USER_SIGNUP',
    timestamp: new Date('2024-01-02T10:00:00').toISOString()
  }
];

// Helper to simulate delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class AuthService {
  private users: User[];
  private logs: ActivityLog[];
  private currentUser: User | null = null;

  constructor() {
    // Try to load from localStorage to persist across reloads
    const storedUsers = localStorage.getItem('rf_users');
    const storedLogs = localStorage.getItem('rf_logs');
    const storedSession = localStorage.getItem('rf_session');

    this.users = storedUsers ? JSON.parse(storedUsers) : INITIAL_USERS;
    this.logs = storedLogs ? JSON.parse(storedLogs) : INITIAL_LOGS;
    this.currentUser = storedSession ? JSON.parse(storedSession) : null;
  }

  private save() {
    localStorage.setItem('rf_users', JSON.stringify(this.users));
    localStorage.setItem('rf_logs', JSON.stringify(this.logs));
    if (this.currentUser) {
      localStorage.setItem('rf_session', JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem('rf_session');
    }
  }

  async login(email: string, password: string): Promise<User> {
    await delay(500);
    const user = this.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
      throw new Error("Invalid credentials");
    }
    this.currentUser = user;
    this.logActivity(user.id, user.name, 'USER_LOGIN');
    this.save();
    return user;
  }

  async loginWithProvider(provider: 'google' | 'linkedin' | 'microsoft' | 'github', plan?: SubscriptionPlan): Promise<User> {
    await delay(1200); // Simulate redirect delay

    // Check if user exists for this provider
    const email = `user@${provider}.com`; // Mock email based on provider
    let user = this.users.find(u => u.email === email);

    if (user) {
       this.currentUser = user;
       this.logActivity(user.id, user.name, 'USER_LOGIN', `via ${provider}`);
       this.save();
       return user;
    }

    // Determine initial payment if this is a new signup via SSO
    let initialPaid = '$0.00';
    const selectedPlan = plan || SubscriptionPlan.FREE;
    if (selectedPlan === SubscriptionPlan.MONTHLY) initialPaid = '$1.00';
    if (selectedPlan === SubscriptionPlan.YEARLY) initialPaid = '$9.00';

    // Create new user
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
      email: email,
      role: UserRole.USER,
      plan: selectedPlan,
      status: 'Active',
      createdAt: new Date().toISOString(),
      paidAmount: initialPaid,
      authProvider: provider
    };

    this.users.push(newUser);
    this.currentUser = newUser;
    this.logActivity(newUser.id, newUser.name, 'USER_SIGNUP', `via ${provider} (Plan: ${selectedPlan})`);
    
    if (selectedPlan !== SubscriptionPlan.FREE) {
        this.logActivity(newUser.id, newUser.name, 'PAYMENT_SUCCEEDED', `Amount: ${initialPaid}`);
    }
    
    this.save();
    return newUser;
  }

  async signup(name: string, email: string, password: string, plan: SubscriptionPlan): Promise<User> {
    await delay(500);
    if (this.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("User already exists");
    }

    // Determine initial payment
    let initialPaid = '$0.00';
    if (plan === SubscriptionPlan.MONTHLY) initialPaid = '$1.00';
    if (plan === SubscriptionPlan.YEARLY) initialPaid = '$9.00';

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      email,
      password,
      role: UserRole.USER,
      plan: plan,
      status: 'Active',
      createdAt: new Date().toISOString(),
      paidAmount: initialPaid,
      authProvider: 'email'
    };

    this.users.push(newUser);
    this.currentUser = newUser;
    this.logActivity(newUser.id, newUser.name, 'USER_SIGNUP', `Plan: ${plan}`);
    if (plan !== SubscriptionPlan.FREE) {
        this.logActivity(newUser.id, newUser.name, 'PAYMENT_SUCCEEDED', `Amount: ${initialPaid}`);
    }
    this.save();
    return newUser;
  }

  logout() {
    this.currentUser = null;
    this.save();
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getAllUsers(): User[] {
    return this.users;
  }

  getLogs(): ActivityLog[] {
    return [...this.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  logActivity(userId: string, userName: string, action: string, details?: string) {
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      userName,
      action,
      timestamp: new Date().toISOString(),
      details
    };
    this.logs.push(log);
    this.save();
  }

  updateUserPlan(userId: string, plan: SubscriptionPlan, amount: string) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.plan = plan;
      // In a real app, we would handle logic to not double charge or handle pro-rating
      // Here we just update the accumulative paid amount for the logs/display
      const currentPaid = parseFloat(user.paidAmount.replace('$', ''));
      const newCharge = parseFloat(amount.replace('$', '').replace(/ \/ .*/, '')); // Handle "$1.00 / month" -> 1.00
      
      const toAdd = isNaN(newCharge) ? 0 : newCharge;
      user.paidAmount = `$${(currentPaid + toAdd).toFixed(2)}`;
      
      this.logActivity(userId, user.name, 'PLAN_SELECTED', `Switched to ${plan}`);
      if (toAdd > 0) {
          this.logActivity(userId, user.name, 'PAYMENT_SUCCEEDED', `Amount: $${toAdd.toFixed(2)}`);
      }
      this.currentUser = user; // Update session
      this.save();
    }
  }
}

export const authService = new AuthService();