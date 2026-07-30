import { LearningRuntimeState, VocabularyItem } from '../types/learningSession';

const DB_NAME = 'MadrelinguaLearningDB';
const DB_VERSION = 1;
const STATE_STORE = 'learning_runtime_states';
const VOCAB_STORE = 'vocabulary_items';

class LearningSessionRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB non disponibile in questo ambiente.'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STATE_STORE)) {
          const stateStore = db.createObjectStore(STATE_STORE, { keyPath: 'appSessionId' });
          stateStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(VOCAB_STORE)) {
          const vocabStore = db.createObjectStore(VOCAB_STORE, { keyPath: 'id' });
          vocabStore.createIndex('sourceDocumentId', 'sourceDocumentId', { unique: false });
          vocabStore.createIndex('lastReviewedAt', 'lastReviewedAt', { unique: false });
          vocabStore.createIndex('currentMastery', 'currentMastery', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Impossibile aprire IndexedDB.'));
    });

    return this.dbPromise;
  }

  // --- Runtime State Operations ---

  public async saveLearningState(state: LearningRuntimeState): Promise<void> {
    if (!state || !state.appSessionId) return;

    state.updatedAt = new Date().toISOString();

    // Secondary backup in localStorage for fast synchronous emergency restore
    try {
      localStorage.setItem(`learning_state_${state.appSessionId}`, JSON.stringify(state));
      localStorage.setItem('latest_active_app_session_id', state.appSessionId);
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STATE_STORE, 'readwrite');
        const store = tx.objectStore(STATE_STORE);
        const req = store.put(state);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Errore salvataggio IndexedDB stato di apprendimento:', err);
    }
  }

  public async loadLearningState(appSessionId: string): Promise<LearningRuntimeState | null> {
    if (!appSessionId) return null;

    // First try IndexedDB
    try {
      const db = await this.getDB();
      const stateFromDB = await new Promise<LearningRuntimeState | null>((resolve, reject) => {
        const tx = db.transaction(STATE_STORE, 'readonly');
        const store = tx.objectStore(STATE_STORE);
        const req = store.get(appSessionId);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });

      if (stateFromDB) return stateFromDB;
    } catch (err) {
      console.warn(`Errore lettura IndexedDB per appSessionId ${appSessionId}:`, err);
    }

    // Fallback to LocalStorage
    try {
      const raw = localStorage.getItem(`learning_state_${appSessionId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('LocalStorage load error:', e);
    }

    return null;
  }

  public async getLatestLearningState(): Promise<LearningRuntimeState | null> {
    try {
      const latestAppSessionId = localStorage.getItem('latest_active_app_session_id');
      if (latestAppSessionId) {
        return await this.loadLearningState(latestAppSessionId);
      }
    } catch (e) {}
    return null;
  }

  public async deleteLearningState(appSessionId: string): Promise<void> {
    if (!appSessionId) return;

    try {
      localStorage.removeItem(`learning_state_${appSessionId}`);
    } catch (e) {}

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STATE_STORE, 'readwrite');
        const store = tx.objectStore(STATE_STORE);
        const req = store.delete(appSessionId);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Errore cancellazione stato IndexedDB:', err);
    }
  }

  // --- Vocabulary Items Index Operations ---

  public async saveVocabularyIndex(items: VocabularyItem[]): Promise<void> {
    if (!items || items.length === 0) return;

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VOCAB_STORE, 'readwrite');
        const store = tx.objectStore(VOCAB_STORE);

        for (const item of items) {
          store.put(item);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Errore salvataggio indice vocaboli IndexedDB:', err);
    }
  }

  public async loadVocabularyForDocument(documentId: string): Promise<VocabularyItem[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VOCAB_STORE, 'readonly');
        const store = tx.objectStore(VOCAB_STORE);
        const index = store.index('sourceDocumentId');
        const req = index.getAll(documentId);

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`Errore lettura vocaboli per documento ${documentId}:`, err);
      return [];
    }
  }

  public async loadAllVocabularyItems(): Promise<VocabularyItem[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VOCAB_STORE, 'readonly');
        const store = tx.objectStore(VOCAB_STORE);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Errore lettura tutti i vocaboli da IndexedDB:', err);
      return [];
    }
  }

  public async updateVocabularyItemStats(
    itemId: string,
    outcome: 'correct_first_try' | 'correct_after_hint' | 'incorrect'
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(VOCAB_STORE, 'readwrite');
      const store = tx.objectStore(VOCAB_STORE);

      const item: VocabularyItem | undefined = await new Promise((resolve, reject) => {
        const req = store.get(itemId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (!item) return;

      item.lastReviewedAt = new Date().toISOString();

      if (outcome === 'correct_first_try') {
        item.correctFirstTryCount = (item.correctFirstTryCount || 0) + 1;
      } else if (outcome === 'correct_after_hint') {
        item.correctAfterHintCount = (item.correctAfterHintCount || 0) + 1;
      } else if (outcome === 'incorrect') {
        item.incorrectCount = (item.incorrectCount || 0) + 1;
      }

      // Mastery calculation logic
      const totalCorrect = (item.correctFirstTryCount || 0) + (item.correctAfterHintCount || 0);
      const totalIncorrect = item.incorrectCount || 0;

      if (totalCorrect >= 5 && totalIncorrect === 0) {
        item.currentMastery = 'mastered';
      } else if (totalCorrect >= 3) {
        item.currentMastery = 'familiar';
      } else if (totalCorrect >= 1 || totalIncorrect >= 1) {
        item.currentMastery = 'learning';
      } else {
        item.currentMastery = 'new';
      }

      await new Promise<void>((resolve, reject) => {
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`Errore aggiornamento statistiche vocabolo ${itemId}:`, err);
    }
  }
}

export const learningSessionRepository = new LearningSessionRepository();
