/**
 * api/llm.ts — LLM Chat API
 */
import { authFetch } from '@/lib/http'

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export const llmApi = {
  chat: (messages: LLMMessage[], model?: string) =>
    authFetch<{ content: string; model: string }>('/llm/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, model }),
    }),
}
