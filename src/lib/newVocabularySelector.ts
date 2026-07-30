import { TopicLessonItem, VocabularyItem, UnifiedReviewItem, LearningRuntimeState } from '../types/learningSession';
import { KnowledgeDocument } from '../types';
import { CEFRLevel, LearningItem, TopicModule, TopicProgressRecord } from './topicPacks/types';
import { getModule, getTopicPack } from './topicPacks/registry';
import { loadKnowledgeDocsFromStorage } from './knowledgeStorage';
import { buildUnifiedMaterialReviewIndex } from './knowledgeReviewIndex';
import { personalVocabularyRepository } from './personalVocabularyRepository';
import { learningSessionRepository } from './learningSessionRepository';
import { loadTopicProgressRecords, getModuleHistorySummary } from './topicPacks/progress';

export function normalizeExpressionKey(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFKC')
    .trim()
    .replace(/[’`]/g, "'")
    .replace(/[.,/#!$%^&*;:{}=\-_~()?"«»!@]/g, ' ')
    .replace(/(^'+|'+$)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates whether a candidate learning item is genuinely new and not present in the exclusion set.
 */
export function isValidNewTargetItem(
  item: { expression?: string; english?: string } | null | undefined,
  excludedExpressionKeys: Set<string>
): boolean {
  if (!item) return false;
  const expr = item.expression || item.english || '';
  const key = normalizeExpressionKey(expr);
  return key.length > 0 && !excludedExpressionKeys.has(key);
}

/**
 * Builds the dynamic exclusion set of all target expressions contained in the learner's Materials,
 * personal vocabulary, notes, uploaded PDFs, and active session vocabulary.
 */
export async function buildCurrentMaterialExclusionSet(
  knowledgeDocs?: KnowledgeDocument[]
): Promise<Set<string>> {
  const set = new Set<string>();

  const add = (text?: string) => {
    if (!text) return;
    const key = normalizeExpressionKey(text);
    if (key) set.add(key);
  };

  const docs = knowledgeDocs !== undefined
    ? knowledgeDocs
    : loadKnowledgeDocsFromStorage();

  // 1. Unified Material Review Index from all active Knowledge Documents
  try {
    const { items: reviewItems } = buildUnifiedMaterialReviewIndex(docs);
    for (const item of reviewItems) {
      add(item.english);
    }
  } catch (err) {
    console.error('Failed to parse knowledge docs for exclusion set:', err);
  }

  // 2. Personal Vocabulary items saved in IndexedDB
  if (typeof indexedDB !== 'undefined') {
    try {
      const personalItems = await personalVocabularyRepository.getAllItems();
      for (const pItem of personalItems) {
        add(pItem.expression);
        if (pItem.normalizedExpression) add(pItem.normalizedExpression);
      }
    } catch (err) {
      console.warn('Personal vocabulary exclusions are temporarily unavailable.', err);
    }
  }

  // 3. Saved session vocabulary
  if (typeof indexedDB !== 'undefined') {
    try {
      const sessionState = await learningSessionRepository.getLatestLearningState();
      if (sessionState?.sessionVocabulary) {
        for (const v of sessionState.sessionVocabulary) add(v.english);
      }
    } catch (err) {}
  }

  return set;
}

export function getPreviouslyExposedTopicItemKeys(progressRecords: TopicProgressRecord[]): Set<string> {
  const set = new Set<string>();
  for (const rec of progressRecords) {
    if (rec.exposureCount > 0 && rec.itemKey) {
      const key = normalizeExpressionKey(rec.itemKey);
      if (key) set.add(key);
    }
  }
  return set;
}

export function getCurrentSessionTargetKeys(
  runtimeState?: LearningRuntimeState | null,
  targetPackId?: string,
  targetModuleId?: string
): Set<string> {
  const set = new Set<string>();
  if (!runtimeState) return set;

  if (targetPackId && runtimeState.activeTopicPackId && runtimeState.activeTopicPackId !== targetPackId) {
    return set;
  }
  if (targetModuleId && runtimeState.activeModuleId && runtimeState.activeModuleId !== targetModuleId) {
    return set;
  }

  const add = (text?: string) => {
    if (!text) return;
    const key = normalizeExpressionKey(text);
    if (key) set.add(key);
  };

  const selected = runtimeState.selectedLearningItems || [];
  const completedIds = new Set(runtimeState.completedItemIds || []);
  const exposedIds = new Set(runtimeState.exposedItemIds || []);
  const currentIndex = runtimeState.currentLearningItemIndex ?? -1;

  if (runtimeState.currentItem) {
    add(runtimeState.currentItem.expression || runtimeState.currentItem.english);
    if (runtimeState.currentItem.id) exposedIds.add(runtimeState.currentItem.id);
  }

  selected.forEach((item, index) => {
    const wasExposed = index <= currentIndex || exposedIds.has(item.id) || completedIds.has(item.id);
    if (wasExposed) add(item.expression || item.english);
  });

  if (runtimeState.sessionVocabulary) {
    for (const item of runtimeState.sessionVocabulary) add(item.english);
  }

  return set;
}

export function getRecentlyUsedTopicItemKeys(packId?: string, moduleId?: string): Set<string> {
  const set = new Set<string>();
  if (!packId || !moduleId) return set;
  try {
    const summary = getModuleHistorySummary(packId, moduleId);
    for (const k of summary.recentlyUsedKeys) {
      const normKey = normalizeExpressionKey(k);
      if (normKey) set.add(normKey);
    }
  } catch (err) {}
  return set;
}

export async function buildCompleteExclusionSet(params: {
  knowledgeDocs?: KnowledgeDocument[];
  learningRuntimeState?: LearningRuntimeState | null;
  packId?: string;
  moduleId?: string;
  topicProgressRecords?: TopicProgressRecord[];
}): Promise<{
  materialExclusionKeys: Set<string>;
  excludedExpressionKeys: Set<string>;
  diagnostics: {
    materialExclusionCount: number;
    previouslyExposedCount: number;
    sessionTargetCount: number;
    recentlyUsedCount: number;
    totalExclusionCount: number;
  };
}> {
  const materialExclusionKeys = await buildCurrentMaterialExclusionSet(params.knowledgeDocs);
  const progressRecords = params.topicProgressRecords ?? (typeof localStorage !== 'undefined' ? loadTopicProgressRecords() : []);
  const previouslyExposedTopicKeys = getPreviouslyExposedTopicItemKeys(progressRecords);
  const sessionTargetKeys = getCurrentSessionTargetKeys(params.learningRuntimeState, params.packId, params.moduleId);
  const recentlyUsedKeys = typeof localStorage !== 'undefined'
    ? getRecentlyUsedTopicItemKeys(params.packId, params.moduleId)
    : new Set<string>();

  const excludedExpressionKeys = new Set<string>([
    ...materialExclusionKeys,
    ...previouslyExposedTopicKeys,
    ...sessionTargetKeys,
    ...recentlyUsedKeys,
  ]);

  return {
    materialExclusionKeys,
    excludedExpressionKeys,
    diagnostics: {
      materialExclusionCount: materialExclusionKeys.size,
      previouslyExposedCount: previouslyExposedTopicKeys.size,
      sessionTargetCount: sessionTargetKeys.size,
      recentlyUsedCount: recentlyUsedKeys.size,
      totalExclusionCount: excludedExpressionKeys.size,
    },
  };
}

export function getMaxTargetCountForLevel(cefrLevel?: string): number {
  if (!cefrLevel) return 3;
  const level = cefrLevel.toUpperCase();
  if (level.includes('A1') || level.includes('A2')) return 3;
  if (level.includes('B1') || level.includes('B2')) return 4;
  if (level.includes('C1') || level.includes('C2')) return 5;
  return 3;
}

export interface BuildExclusionSetParams {
  personalVocabItems?: VocabularyItem[];
  materialReviewItems?: UnifiedReviewItem[];
  dbVocabItems?: VocabularyItem[];
  topicProgressRecords?: TopicProgressRecord[];
  sessionVocabulary?: Array<{ english: string }>;
  recentlyUsedKeys?: string[];
}

export function buildExclusionSet(params: BuildExclusionSetParams): Set<string> {
  const set = new Set<string>();

  const add = (text?: string) => {
    if (!text) return;
    const key = normalizeExpressionKey(text);
    if (key) set.add(key);
  };

  if (params.personalVocabItems) {
    for (const item of params.personalVocabItems) add(item.english);
  }
  if (params.materialReviewItems) {
    for (const item of params.materialReviewItems) add(item.english);
  }
  if (params.dbVocabItems) {
    for (const item of params.dbVocabItems) add(item.english);
  }
  if (params.topicProgressRecords) {
    for (const rec of params.topicProgressRecords) {
      if (rec.exposureCount > 0) add(rec.itemKey);
    }
  }
  if (params.sessionVocabulary) {
    for (const item of params.sessionVocabulary) add(item.english);
  }
  if (params.recentlyUsedKeys) {
    for (const key of params.recentlyUsedKeys) add(key);
  }

  return set;
}

function expandContrastSeed(seed: any): any[] {
  const expression = String(seed?.expression || '').trim();
  const match = expression.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (!match) return [seed];

  const expressions = [match[1].trim(), match[2].trim()];
  const meaningParts = String(seed?.meaning || '').split(/\s+vs\.?\s+/i).map((value) => value.trim());
  return expressions.map((value, index) => ({
    ...seed,
    id: `${seed.id || 'contrast'}_${index + 1}`,
    expression: value,
    meaning: meaningParts[index] || seed.meaning,
    usage: `${seed.usage || ''} This lesson teaches “${value}” as one independent target.`,
  }));
}


const CEFR_RANK: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

function getCefrSelectionBand(rawLevel?: string): { preferredMin: number; max: number } {
  const level = String(rawLevel || '').toUpperCase();
  if (level.includes('A1') && level.includes('A2')) return { preferredMin: 1, max: 2 };
  if (level.includes('B1') && level.includes('B2')) return { preferredMin: 3, max: 4 };
  if (level.includes('C1') && level.includes('C2')) return { preferredMin: 5, max: 6 };
  const exact = CEFR_RANK[level];
  if (exact) return { preferredMin: exact, max: exact };
  return { preferredMin: 1, max: 4 };
}

function getDifficultyRank(difficulty?: string): number {
  return CEFR_RANK[String(difficulty || '').toUpperCase()] || 0;
}

export interface SelectNewVocabularyParams {
  packId: string;
  moduleId: string;
  competencyAreaId?: string;
  cefrLevel?: string;
  targetCount?: number;
  excludedExpressionsSet: Set<string>;
  topicProgressRecords?: TopicProgressRecord[];
  recentlyUsedItemKeys?: Set<string>;
}

export function selectNewVocabularyItems(params: SelectNewVocabularyParams): TopicLessonItem[] {
  const {
    packId,
    moduleId,
    competencyAreaId,
    cefrLevel,
    excludedExpressionsSet,
    topicProgressRecords = [],
    recentlyUsedItemKeys = new Set<string>(),
  } = params;

  const maxCount = params.targetCount || getMaxTargetCountForLevel(cefrLevel);
  const cefrBand = getCefrSelectionBand(cefrLevel);
  const mod = getModule(packId, moduleId);
  if (!mod || !mod.seedItems) return [];

  const typePriority: Record<string, number> = {
    word: 0,
    phrasal_verb: 1,
    collocation: 2,
    chunk: 3,
    idiom: 4,
    grammar_pattern: 5,
  };

  const eligible: Array<TopicLessonItem & { __sourceOrder: number; __levelPenalty: number }> = [];
  let sourceOrder = 0;

  for (const rawSeed of mod.seedItems) {
    for (const seed of expandContrastSeed(rawSeed)) {
      const key = normalizeExpressionKey(seed.expression);
      if (!key) continue;

      const difficultyRank = getDifficultyRank(seed.difficulty);
      // Never teach an item above the learner's configured CEFR ceiling.
      if (difficultyRank > 0 && difficultyRank > cefrBand.max) continue;

      // Materials, personal vocabulary and exposure history are absolute exclusions.
      if (excludedExpressionsSet.has(key)) continue;
      if (recentlyUsedItemKeys.has(key)) continue;

      const prog = topicProgressRecords.find(
        (record) => record.packId === packId && record.moduleId === moduleId && record.itemKey === key
      );
      if (prog && prog.exposureCount > 0) continue;

      eligible.push({
        id: seed.id || `item_${packId}_${moduleId}_${key}`,
        expression: seed.expression,
        meaning: seed.meaning,
        usage: seed.usage,
        example: seed.example,
        type: seed.type,
        difficulty: seed.difficulty,
        source: 'topic_seed',
        topicPackId: packId,
        moduleId,
        competencyAreaId: competencyAreaId || (mod.competencyAreas[0]?.id || 'default_area'),
        __sourceOrder: sourceOrder++,
        __levelPenalty: difficultyRank > 0 && difficultyRank < cefrBand.preferredMin ? 1 : 0,
      });
    }
  }

  // Prefer teachable lexical targets over full grammatical patterns while preserving
  // the curriculum order inside each target category.
  eligible.sort((a, b) => {
    const aPriority = typePriority[a.type || 'chunk'] ?? 9;
    const bPriority = typePriority[b.type || 'chunk'] ?? 9;
    return a.__levelPenalty - b.__levelPenalty || aPriority - bPriority || a.__sourceOrder - b.__sourceOrder;
  });

  return eligible.slice(0, maxCount).map(({ __sourceOrder: _ignored, __levelPenalty: _levelPenalty, ...item }) => item);
}

export async function generateCustomTopicItems(params: {
  topic: string;
  cefrLevel?: string;
  targetCount?: number;
  excludedExpressionsSet: Set<string>;
}): Promise<TopicLessonItem[]> {
  const { topic, cefrLevel = 'B1_B2', excludedExpressionsSet } = params;
  const maxCount = params.targetCount || getMaxTargetCountForLevel(cefrLevel);
  const cleanTopic = topic.trim();

  try {
    const res = await fetch('/api/vocabulary/generate-custom-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: cleanTopic,
        cefrLevel,
        targetCount: maxCount,
        excludedExpressions: Array.from(excludedExpressionsSet),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        const validated: TopicLessonItem[] = [];
        const seen = new Set<string>();
        const allowedTypes = new Set(['word', 'phrasal_verb', 'collocation', 'chunk', 'idiom', 'expression']);
        for (const raw of data.items) {
          const expression = String(raw?.expression || '').trim();
          const key = normalizeExpressionKey(expression);
          const normalizedType = String(raw?.type || 'expression').toLowerCase();
          const wordCount = expression.split(/\s+/).filter(Boolean).length;
          const looksLikeUncontrolledSentence = /[.!?]$/.test(expression) || wordCount > 9;
          if (
            isValidNewTargetItem(raw, excludedExpressionsSet) &&
            key &&
            !seen.has(key) &&
            allowedTypes.has(normalizedType) &&
            !looksLikeUncontrolledSentence
          ) {
            seen.add(key);
            validated.push({
              id: `custom_${cleanTopic}_${validated.length + 1}`,
              expression,
              meaning: raw.meaning,
              usage: raw.usage || '',
              example: raw.example || '',
              type: normalizedType,
              source: 'controlled_custom_topic',
              topicPackId: 'custom_topic',
              moduleId: cleanTopic,
              competencyAreaId: 'custom_area',
            });
          }
        }
        if (validated.length > 0) return validated.slice(0, maxCount);
      }
    }
  } catch (err) {
    console.warn('Custom topic API generation fallback:', err);
  }

  return [];
}
