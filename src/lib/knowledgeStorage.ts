import { KnowledgeDocument } from '../types';
import { INITIAL_KNOWLEDGE_DOCUMENTS } from '../data/defaultKnowledge';

const KNOWLEDGE_DOCS_STORAGE_KEY = 'learning_app_knowledge_docs_v1';

export function loadKnowledgeDocsFromStorage(): KnowledgeDocument[] {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_DOCS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load knowledge docs from storage:', e);
  }
  return INITIAL_KNOWLEDGE_DOCUMENTS;
}

export function saveKnowledgeDocsToStorage(docs: KnowledgeDocument[]): boolean {
  try {
    localStorage.setItem(KNOWLEDGE_DOCS_STORAGE_KEY, JSON.stringify(docs));
    return true;
  } catch (e) {
    console.error('Failed to save knowledge docs to storage:', e);
    return false;
  }
}
