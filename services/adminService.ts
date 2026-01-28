import { api } from './apiClient';

export type AdminTemplate = { id: string; name: string; tag: string };
export type AdminActivityLog = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  status?: string;
  paid_amount?: number;
  auth_provider?: string;
  created_at?: string;
};
export type ProfileSourceCatalogItem = {
  id: string;
  name: string;
  icon: string;
  oauthProvider: string | null;
  isEnabled: boolean;
  createdAt: string;
};

export async function listTemplates(): Promise<AdminTemplate[]> {
  const res = await api.get<{ templates: AdminTemplate[] }>('/admin/templates');
  return res.templates;
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const res = await api.get<{ users: AdminUserRow[] }>('/admin/users');
  return res.users;
}

export async function listAdminActivityLogs(): Promise<AdminActivityLog[]> {
  const res = await api.get<{ logs: AdminActivityLog[] }>('/admin/activity-logs');
  return res.logs;
}

export async function listProfileSourcesCatalog(): Promise<ProfileSourceCatalogItem[]> {
  const res = await api.get<{ sources: ProfileSourceCatalogItem[] }>('/admin/profile-sources');
  return res.sources;
}

export async function addProfileSourceCatalog(payload: { name: string; icon?: string; oauthProvider?: string }): Promise<ProfileSourceCatalogItem[]> {
  const res = await api.post<{ sources: ProfileSourceCatalogItem[] }>('/admin/profile-sources', payload);
  return res.sources;
}

export async function toggleProfileSourceCatalog(id: string): Promise<ProfileSourceCatalogItem[]> {
  const res = await api.patch<{ sources: ProfileSourceCatalogItem[] }>(`/admin/profile-sources/${id}/toggle`, {});
  return res.sources;
}


export type ContactMessage = {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

export type AdminAgentUpdate = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  source: string;
  type: string;
  title: string;
  description: string;
  dateFound: string;
  status: string;
};

export type AdminResumeRow = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  templateId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export async function listContactMessages(): Promise<ContactMessage[]> {
  const res = await api.get<{ messages: ContactMessage[] }>('/admin/contact-messages');
  return res.messages;
}

export async function replyContactMessage(id: string, payload: { subject: string; message: string }): Promise<void> {
  await api.post(`/admin/contact-messages/${id}/reply`, payload);
}

export async function listAdminResumes(): Promise<AdminResumeRow[]> {
  const res = await api.get<{ resumes: AdminResumeRow[] }>('/admin/resumes');
  return res.resumes;
}

export async function listAdminAgentUpdates(): Promise<AdminAgentUpdate[]> {
  const res = await api.get<{ updates: AdminAgentUpdate[] }>('/admin/agent-updates');
  return res.updates;
}

