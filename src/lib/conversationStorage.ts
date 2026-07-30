import { ChatMessage } from '../types';

export interface SavedMessage extends ChatMessage {
  role?: string;
  createdAt?: string;
  detectedLanguage?: 'it' | 'en' | string;
}

export interface SavedConversation {
  id: string;
  title: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  durationSeconds?: number;
  messages: SavedMessage[];
  topicsCovered?: string[];
  summary?: string;
}

const STORAGE_KEY = 'learning_app_conversations_v1';

class ConversationRepository {
  private load(): SavedConversation[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Error loading conversations:', e);
    }
    return [];
  }

  private saveAll(conversations: SavedConversation[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.error('Error saving conversations:', e);
    }
  }

  async getAllConversations(): Promise<SavedConversation[]> {
    return this.load();
  }

  async getConversationById(id: string): Promise<SavedConversation | null> {
    const list = this.load();
    return list.find((c) => c.id === id) || null;
  }

  async saveConversation(conv: Partial<SavedConversation> & { messages: SavedMessage[] }): Promise<SavedConversation> {
    return this.saveOrUpdateConversation(conv);
  }

  async saveOrUpdateConversation(conv: Partial<SavedConversation> & { messages: SavedMessage[] }): Promise<SavedConversation> {
    const list = this.load();
    const title = conv.title || generateAutoTitle(conv.messages);
    const id = conv.id || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const saved: SavedConversation = {
      id,
      title,
      date: conv.date || new Date().toISOString(),
      createdAt: conv.createdAt || new Date().toISOString(),
      updatedAt: conv.updatedAt || new Date().toISOString(),
      startedAt: conv.startedAt || new Date().toISOString(),
      messages: conv.messages,
      topicsCovered: conv.topicsCovered || [],
      summary: conv.summary || '',
    };

    const existingIdx = list.findIndex((c) => c.id === id);
    if (existingIdx >= 0) {
      list[existingIdx] = saved;
    } else {
      list.unshift(saved);
    }

    this.saveAll(list);
    return saved;
  }

  async deleteConversation(id: string): Promise<void> {
    const list = this.load().filter((c) => c.id !== id);
    this.saveAll(list);
  }
}

export const conversationRepository = new ConversationRepository();

export function detectTextLanguage(text: string): 'it' | 'en' {
  const norm = text.toLowerCase();
  const italianMarkers = ['che', 'questo', 'come', 'sono', 'perché', 'grazie', 'ciao', 'cosa', 'molto'];
  const matches = italianMarkers.filter((m) => norm.includes(m));
  return matches.length > 0 ? 'it' : 'en';
}

export function generateAutoTitle(messages: SavedMessage[]): string {
  const firstUserMsg = messages.find((m) => m.sender === 'user' || m.role === 'user');
  if (firstUserMsg && firstUserMsg.text.trim()) {
    const text = firstUserMsg.text.trim();
    return text.length > 35 ? text.slice(0, 35) + '...' : text;
  }
  return `Conversazione del ${new Date().toLocaleDateString('it-IT')}`;
}
