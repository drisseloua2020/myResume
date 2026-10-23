import { api } from './apiClient';

export type DemoProvider = 'jobs' | 'profile' | 'applications' | 'billing' | 'email';
export type DemoScenario = 'success' | 'failure' | 'timeout';
export type DemoOperation = {
  id: string; provider: DemoProvider; action: string; subjectId: string | null;
  status: 'succeeded' | 'failed'; result: Record<string, any>; createdAt: string; mode: 'mock';
};
export type DemoRequest = {
  provider: DemoProvider; action: string; scenario: DemoScenario; subjectId?: string;
  plan?: 'pro_monthly' | 'pro_yearly'; idempotencyKey: string;
};
export const getProviderCapabilities = () => api.get<{ demoEnabled: boolean; mode: string }>('/providers/capabilities');
export const getDemoState = () => api.get<{ profiles: Record<string, boolean>; billing: Record<string, any> }>('/providers/demo/state');
export const getDemoOperations = (offset = 0) => api.get<{ operations: DemoOperation[]; total: number }>(`/providers/demo/operations?limit=20&offset=${offset}`);
export const executeDemoOperation = (request: DemoRequest) => api.post<{ operation: DemoOperation; replayed: boolean }>('/providers/demo/execute', request);
