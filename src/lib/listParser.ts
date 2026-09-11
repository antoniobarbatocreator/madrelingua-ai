/**
 * Reads a vocabulary list that is already structured, one entry per line, with
 * no model involved. Most personal lists look like this:
 *
 *   deadline = scadenza
 *   to put up with -> sopportare
 *   get over: superare (una delusione)
 *   - look forward to – non vedere l'ora di
 *
 * Handing such a list to the model just to split it on "=" wastes one of the
 * twenty daily requests the free tier allows. This parser costs nothing, runs
 * on the phone, and handles the common separators. Prose notes that do not
 * split cleanly are left for the model.
 */

import { ExtractedItem } from "./knowledge";

// Tried in order; the first that splits a line into two non-empty halves wins.
const SEPARATORS: RegExp[] = [
  /\s*=\s*/,
  /\s*->\s*/,
  /\s*→\s*/,
  /\s*:\s+/,
  /\t+/,
  /\s+[–—]\s+/,
  /\s+-\s+/,
];

const BULLET = /^\s*(?:[-*•·]|\d+[.)])\s+/;

export interface ParsedList {
  items: ExtractedItem[];
  /** Non-empty lines that did not split, e.g. headings or prose. */
  unparsed: number;
  /** True when the left column reads as Italian and the pair was flipped. */
  swapped: boolean;
}

export function parseVocabularyList(raw: string): ParsedList {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(BULLET, "").trim())
    .filter(Boolean);

  const pairs: [string, string][] = [];
  let unparsed = 0;

  for (const line of lines) {
    const segments = splitMultiple(line);
    let hit = false;
    for (const seg of segments) {
      const pair = splitPair(seg);
      if (pair) {
        pairs.push(pair);
        hit = true;
      }
    }
    if (!hit) unparsed++;
  }

  // Lists are sometimes written Italian first. Decide once for the whole list
  // rather than per line, so one odd entry cannot flip its neighbours.
  const swapped = pairs.length > 0 && looksItalian(pairs.map((p) => p[0])) > looksItalian(pairs.map((p) => p[1]));

  const items: ExtractedItem[] = pairs.map(([left, right]) => {
    const [phrase, translation] = swapped ? [right, left] : [left, right];
    return {
      phrase: cleanPhrase(phrase),
      translation: translation.trim(),
      context: "",
      category: "Lista personale",
    };
  });

  return { items, unparsed, swapped };
}

/** Decide whether a pasted text is a structured list or prose for the model. */
export function isStructuredList(parsed: ParsedList): boolean {
  const total = parsed.items.length + parsed.unparsed;
  if (parsed.items.length < 2) return false;
  return parsed.items.length / total >= 0.5;
}

// "Lesson 12 - Phrasal verbs" splits cleanly on " - " but is a heading, not a word
const HEADING_WORD = /^(lesson|lezione|unit|unità|unita|chapter|capitolo|module|modulo|week|settimana|day|giorno|part|parte|sezione|section|topic|argomento)\b/i;

function isHeading(left: string, weakSeparator: boolean): boolean {
  if (HEADING_WORD.test(left) && /\d/.test(left)) return true;
  // All-caps on the weak " - " separator reads as a title; "ASAP = ..." keeps
  // its "=" and stays a real entry.
  return weakSeparator && left.length > 2 && left === left.toUpperCase() && /[A-Z]/.test(left);
}

function splitPair(text: string): [string, string] | null {
  for (let i = 0; i < SEPARATORS.length; i++) {
    const m = SEPARATORS[i].exec(text);
    if (!m || m.index === 0) continue;
    const left = text.slice(0, m.index).trim();
    const right = text.slice(m.index + m[0].length).trim();
    if (!left || !right || left.length >= 120 || right.length >= 200) continue;
    if (isHeading(left, i === SEPARATORS.length - 1)) return null;
    return [left, right];
  }
  return null;
}

/**
 * "deadline = scadenza, colleague = collega" holds two entries. Only split on
 * commas when every piece has its own separator; a comma inside a translation
 * such as "superare (una malattia, una delusione)" must stay put.
 */
function splitMultiple(line: string): string[] {
  if (/[()]/.test(line)) return [line];
  const parts = line.split(/,\s+/);
  if (parts.length < 2) return [line];
  return parts.every((p) => splitPair(p)) ? parts : [line];
}

function cleanPhrase(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
}

/** Rough score of how Italian a column reads; only the comparison matters. */
function looksItalian(column: string[]): number {
  const text = column.join(" ").toLowerCase();
  let score = 0;
  for (const re of [
    /\b(il|la|lo|gli|le|un|una|di|che|non|per|con|della|delle|degli)\b/g,
    /\w+(zione|mente|are|ere|ire|ità|aggio)\b/g,
  ]) {
    score += (text.match(re) || []).length;
  }
  for (const re of [/\b(the|to|of|and|a|an|is|be|with)\b/g, /\w+(ing|tion|ly|ness|ful)\b/g]) {
    score -= (text.match(re) || []).length;
  }
  return score;
}
