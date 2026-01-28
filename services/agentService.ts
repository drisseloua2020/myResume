import { api } from "./apiClient";
import { AgentUpdate, DataSource } from "../types";

class AgentService {
  async getSources(): Promise<DataSource[]> {
    const res = await api.get<{ sources: DataSource[] }>("/agent/sources");
    return res.sources;
  }

  async toggleSource(id: string): Promise<DataSource[]> {
    await api.post(`/agent/sources/${id}/toggle`);
    // return fresh list
    const res = await api.get<{ sources: DataSource[] }>("/agent/sources");
    return res.sources;
  }

  async checkForUpdates(): Promise<AgentUpdate[]> {
    const res = await api.post<{ updates: AgentUpdate[] }>("/agent/check");
    return res.updates;
  }

  // Optional
  async getUpdates(): Promise<AgentUpdate[]> {
    const res = await api.get<{ updates: AgentUpdate[] }>("/agent/updates");
    return res.updates;
  }
}

export const agentService = new AgentService();