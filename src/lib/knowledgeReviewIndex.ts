import { KnowledgeDocument, VocabularyChunk } from '../types';
import { ReviewSource, UnifiedReviewItem } from '../types/learningSession';

export interface ReviewIndexDiagnostics {
  reviewSource: ReviewSource;
  activeMaterialsCount: number;
  pdfCount: number;
  noteCount: number;
  structuredItemsCount: number;
  rawTextParsedItemsCount: number;
  totalDeduplicatedItemsCount: number;
  materialsUsed: string[];
  currentItemSourceTitle?: string;
  excludedMaterialsReasons?: Array<{ materialTitle: string; reason: string }>;
}

/**
 * Normalizes an expression key for deduplication comparison ONLY.
 * Retains exact multi-word expressions like "look", "look for", "look forward to".
 */
export function normalizeExpressionKey(expr: string): string {
  if (!expr) return '';
  return expr
    .toLowerCase()
    .trim()
    .replace(/['’`]/g, "'")
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Simple English detector heuristic for pair separation.
 */
function isLikelyEnglish(str: string): boolean {
  const lower = str.toLowerCase().trim();
  const englishWords = [
    'to', 'the', 'a', 'an', 'in', 'on', 'at', 'for', 'with', 'by', 'from',
    'look', 'run', 'feel', 'get', 'take', 'make', 'give', 'keep', 'put', 'come',
    'go', 'say', 'think', 'see', 'know', 'want', 'need', 'find', 'like', 'how',
    'what', 'why', 'when', 'where', 'who', 'which', 'will', 'would', 'could', 'should'
  ];
  const words = lower.split(/\s+/);
  return words.some((w) => englishWords.includes(w));
}

/**
 * Parses a single text line into English and Italian components if clearly present.
 * Keeps phrasal verbs, chunks, collocations intact.
 */
export function parseNoteLine(rawLine: string): { english: string; italian: string } | null {
  if (!rawLine || typeof rawLine !== 'string') return null;

  // Clean list bullets and numbers (e.g. "1. ", "• ", "- ")
  const clean = rawLine.trim().replace(/^\s*(?:\d+[\.\)]|[•\*\-\u2022])\s*/, '').trim();
  if (!clean || clean.length < 3) return null;

  // Check parenthesized translation: "feel like (avere voglia di)" or "avere voglia di (feel like)"
  const parenMatch = clean.match(/^([^(]+)\(([^)]+)\)$/);
  if (parenMatch) {
    const p1 = parenMatch[1].trim();
    const p2 = parenMatch[2].trim();
    if (p1 && p2) {
      if (isLikelyEnglish(p1)) return { english: p1, italian: p2 };
      if (isLikelyEnglish(p2)) return { english: p2, italian: p1 };
      return { english: p1, italian: p2 };
    }
  }

  // Common delimiters: =, ==, -, –, —, :, \t, / (surrounded by space)
  const delimiterRegex = /\s*(?:==?|--?|–|—|:|\t|\s\/\s)\s*/;
  const parts = clean.split(delimiterRegex);
  if (parts.length >= 2) {
    const left = parts[0].trim();
    const right = parts.slice(1).join(' ').trim();

    if (left && right && left.length > 1 && right.length > 1) {
      if (isLikelyEnglish(left)) return { english: left, italian: right };
      if (isLikelyEnglish(right)) return { english: right, italian: left };
      // Default: left = English, right = Italian
      return { english: left, italian: right };
    }
  }

  return null;
}

/**
 * Parses raw text content into structured items line-by-line.
 */
export function parseRawTextContent(rawText: string): Array<{ english: string; italian: string }> {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/);
  const items: Array<{ english: string; italian: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parseNoteLine(line);
    if (parsed) {
      items.push(parsed);
    } else {
      // Check if consecutive lines form an English / Italian pair
      if (i < lines.length - 1) {
        const line1 = lines[i].trim().replace(/^\s*(?:\d+[\.\)]|[•\*\-\u2022])\s*/, '').trim();
        const line2 = lines[i + 1].trim().replace(/^\s*(?:\d+[\.\)]|[•\*\-\u2022])\s*/, '').trim();
        if (
          line1 && line2 &&
          !line1.includes('=') && !line1.includes(':') &&
          !line2.includes('=') && !line2.includes(':') &&
          line1.length < 80 && line2.length < 80
        ) {
          if (isLikelyEnglish(line1) && !isLikelyEnglish(line2)) {
            items.push({ english: line1, italian: line2 });
            i++; // skip next line as it was consumed
          }
        }
      }
    }
  }

  return items;
}


function getMaterialDisplayName(doc: KnowledgeDocument): string {
  const candidate = doc.fileName || doc.title || `Materiale ${doc.id}`;
  return String(candidate).trim() || `Materiale ${doc.id}`;
}

/**
 * Helper to determine document source type.
 */
export function getMaterialSourceType(doc: KnowledgeDocument): 'pdf' | 'note' | 'migrated_note' {
  const displayName = getMaterialDisplayName(doc).toLowerCase();
  if (doc.type === 'pdf' || displayName.endsWith('.pdf')) {
    return 'pdf';
  }
  if (doc.id.includes('migrated') || displayName.includes('migrat')) {
    return 'migrated_note';
  }
  return 'note';
}

/**
 * Deduplicates review items across materials.
 * Preserves all source materials in item.sources.
 * Prefers the version with the most complete translation/example.
 */
export function deduplicateReviewItems(rawItems: UnifiedReviewItem[]): UnifiedReviewItem[] {
  const map = new Map<string, UnifiedReviewItem>();

  for (const item of rawItems) {
    if (!item.english || !item.english.trim()) continue;

    const key = normalizeExpressionKey(item.english);
    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...item,
        id: `rev-item-${key.replace(/\s+/g, '-')}`,
        sources: [
          {
            id: item.sourceMaterialId,
            title: item.sourceMaterialTitle,
            sourceType: item.sourceType,
          },
        ],
      });
    } else {
      // Combine sources list without duplicates
      const updatedSources = [...(existing.sources || [])];
      if (!updatedSources.some((s) => s.id === item.sourceMaterialId)) {
        updatedSources.push({
          id: item.sourceMaterialId,
          title: item.sourceMaterialTitle,
          sourceType: item.sourceType,
        });
      }
      existing.sources = updatedSources;

      // Prefer version with longer/better Italian translation or example
      const itemScore = (item.italian || '').length + (item.example || '').length;
      const existingScore = (existing.italian || '').length + (existing.example || '').length;

      if (itemScore > existingScore) {
        existing.english = item.english;
        existing.italian = item.italian;
        if (item.example) existing.example = item.example;
        if (item.type) existing.type = item.type;
        existing.sourceMaterialId = item.sourceMaterialId;
        existing.sourceMaterialTitle = item.sourceMaterialTitle;
        existing.sourceType = item.sourceType;
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Builds the unified material review index from all active Knowledge Documents.
 */
export function buildUnifiedMaterialReviewIndex(
  materials: KnowledgeDocument[],
  filterQuery?: string
): {
  items: UnifiedReviewItem[];
  diagnostics: ReviewIndexDiagnostics;
} {
  const activeMaterials = materials || [];
  let pdfCount = 0;
  let noteCount = 0;
  let structuredItemsCount = 0;
  let rawTextParsedItemsCount = 0;

  const excludedReasons: Array<{ materialTitle: string; reason: string }> = [];
  const selectedDocs: KnowledgeDocument[] = [];

  for (const doc of activeMaterials) {
    const sourceType = getMaterialSourceType(doc);
    if (sourceType === 'pdf') pdfCount++;
    else noteCount++;

    if (filterQuery && filterQuery.trim()) {
      const q = filterQuery.toLowerCase().trim();
      const displayName = getMaterialDisplayName(doc);
      const matchTitle = displayName.toLowerCase().includes(q);
      const matchType = sourceType.includes(q) || (q === 'pdf' && sourceType === 'pdf') || (q === 'nota' && sourceType !== 'pdf');

      if (!matchTitle && !matchType) {
        excludedReasons.push({
          materialTitle: displayName,
          reason: `Non corrisponde al filtro specifico ("${filterQuery}")`,
        });
        continue;
      }
    }

    selectedDocs.push(doc);
  }

  const rawReviewItems: UnifiedReviewItem[] = [];

  for (const doc of selectedDocs) {
    const sourceType = getMaterialSourceType(doc);

    // 1. Include extractedChunks if present
    if (doc.extractedChunks && doc.extractedChunks.length > 0) {
      for (const chunk of doc.extractedChunks) {
        if (!chunk.phrase) continue;
        structuredItemsCount++;
        rawReviewItems.push({
          id: chunk.id || `chunk-${doc.id}-${chunk.phrase}`,
          english: chunk.phrase.trim(),
          italian: (chunk.translation || '').trim(),
          example: chunk.context || chunk.phrase,
          type: 'expression',
          sourceMaterialId: doc.id,
          sourceMaterialTitle: getMaterialDisplayName(doc),
          sourceType,
        });
      }
    }

    // 2. Parse rawText or extractedText for items not yet covered in chunks
    const rawText = doc.rawText || doc.extractedText || '';
    if (rawText.trim()) {
      const parsedItems = parseRawTextContent(rawText);
      for (const p of parsedItems) {
        rawTextParsedItemsCount++;
        rawReviewItems.push({
          id: `raw-${doc.id}-${normalizeExpressionKey(p.english)}`,
          english: p.english,
          italian: p.italian,
          type: 'expression',
          sourceMaterialId: doc.id,
          sourceMaterialTitle: getMaterialDisplayName(doc),
          sourceType,
        });
      }
    }
  }

  // Deduplicate items
  const deduplicatedItems = deduplicateReviewItems(rawReviewItems);

  const materialsUsed = Array.from(new Set(deduplicatedItems.map((i) => i.sourceMaterialTitle)));

  const reviewSource: ReviewSource = filterQuery && filterQuery.trim() ? 'specific_material' : 'all_materials';

  const diagnostics: ReviewIndexDiagnostics = {
    reviewSource,
    activeMaterialsCount: activeMaterials.length,
    pdfCount,
    noteCount,
    structuredItemsCount,
    rawTextParsedItemsCount,
    totalDeduplicatedItemsCount: deduplicatedItems.length,
    materialsUsed,
    excludedMaterialsReasons: excludedReasons.length > 0 ? excludedReasons : undefined,
  };

  return { items: deduplicatedItems, diagnostics };
}

/**
 * Selects a balanced subset of review items across materials for a review session.
 */
export function selectReviewSessionItems(
  items: UnifiedReviewItem[],
  targetCount: number = 10,
  recentMistakes: string[] = []
): UnifiedReviewItem[] {
  if (!items || items.length === 0) return [];

  // Priority scoring for items
  const scored = items.map((item) => {
    let score = 0;

    // 1. Recently mistaken items
    const isMistake = recentMistakes.some(
      (m) => normalizeExpressionKey(m) === normalizeExpressionKey(item.english)
    );
    if (isMistake || (item.errorCount && item.errorCount > 0)) {
      score += 100;
    }

    // 2. Never reviewed items
    if (!item.lastReviewedAt) {
      score += 50;
    }

    // 3. Remembered only after hint
    if (item.recalledWithHint) {
      score += 30;
    }

    // Slight random variance for ties
    score += Math.random() * 5;

    return { item, score };
  });

  // Sort descending by priority score
  scored.sort((a, b) => b.score - a.score);

  // Group by source material to balance selection
  const byMaterial = new Map<string, UnifiedReviewItem[]>();
  for (const entry of scored) {
    const matId = entry.item.sourceMaterialId;
    if (!byMaterial.has(matId)) byMaterial.set(matId, []);
    byMaterial.get(matId)!.push(entry.item);
  }

  const selected: UnifiedReviewItem[] = [];
  const materialKeys = Array.from(byMaterial.keys());

  // Round-robin selection across materials
  let round = 0;
  while (selected.length < targetCount && selected.length < items.length) {
    let addedInRound = false;
    for (const matKey of materialKeys) {
      const list = byMaterial.get(matKey)!;
      if (round < list.length && selected.length < targetCount) {
        selected.push(list[round]);
        addedInRound = true;
      }
    }
    if (!addedInRound) break;
    round++;
  }

  return selected;
}

/**
 * Formats the Knowledge Base text block to pass to Gemini system instructions.
 */
export function formatUnifiedKnowledgeText(
  materials: KnowledgeDocument[],
  reviewSource: ReviewSource = 'all_materials',
  specificFilter?: string
): { knowledgeText: string; diagnostics: ReviewIndexDiagnostics } {
  const { items, diagnostics } = buildUnifiedMaterialReviewIndex(materials, specificFilter);

  const materialsListText = materials
    .map((doc) => {
      const docType = getMaterialSourceType(doc);
      const raw = doc.rawText || doc.extractedText || '';
      return `[MATERIALE: ${getMaterialDisplayName(doc)} | TIPO: ${docType.toUpperCase()} | ID: ${doc.id}]\n${raw}`;
    })
    .join('\n\n');

  const itemsListText = items
    .map((item, idx) => {
      const sourcesStr = item.sources?.map((s) => s.title).join(', ') || item.sourceMaterialTitle;
      return `${idx + 1}. "${item.english}" = "${item.italian}" (Fonte: ${sourcesStr}${item.example ? ` | Esempio: ${item.example}` : ''})`;
    })
    .join('\n');

  const knowledgeText = `--- LIBRERIA MATERIALI DELL'UTENTE (${materials.length} FONTI ATTIVE) ---
Modalità Fonte Ripasso: ${reviewSource}
Numero totale elementi unificati e deduplicati: ${items.length}

=== ELENCO UNIFICATO ESPRESSIONI E VOCABOLI PER IL RIPASSO ===
${itemsListText || 'Nessun elemento strutturato disponibile.'}

=== CONTENUTO INTEGRALE RAW DALLA SEZIONE MATERIALI ===
${materialsListText}`;

  return { knowledgeText, diagnostics };
}
