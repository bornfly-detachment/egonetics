const API_BASE = '/api';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// 类型定义
export interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  summary: string;
  source_file: string;
  rounds?: Round[];
}

export interface Round {
  id: number;
  round_number: number;
  user_content: string;
  user_timestamp: string;
  agent_messages: AgentMessage[];
}

export interface AgentMessage {
  id: string;
  role: 'assistant' | 'toolResult';
  timestamp: string;
  message: {
    content: Array<{
      type: string;
      thinking?: string;
      name?: string;
      arguments?: any;
      text?: string;
    }>;
    usage?: {
      input?: number;
      output?: number;
      total?: number;
    };
    provider?: string;
    model?: string;
  };
}

// API函数
export const sessionsApi = {
  getSessions: (limit: number = 50, offset: number = 0) =>
    fetchApi<{ sessions: Session[]; total: number }>(`/sessions?limit=${limit}&offset=${offset}`),
  
  getSession: (id: string) =>
    fetchApi<Session & { rounds: Round[] }>(`/sessions/${id}`),
};

export const annotationsApi = {
  saveAnnotation: (roundId: number, data: { thought_index: number; suggested_revision: string }) =>
    fetchApi<{ success: boolean; id: number }>(`/rounds/${roundId}/annotation`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const tagsApi = {
  createTag: (name: string) =>
    fetchApi<{ success: boolean; name: string }>('/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  
  addToRound: (roundId: number, tagNames: string[]) =>
    fetchApi<{ success: boolean }>(`/rounds/${roundId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_names: tagNames }),
    }),
};

export const statsApi = {
  getStats: () => fetchApi<any>('/stats'),
};
