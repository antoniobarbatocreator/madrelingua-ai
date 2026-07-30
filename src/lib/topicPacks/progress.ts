import { TopicProgressRecord } from './types';

const PROGRESS_STORAGE_KEY = 'madrelingua_topic_progress_v1';

export function loadTopicProgressRecords(): TopicProgressRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error loading topic progress records:', e);
  }
  return [];
}

export function saveTopicProgressRecords(records: TopicProgressRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('Error saving topic progress records:', e);
  }
}

export function recordItemExposure(packId: string, moduleId: string, itemKey: string): void {
  if (!packId || !moduleId || !itemKey) return;
  const records = loadTopicProgressRecords();
  const normalizedKey = itemKey.toLowerCase().trim();

  const existingIndex = records.findIndex(
    (r) => r.packId === packId && r.moduleId === moduleId && r.itemKey.toLowerCase().trim() === normalizedKey
  );

  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    records[existingIndex] = {
      ...records[existingIndex],
      exposureCount: records[existingIndex].exposureCount + 1,
      lastExposedAt: now,
    };
  } else {
    records.push({
      packId,
      moduleId,
      itemKey: normalizedKey,
      exposureCount: 1,
      lastExposedAt: now,
      masteryStatus: 'learning',
    });
  }

  saveTopicProgressRecords(records);
}

export function getModuleHistorySummary(packId: string, moduleId: string): {
  recentlyUsedKeys: string[];
  totalExposures: number;
} {
  const records = loadTopicProgressRecords();
  const filtered = records.filter((r) => r.packId === packId && r.moduleId === moduleId && r.exposureCount > 0);

  return {
    recentlyUsedKeys: filtered.map((r) => r.itemKey),
    totalExposures: filtered.reduce((acc, curr) => acc + curr.exposureCount, 0),
  };
}
