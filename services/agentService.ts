import { AgentUpdate, DataSource } from '../types';

// Mock Data Sources
const INITIAL_SOURCES: DataSource[] = [
  { id: '1', name: 'LinkedIn', icon: 'linkedin', isConnected: true, lastSync: '2 hours ago' },
  { id: '2', name: 'GitHub', icon: 'github', isConnected: true, lastSync: '10 mins ago' },
  { id: '3', name: 'University Portal', icon: 'school', isConnected: false, lastSync: null },
];

// Mock "Found" Updates
const MOCK_UPDATES: AgentUpdate[] = [
  {
    id: 'u1',
    source: 'GitHub',
    type: 'Project',
    title: 'New Repository: "AI-Finance-Tracker"',
    description: 'Found a new public repository with Python and React code. Suggest adding to "Projects" section.',
    dateFound: new Date().toISOString(),
    status: 'pending'
  },
  {
    id: 'u2',
    source: 'LinkedIn',
    type: 'Certification',
    title: 'AWS Certified Solutions Architect',
    description: 'Detected a new license/certification added to your LinkedIn profile.',
    dateFound: new Date().toISOString(),
    status: 'pending'
  }
];

class AgentService {
  private sources: DataSource[] = INITIAL_SOURCES;

  getSources(): DataSource[] {
    return this.sources;
  }

  toggleSource(id: string): DataSource[] {
    this.sources = this.sources.map(s => 
      s.id === id ? { ...s, isConnected: !s.isConnected, lastSync: !s.isConnected ? 'Just now' : s.lastSync } : s
    );
    return this.sources;
  }

  // Simulate the "Check" process
  async checkForUpdates(): Promise<AgentUpdate[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // In a real app, this would call backend -> scraper
        resolve(MOCK_UPDATES); 
      }, 2500);
    });
  }
}

export const agentService = new AgentService();