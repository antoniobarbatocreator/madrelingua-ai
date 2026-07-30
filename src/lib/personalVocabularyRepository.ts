import { SavedPersonalVocabularyItem } from '../types';

export type PersonalVocabularyItem = SavedPersonalVocabularyItem;

const DB_NAME = 'MadrelinguaPersonalVocabDB';
const DB_VERSION = 1;
const STORE_NAME = 'personal_vocabulary';

class PersonalVocabularyRepository {
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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('expression', 'expression', { unique: false });
          store.createIndex('normalizedExpression', 'normalizedExpression', { unique: false });
          store.createIndex('source', 'source', { unique: false });
          store.createIndex('savedAt', 'savedAt', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Impossibile aprire IndexedDB per i vocaboli personali.'));
    });

    return this.dbPromise;
  }

  public async addItem(item: Omit<SavedPersonalVocabularyItem, 'id' | 'savedAt' | 'normalizedExpression'>): Promise<SavedPersonalVocabularyItem> {
    const norm = (item.expression || '').toLowerCase().trim().replace(/[’`]/g, "'");
    const fullItem: SavedPersonalVocabularyItem = {
      ...item,
      id: `pv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      normalizedExpression: norm,
      savedAt: new Date().toISOString(),
    };

    // Emergency backup in localStorage
    try {
      const current = this.getLocalStorageItems();
      current.push(fullItem);
      localStorage.setItem('madrelingua_personal_vocab_backup', JSON.stringify(current));
    } catch (e) {}

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.add(fullItem);

        req.onsuccess = () => resolve(fullItem);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Errore salvataggio IndexedDB vocabolo personale:', err);
      return fullItem;
    }
  }

  public async removeItem(id: string): Promise<void> {
    try {
      const current = this.getLocalStorageItems().filter((item) => item.id !== id);
      localStorage.setItem('madrelingua_personal_vocab_backup', JSON.stringify(current));
    } catch (e) {}

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Errore rimozione IndexedDB vocabolo personale:', err);
    }
  }

  public async deleteItem(id: string): Promise<void> {
    return this.removeItem(id);
  }

  public async getItemByNormalized(normalized: string): Promise<SavedPersonalVocabularyItem | null> {
    const items = await this.getAllItems();
    return items.find((i) => i.normalizedExpression === normalized) || null;
  }

  public async saveOrUpdateItem(item: Omit<SavedPersonalVocabularyItem, 'id' | 'savedAt' | 'normalizedExpression'>): Promise<SavedPersonalVocabularyItem> {
    return this.addItem(item);
  }

  public async updateItem(id: string, partial: Partial<SavedPersonalVocabularyItem>): Promise<SavedPersonalVocabularyItem | null> {
    const items = await this.getAllItems();
    const existing = items.find((i) => i.id === id);
    if (!existing) return null;
    const updated = { ...existing, ...partial };
    await this.removeItem(id);
    await this.addItem(updated);
    return updated;
  }

  public async exportVocabularyJson(): Promise<string> {
    const items = await this.getAllItems();
    return JSON.stringify(items, null, 2);
  }

  public async exportVocabularyCsv(): Promise<string> {
    const items = await this.getAllItems();
    const header = 'Expression,Meaning,Type,Example,SavedAt\n';
    const rows = items.map((i) => `"${i.expression}","${i.meaning}","${i.type || ''}","${i.example || ''}","${i.savedAt || ''}"`).join('\n');
    return header + rows;
  }

  public async importVocabulary(items: SavedPersonalVocabularyItem[]): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;
    for (const item of items) {
      if (item.expression) {
        await this.addItem(item);
        added++;
      }
    }
    return { added, updated };
  }

  public async getAllItems(): Promise<SavedPersonalVocabularyItem[]> {
    try {
      const db = await this.getDB();
      const itemsFromDB = await new Promise<SavedPersonalVocabularyItem[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (itemsFromDB && itemsFromDB.length > 0) return itemsFromDB;
    } catch (err) {
      console.warn('Errore lettura IndexedDB vocaboli personali:', err);
    }

    return this.getLocalStorageItems();
  }

  private getLocalStorageItems(): SavedPersonalVocabularyItem[] {
    try {
      const raw = localStorage.getItem('madrelingua_personal_vocab_backup');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }
}

export const personalVocabularyRepository = new PersonalVocabularyRepository();
