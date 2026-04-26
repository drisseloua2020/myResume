import { api } from './apiClient';

export type ProfileSyncUpdate = {
  id: string;
  source: string;
  category: string;
  title: string;
  details: string;
  payload?: any;
  createdAt: string;
};

export type ProfileSource = {
  id: string;
  name: string;
  icon: string;
  isConnected: boolean;
  lastSync: string | null;
};

export async function listProfileUpdates(): Promise<ProfileSyncUpdate[]> {
  const res = await api.get<{ updates: ProfileSyncUpdate[] }>('/profile/updates');
  return res.updates;
}

export async function syncProfile(): Promise<ProfileSyncUpdate[]> {
  const res = await api.post<{ updates: ProfileSyncUpdate[] }>('/profile/sync', {});
  return res.updates;
}

export async function listProfileSources(): Promise<ProfileSource[]> {
  const res = await api.get<{ sources: ProfileSource[] }>('/profile/sources');
  return res.sources;
}

export async function connectProfileSource(sourceKey: string): Promise<ProfileSource[]> {
  const res = await api.post<{ sources: ProfileSource[] }>(`/profile/sources/${encodeURIComponent(sourceKey)}/connect`, {});
  return res.sources;
}
