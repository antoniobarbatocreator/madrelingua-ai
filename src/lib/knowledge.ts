/**
 * Personal knowledge base: the learner's own vocabulary, phrasal verbs and
 * expressions, gathered from uploaded documents or pasted notes.
 *
 * The important design decision lives here. An earlier version handed a slab of
 * vocabulary to the model and let it pick what to drill; the model has no memory
 * across sessions and favours the head of a list, so it asked about the same
 * handful of words forever while the rest of the list was never touched.
 *
 * So selection is the app's job, not the model's. Every item carries its own
 * review history, this module picks the batch, and the coach only ever sees the
 * batch it was given. Rotation is then a property of the system rather than
 * something we hope the model does.
 */

export type SourceKind = "pdf" | "text";

export interface KnowledgeSource {
  id: string;
  name: string;
  kind: SourceKind;
  createdAt: number;
  itemCount: number;
  /** Kept for themed conversation; capped so storage stays small. */
  excerpt: string;
}

export interface KnowledgeItem {
  id: string;
  sourceId: string;
  phrase: string;
  translation: string;
  context: string;
  category: string;
  /** Leitner box: 0 = new or failed, 5 = well known. Drives the next due date. */
  box: number;
  seenCount: number;
  correctCount: number;
  lastSeenAt: number | null;
}

const SOURCES_KEY = "madrelingua_knowledge_sources";
const ITEMS_KEY = "madrelingua_knowledge_items";

/**
 * Days before an item in each box is worth asking about again. Box 0 is a few
 * hours rather than zero on purpose: a word you just got wrong should come back
 * soon, but not in the very next batch, or a session turns into the same short
 * list of stumbling blocks going round and round.
 */
const BOX_INTERVAL_DAYS = [0.25, 1, 3, 7, 16, 35];

/** Share of a batch reserved for words never asked about before. */
const NEW_SHARE = 0.6;
const DAY_MS = 86_400_000;
const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;

export const EXCERPT_LIMIT = 8000;

// ── Persistence ───────────────────────────────────────────────

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadSources(): KnowledgeSource[] {
  return read<KnowledgeSource>(SOURCES_KEY).sort((a, b) => b.createdAt - a.createdAt);
}

export function loadItems(): KnowledgeItem[] {
  return read<KnowledgeItem>(ITEMS_KEY);
}

export interface ExtractedItem {
  phrase: string;
  translation: string;
  context?: string;
  category?: string;
}

/**
 * Store a new source and its items, skipping phrases already in the library so
 * re-uploading an updated document does not create duplicates or reset history.
 */
export function addSource(
  name: string,
  kind: SourceKind,
  excerpt: string,
  extracted: ExtractedItem[]
): { source: KnowledgeSource; added: number; skipped: number } {
  const existing = loadItems();
  const known = new Set(existing.map((i) => normalize(i.phrase)));

  const sourceId = `src_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fresh: KnowledgeItem[] = [];
  let skipped = 0;

  for (const raw of extracted) {
    const phrase = (raw.phrase || "").trim();
    if (!phrase) continue;
    const key = normalize(phrase);
    if (known.has(key)) {
      skipped++;
      continue;
    }
    known.add(key);
    fresh.push({
      id: `it_${Date.now()}_${fresh.length}_${Math.random().toString(36).slice(2, 6)}`,
      sourceId,
      phrase,
      translation: (raw.translation || "").trim(),
      context: (raw.context || "").trim(),
      category: (raw.category || "Generale").trim(),
      box: 0,
      seenCount: 0,
      correctCount: 0,
      lastSeenAt: null,
    });
  }

  const source: KnowledgeSource = {
    id: sourceId,
    name: name.trim() || "Senza titolo",
    kind,
    createdAt: Date.now(),
    itemCount: fresh.length,
    excerpt: excerpt.slice(0, EXCERPT_LIMIT),
  };

  write(ITEMS_KEY, [...existing, ...fresh]);
  write(SOURCES_KEY, [...read<KnowledgeSource>(SOURCES_KEY), source]);

  return { source, added: fresh.length, skipped };
}

export function deleteSource(sourceId: string) {
  write(SOURCES_KEY, read<KnowledgeSource>(SOURCES_KEY).filter((s) => s.id !== sourceId));
  write(ITEMS_KEY, loadItems().filter((i) => i.sourceId !== sourceId));
}

export function deleteItem(itemId: string) {
  const items = loadItems().filter((i) => i.id !== itemId);
  write(ITEMS_KEY, items);
  const sources = read<KnowledgeSource>(SOURCES_KEY).map((s) => ({
    ...s,
    itemCount: items.filter((i) => i.sourceId === s.id).length,
  }));
  write(SOURCES_KEY, sources);
}

function normalize(phrase: string): string {
  return phrase.toLowerCase().replace(/[^a-z0-9\s']/g, "").replace(/\s+/g, " ").trim();
}

// ── Review scheduling ─────────────────────────────────────────

function dueAt(item: KnowledgeItem): number {
  if (item.lastSeenAt === null) return 0; // never asked: maximally overdue
  return item.lastSeenAt + BOX_INTERVAL_DAYS[Math.min(item.box, MAX_BOX)] * DAY_MS;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pick the next batch to drill.
 *
 * Most of each batch is new ground and a minority is reinforcement. That split
 * is deliberate: letting due items take the whole batch means a backlog of
 * shaky words crowds out everything else and every session feels like the same
 * short list, which is exactly the failure this module exists to avoid. With a
 * long personal list, breadth matters as much as repetition.
 *
 * Each tier is shuffled and so is the final batch, so no two sessions present
 * the same words in the same order.
 */
export function selectForReview(count = 12, sourceId?: string): KnowledgeItem[] {
  const pool = sourceId ? loadItems().filter((i) => i.sourceId === sourceId) : loadItems();
  if (pool.length === 0) return [];

  const now = Date.now();
  const unseen = shuffle(pool.filter((i) => i.lastSeenAt === null));
  const due = pool
    .filter((i) => i.lastSeenAt !== null && dueAt(i) <= now)
    .sort((a, b) => dueAt(a) - dueAt(b));
  const rest = pool
    .filter((i) => i.lastSeenAt !== null && dueAt(i) > now)
    .sort((a, b) => (a.lastSeenAt || 0) - (b.lastSeenAt || 0));

  const newTarget = Math.min(unseen.length, Math.ceil(count * NEW_SHARE));
  const dueTarget = Math.min(due.length, count - newTarget);

  const picked = [...unseen.slice(0, newTarget), ...due.slice(0, dueTarget)];

  // Top up when a tier ran dry, so a short batch never goes out half empty
  if (picked.length < count) {
    const taken = new Set(picked.map((p) => p.id));
    for (const tier of [unseen, due, rest]) {
      for (const item of tier) {
        if (picked.length >= count) break;
        if (taken.has(item.id)) continue;
        picked.push(item);
        taken.add(item.id);
      }
    }
  }

  return shuffle(picked);
}

/**
 * Mark a batch as presented as soon as it is handed to the coach. Doing it here
 * rather than at the end of the session means an interrupted session still
 * rotates: these words are no longer due, so the next batch must differ.
 */
export function markPresented(items: KnowledgeItem[]) {
  if (items.length === 0) return;
  const ids = new Set(items.map((i) => i.id));
  const now = Date.now();
  write(
    ITEMS_KEY,
    loadItems().map((i) =>
      ids.has(i.id) ? { ...i, seenCount: i.seenCount + 1, lastSeenAt: now } : i
    )
  );
}

/** Promote an item on a correct answer, send it back to box 0 on a wrong one. */
export function recordOutcome(itemId: string, correct: boolean) {
  write(
    ITEMS_KEY,
    loadItems().map((i) => {
      if (i.id !== itemId) return i;
      return {
        ...i,
        box: correct ? Math.min(i.box + 1, MAX_BOX) : 0,
        correctCount: i.correctCount + (correct ? 1 : 0),
      };
    })
  );
}

export interface KnowledgeStats {
  total: number;
  neverSeen: number;
  dueNow: number;
  mastered: number;
  sources: number;
}

export function getStats(): KnowledgeStats {
  const items = loadItems();
  const now = Date.now();
  return {
    total: items.length,
    neverSeen: items.filter((i) => i.lastSeenAt === null).length,
    dueNow: items.filter((i) => i.lastSeenAt !== null && dueAt(i) <= now).length,
    mastered: items.filter((i) => i.box >= MAX_BOX).length,
    sources: read<KnowledgeSource>(SOURCES_KEY).length,
  };
}

// ── Backup ────────────────────────────────────────────────────

export function exportAll(): string {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), sources: loadSources(), items: loadItems() },
    null,
    2
  );
}

/** Merge a backup into the library, keeping whichever copy was studied more. */
export function importAll(json: string): { sources: number; items: number } {
  const data = JSON.parse(json);
  if (!Array.isArray(data?.sources) || !Array.isArray(data?.items)) {
    throw new Error("File di backup non valido.");
  }

  const sourcesById = new Map<string, KnowledgeSource>();
  for (const s of [...read<KnowledgeSource>(SOURCES_KEY), ...data.sources]) sourcesById.set(s.id, s);

  const itemsById = new Map<string, KnowledgeItem>();
  for (const i of [...loadItems(), ...data.items]) {
    const prev = itemsById.get(i.id);
    itemsById.set(i.id, !prev || (i.seenCount || 0) >= (prev.seenCount || 0) ? i : prev);
  }

  write(SOURCES_KEY, [...sourcesById.values()]);
  write(ITEMS_KEY, [...itemsById.values()]);
  return { sources: sourcesById.size, items: itemsById.size };
}
