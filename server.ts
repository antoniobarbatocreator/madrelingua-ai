import "dotenv/config";
import express from "express";
import path from "path";
import http from "http";
import multer from "multer";
import * as pdfParseModule from "pdf-parse";
import { WebSocketServer, WebSocket } from "ws";
import {
  GoogleGenAI,
  Modality,
  StartSensitivity,
  EndSensitivity,
  ActivityHandling,
  LiveServerMessage,
  Type,
} from "@google/genai";
import { createServer as createViteServer } from "vite";

const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "5mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("FATAL: GEMINI_API_KEY non configurata. Il servizio vocale non funzionera.");
}

function getGeminiClient(): GoogleGenAI {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY non configurata.");
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", apiKeySet: !!GEMINI_API_KEY });
});

// ── Voice preview endpoint ──────────────────────────────────────
app.post("/api/voice-preview", async (req, res) => {
  try {
    const { voiceName = "Achird", text } = req.body;
    const ai = getGeminiClient();
    const previewText = text?.trim() || `Hello! I'm ${voiceName}, your English coach.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: previewText }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });
    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data) {
      return res.json({ success: true, audioBase64: part.inlineData.data, mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000" });
    }
    return res.status(500).json({ error: "Nessun audio generato." });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Knowledge extraction ────────────────────────────────────────

interface ExtractedItem {
  phrase: string;
  translation: string;
  context?: string;
  category?: string;
}

/** Split on sentence boundaries where possible so an entry is not cut in half. */
function splitIntoBlocks(text: string, size: number): string[] {
  const blocks: string[] = [];
  let at = 0;
  while (at < text.length) {
    let end = Math.min(at + size, text.length);
    if (end < text.length) {
      const breakAt = text.lastIndexOf(". ", end);
      if (breakAt > at + size * 0.5) end = breakAt + 1;
    }
    blocks.push(text.slice(at, end));
    at = end;
  }
  return blocks;
}

function dedupeItems(items: ExtractedItem[]): ExtractedItem[] {
  const seen = new Set<string>();
  const out: ExtractedItem[] = [];
  for (const item of items) {
    const phrase = (item.phrase || "").trim();
    if (!phrase) continue;
    const key = phrase.toLowerCase().replace(/[^a-z0-9\s']/g, "").replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      phrase,
      translation: (item.translation || "").trim(),
      context: (item.context || "").trim(),
      category: (item.category || "Generale").trim(),
    });
  }
  return out;
}

const MAX_BLOCKS = 12;
const BLOCK_SIZE = 9000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry the transient failures the Gemini API hands out under load. */
async function callWithRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.status;
      if (status !== 503 && status !== 429 && status !== 500) throw err;
      console.warn(`[KNOWLEDGE] API ${status}, retry ${attempt + 1}/${tries}`);
      await sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function extractVocabulary(rawText: string): Promise<ExtractedItem[]> {
  // Keep line structure: in study notes one line is usually one entry
  const text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return [];

  const ai = getGeminiClient();
  const blocks = splitIntoBlocks(text, BLOCK_SIZE).slice(0, MAX_BLOCKS);
  console.log(`[KNOWLEDGE] Extracting from ${blocks.length} block(s), ${text.length} chars`);

  const collected: ExtractedItem[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const prompt = `These are study notes belonging to an Italian learner of English. They come from lessons with native speakers, so they may be messy: bullet points, half sentences, mixed Italian and English.

Extract EVERY English item worth revising: vocabulary, phrasal verbs, idioms, collocations, fixed expressions and useful grammar structures.

For each item give:
- phrase: the English item in its base form (infinitive for verbs, singular for nouns)
- translation: the Italian translation, accurate for how it is used here
- context: a short natural English sentence showing the item in use. If the notes already contain a good example, prefer it.
- category: a short theme label in Italian (Lavoro, Viaggi, Vita quotidiana, Cibo, Salute, Grammatica, Modi di dire, ...)

Rules:
- If the notes already pair an English item with its Italian translation, keep that pairing exactly.
- Do not invent items that are not in the notes.
- Do not include bare proper nouns, page numbers or headings.
- Extract generously: missing something the learner wrote down is worse than including something ordinary.

Notes (block ${i + 1} of ${blocks.length}):
${blocks[i]}`;

    // The model occasionally returns a near-empty array for a block that plainly
    // holds dozens of entries. It is not deterministic, so the guard is to notice
    // an implausibly thin result and ask again, keeping the richest answer.
    const minPlausible = Math.max(3, Math.floor(blocks[i].length / 400));
    let best: ExtractedItem[] = [];

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await callWithRetry(() =>
          ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    phrase: { type: Type.STRING },
                    translation: { type: Type.STRING },
                    context: { type: Type.STRING },
                    category: { type: Type.STRING },
                  },
                  required: ["phrase", "translation"],
                },
              },
            },
          })
        );

        const parsed = res.text ? JSON.parse(res.text) : [];
        const got: ExtractedItem[] = Array.isArray(parsed) ? parsed : [];
        if (got.length > best.length) best = got;

        if (best.length >= minPlausible) break;
        console.warn(
          `[KNOWLEDGE] Block ${i + 1}: only ${got.length} items for ${blocks[i].length} chars ` +
            `(expected >= ${minPlausible}), retrying`
        );
      } catch (err: any) {
        console.warn(`[KNOWLEDGE] Block ${i + 1} attempt ${attempt + 1} failed:`, err?.message || err);
      }
    }

    collected.push(...best);
  }

  const deduped = dedupeItems(collected);
  console.log(`[KNOWLEDGE] Extracted ${deduped.length} unique items (${collected.length} raw)`);
  return deduped;
}

app.post("/api/knowledge/extract-text", async (req, res) => {
  try {
    const text = String(req.body?.text || "");
    if (text.trim().length < 10) {
      return res.status(400).json({ error: "Testo troppo corto." });
    }
    const items = await extractVocabulary(text);
    return res.json({ success: true, items, excerpt: text.slice(0, 8000) });
  } catch (error: any) {
    console.error("[KNOWLEDGE] extract-text failed:", error?.message);
    return res.status(500).json({ error: error.message || "Estrazione fallita." });
  }
});

app.post("/api/knowledge/extract-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nessun file ricevuto." });
    console.log(`[KNOWLEDGE] PDF: ${req.file.originalname} (${req.file.size} bytes)`);

    let text = "";
    try {
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text || "";
    } catch (parseErr) {
      console.warn("[KNOWLEDGE] pdf-parse failed, falling back to raw text");
      text = req.file.buffer.toString("utf-8");
    }

    text = text.replace(/\s+/g, " ").trim();
    if (text.length < 10) {
      return res.status(400).json({
        error: "Nessun testo leggibile nel file. Se e una scansione, il testo non e selezionabile.",
      });
    }

    const items = await extractVocabulary(text);
    return res.json({ success: true, items, excerpt: text.slice(0, 8000) });
  } catch (error: any) {
    console.error("[KNOWLEDGE] extract-pdf failed:", error?.message);
    return res.status(500).json({ error: error.message || "Lettura del file fallita." });
  }
});

// ── Activity definitions ────────────────────────────────────────
type Activity = "conversazione" | "lezione" | "vocabolario" | "quiz" | "traduci" | "ripasso";

interface SessionKnowledge {
  items: { phrase: string; translation: string; context?: string; category?: string }[];
  sourceName?: string;
  mode: "drill" | "conversation";
}

/**
 * The batch is chosen by the app, never by the model. The model gets only these
 * items and is told not to stray, which is what stops a review from drifting
 * back to the same familiar handful of words session after session.
 */
function buildKnowledgeBlock(k: SessionKnowledge, level: string): string {
  const list = k.items
    .map((it, n) => {
      const example = it.context ? ` | example: ${it.context}` : "";
      return `${n + 1}. ${it.phrase} = ${it.translation}${example}`;
    })
    .join("\n");

  const scope = k.sourceName
    ? `These come from the learner's own notes titled "${k.sourceName}".`
    : `These come from the learner's own study notes.`;

  if (k.mode === "conversation") {
    return `
THE LEARNER'S OWN MATERIAL — today's selection:
${list}

${scope}

HOW TO USE IT:
- Hold a natural conversation, but steer it so these specific items come up.
- Work them in one at a time, in context, the way they would really be used.
- Do NOT announce the list and do NOT quiz mechanically. This is a conversation.
- When the learner uses one of these correctly, acknowledge it briefly and move on.
- If they never reach one, use it yourself in your own reply so they hear it in context.
- Cover as many of the ${k.items.length} items as the conversation naturally allows.
- Do NOT bring in vocabulary outside this list unless the learner introduces it.`;
  }

  return `
THE LEARNER'S OWN MATERIAL — today's selection:
${list}

${scope}

HOW TO DRILL IT:
- Work through these ${k.items.length} items ONE AT A TIME, in the order given.
- For each one, pick a different way to test it so the session does not feel mechanical:
  say the Italian and ask for the English; give an English sentence with the item
  missing; describe a situation and ask which expression fits; ask them to build
  their own sentence with it.
- Wait for the answer. Give the learner time to think.
- If correct: confirm briefly, then move straight to the next item.
- If wrong or unsure: give the correct form, say it clearly once more, and have them
  repeat it before moving on.
- Announce progress occasionally ("ne restano quattro") so the session feels finite.
- STAY INSIDE THIS LIST. These are the words the app selected for today. Do not
  substitute other vocabulary, and do not revisit an item once it is done.
- When all ${k.items.length} are covered, give a short recap of the ones that needed
  correcting, then tell the learner the review is complete.`;
}

function getActivityInstructions(activity: Activity, level: string): string {
  const l = level || "B1-B2";

  if (activity === "ripasso") {
    return `PERSONAL REVIEW MODE:
- You are reviewing material the learner collected themselves, from their own English course.
- The exact items for this session are listed further down. They were chosen by the app
  based on what the learner has already practised and what they are due to revisit.
- Treat this material as the point of the session. It matters more to them than anything
  you could think up, because it is what they actually wrote down in their lessons.
- Adapt HOW you explain to level ${l}, but never swap the items for easier or harder ones.`;
  }

  if (activity === "conversazione") {
    if (l === "A1-A2") return `FREE CONVERSATION — A1-A2:
- Topics MUST be simple and concrete: family, food and meals, daily routine (what time do you wake up, what do you eat), home and rooms, weather, colors, numbers, animals, clothes, shopping (at the supermarket), basic feelings (happy, sad, tired, hungry).
- Use only present simple and "to be/to have". No past tense unless the learner brings it up.
- Ask YES/NO questions or simple WH-questions: "Do you like pizza?", "What is your name?", "Where do you live?", "How many brothers do you have?"
- If the learner answers in Italian, gently reformulate their answer in simple English and ask them to repeat it.
- One question at a time. Wait for the answer before moving on.
- Celebrate every correct sentence enthusiastically in Italian.`;

    if (l === "C1-C2") return `FREE CONVERSATION — C1-C2:
- Topics should be intellectually stimulating: current affairs, ethical dilemmas, cultural differences between Italy and English-speaking countries, work culture, technology and society, philosophy of language, humor and sarcasm in English, literature and cinema analysis, economic trends, travel experiences in depth.
- Use natural speech with idioms, phrasal verbs, colloquialisms, and register shifts.
- Challenge the learner to express nuanced opinions: "What's your take on...?", "How would you argue the opposite?", "Can you put that more diplomatically?"
- Point out when something sounds "correct but unnatural" — suggest what a native would actually say.
- Discuss connotations, false friends (actually/attualmente, eventually/eventualmente, sensible/sensibile), and subtle word choices.
- Push for sophisticated connectors: nevertheless, notwithstanding, as far as I'm concerned, to be fair, having said that.`;

    return `FREE CONVERSATION — B1-B2:
- Topics: travel experiences, work and career, opinions on news/culture, hobbies in depth, health and lifestyle, future plans, hypothetical situations, comparing Italy with other countries, technology, entertainment.
- Use present perfect ("Have you ever been to...?"), past simple, future forms, first conditional ("If you go to London, you should visit...").
- Introduce common phrasal verbs naturally: look forward to, get along with, come across, figure out, turn out, put up with.
- Ask opinion questions: "What do you think about...?", "Would you rather...?", "What would you do if...?"
- Model correct forms naturally when the learner makes errors — don't always stop to correct, but weave corrections into your response.
- Introduce useful collocations: make a decision, take advantage, catch someone's attention, do someone a favour.`;
  }

  if (activity === "lezione") {
    if (l === "A1-A2") return `LESSON MODE — A1-A2:
- Grammar topics to propose: present simple (affirmative, negative, questions with do/does), to be and to have, articles (a/an/the and when to omit), plurals (regular -s/-es and key irregulars: men, women, children, people), there is/there are, possessive adjectives (my/your/his/her), can/can't, basic prepositions (in/on/at for place and time), this/that/these/those.
- Expression topics: introducing yourself, asking for directions, ordering food, telling the time, asking prices ("How much is this?"), basic phone calls, at the doctor.
- Teach ONE rule at a time. Explain in Italian, give 2-3 English examples, then ask the learner to make their own sentence.
- Use pattern drills: "I like coffee. Now say: I like tea. Now: I like pizza."
- Highlight Italian-English false friends at this level: "library" non significa "libreria" (bookshop), "actually" non significa "attualmente" (currently).`;

    if (l === "C1-C2") return `LESSON MODE — C1-C2:
- Grammar topics: mixed conditionals (If I had studied harder, I would be fluent now), inversion for emphasis (Not only did he refuse, but he also...; Rarely have I seen...; Under no circumstances should you...), cleft sentences (What I find most interesting is...; It was only when...), subjunctive in formal English (I suggest he be present; It's essential that she arrive), advanced passive (He is said to have been...; The building is being demolished), discourse markers for essays (Furthermore, In light of, Notwithstanding).
- Expression topics: negotiation language, diplomatic disagreement, academic writing phrases, formal email register vs casual, presenting arguments, hedging (It could be argued that..., There seems to be...), humor and irony in English.
- Focus on REGISTER — when to use formal vs informal, written vs spoken English.
- Discuss etymology and word formation: Latin roots vs Germanic roots in English, and how Italian speakers can leverage their Latin heritage.
- Analyze real-world texts: headlines, song lyrics, political speeches — discuss style and rhetorical devices.`;

    return `LESSON MODE — B1-B2:
- Grammar topics to propose: present perfect vs past simple (the Italian struggle), present perfect continuous, future forms (will vs going to vs present continuous for plans), first and second conditional, passive voice, relative clauses (who/which/that/whose and when to omit), reported speech, comparatives and superlatives, modal verbs (should/must/have to/might/could for advice, obligation, possibility).
- Expression topics: job interviews, making complaints politely, expressing opinions and disagreeing, describing experiences, making plans, discussing pros and cons, giving advice, talking about regrets (I wish I had...).
- Common error patterns for Italian speakers to address: present perfect ("I live here since 2020" → "I've lived here since 2020"), false friends (eventualmente/eventually, simpatico/sympathetic), word order with adverbs, missing auxiliary in questions.
- After explaining a rule, give a practical scenario where the learner must use it in conversation.`;
  }

  if (activity === "vocabolario") {
    if (l === "A1-A2") return `VOCABULARY MODE — A1-A2:
- WORD CATEGORIES TO TEACH (rotate between them):
  Family: mother, father, brother, sister, son, daughter, husband, wife, grandparents
  Food: bread, milk, water, meat, fish, rice, fruit, vegetables, coffee, sugar
  Home: kitchen, bedroom, bathroom, door, window, table, chair, bed, fridge
  Body: head, hand, arm, leg, eye, ear, mouth, stomach
  Daily life: school, work, bus, car, money, shop, hospital, bank
  Adjectives: big, small, hot, cold, good, bad, new, old, cheap, expensive
  Verbs: go, come, eat, drink, sleep, work, buy, want, need, like, have
- NO phrasal verbs at this level. NO idioms.
- FOLLOW THIS SEQUENCE FOR EACH WORD:
  1. Say the English word clearly and slowly, then the Italian translation
  2. Give a very simple example sentence: "I eat bread every morning"
  3. Ask the learner to make their own sentence with that word
  4. If they struggle, give them an Italian sentence to translate
- Group words by theme (5-6 words per theme), then recap.`;

    if (l === "C1-C2") return `VOCABULARY MODE — C1-C2:
- WORD CATEGORIES TO TEACH (focus on sophistication and nuance):
  Advanced phrasal verbs: come to terms with, get carried away, do away with, live up to, come up against, bring about, account for, dawn on, latch onto
  Idioms and expressions: to be in the same boat, to bite the bullet, the elephant in the room, to go the extra mile, a blessing in disguise, to play it by ear, to cut corners, the ball is in your court
  False friends for Italians: actually/attualmente, eventually/eventualmente, sensible/sensibile, pretend/pretendere, argument/argomento, sympathetic/simpatico, novel/novella, consistent/consistente
  Register pairs: purchase/buy, commence/start, enquire/ask, reside/live, deceased/dead, intoxicated/drunk, perspire/sweat
  Collocations: wreak havoc, forge a path, harbor doubts, wield influence, draw a conclusion, raise concerns, undergo surgery, reach a consensus
  Connotation groups: slim/thin/skinny/scrawny, house/home/dwelling/residence, look/stare/gaze/glare/peek
- SEQUENCE: present the word/expression, discuss its nuance and register, give a context where it's specifically better than a simpler alternative, ask the learner to use it in a sentence that captures the nuance.
- Discuss word origins when interesting (Latin vs Germanic roots, loanwords).`;

    return `VOCABULARY MODE — B1-B2:
- WORD CATEGORIES TO TEACH (rotate between them):
  Phrasal verbs (essential): look forward to, get along with, come across, turn out, figure out, give up, put off, bring up, set up, take after, run out of, break down, look into, get over, put up with, carry on, come up with, end up
  Collocations: make a decision (not "do a decision"), do homework (not "make homework"), take a photo, catch a cold, pay attention, keep in touch, have a look, tell the truth, miss the point
  False friends: actually (in realtà), eventually (alla fine), library (biblioteca), sensible (sensato), sympathetic (comprensivo), attend (partecipare), pretend (fingere)
  Everyday idioms: break the ice, piece of cake, it's not my cup of tea, once in a blue moon, hit the nail on the head, cost an arm and a leg
  Work vocabulary: deadline, meeting, report, colleague, salary, apply for, resign, hire, fire, promote
  Travel: boarding pass, check in, gate, delay, accommodation, currency, exchange rate
- SEQUENCE FOR EACH WORD:
  1. Present the English word/phrasal verb with Italian translation
  2. Give an Italian sentence using the concept
  3. Ask the learner to translate it into English
  4. If correct, move on. If not, explain and model the correct form.
- After 5-6 words, do a quick recap.`;
  }

  if (activity === "quiz") {
    if (l === "A1-A2") return `QUIZ & GAMES — A1-A2:
- GAME TYPES (keep them very simple):
  Translation flash: say a word in Italian, learner says it in English (casa→house, gatto→cat, acqua→water)
  Yes or No: "Is 'dog' an animal? Is 'table' a food?" — very simple true/false
  What's missing: "I ___ pizza" (like), "She ___ to school" (goes) — basic verb gaps
  Choose one: "A or B? Do you SAY 'I have 20 years' or 'I am 20 years old'?" — common Italian mistakes
  Opposite game: "What's the opposite of 'big'? Of 'hot'? Of 'happy'?"
- Use only present simple, to be, to have in questions.
- Explain every answer in Italian.
- Give lots of encouragement: "Bravo!", "Perfetto!", "Quasi! La risposta era..."
- Keep score and celebrate every point.`;

    if (l === "C1-C2") return `QUIZ & GAMES — C1-C2:
- GAME TYPES (challenging and nuanced):
  Nuance challenge: give two similar words, learner explains the difference (efficient/effective, deny/refuse, convince/persuade, rob/steal, borrow/lend)
  Register shift: give an informal sentence, learner rephrases it formally (and vice versa). "This idea sucks" → "This proposal has significant shortcomings"
  Idiom origin: describe a situation, learner guesses the idiom. "When you finally accept a difficult truth" → "to bite the bullet"
  Error forensics: give a sentence with a subtle error (often a false friend or register mistake), learner identifies AND explains it
  Phrasal verb master: give a definition, learner produces the correct phrasal verb. "To tolerate something annoying" → "to put up with"
  Spot the false friend: "The Italian politician's argument was very convincing" — is this correct? (Yes, but "argument" doesn't mean "argomento" in Italian)
  Complete the collocation: "wreak ___" (havoc), "forge a ___" (path), "harbor ___" (doubts)
- No score inflation — only award points for genuinely correct, nuanced answers.
- When the learner gets it wrong, discuss WHY the error is common for Italian speakers.`;

    return `QUIZ & GAMES — B1-B2:
- GAME TYPES TO ROTATE:
  Fill the Gap: sentences with missing phrasal verbs or collocations. "I'm really looking ___ to the holiday" (forward). "Can you ___ me a favour?" (do, not make)
  Translation sprint: Italian sentences with tricky structures → English. "Vivo qui da 5 anni" → "I've lived here for 5 years" (NOT "I live here since 5 years")
  False friend trap: give a sentence, learner spots the false friend usage. "I will eventually call you" — does this mean "eventualmente" or "alla fine"?
  Odd One Out: "said, told, spoke, talked" — which one needs a direct object? (told)
  Spot the Error: "She suggested me to go" (→ "She suggested I go" or "She suggested going"). Focus on typical Italian-speaker errors.
  Word Association: say a word, learner gives a collocation. "Make" → "a decision, a mistake, friends, progress"
- Keep score and announce it every 3-4 rounds.
- After each wrong answer, explain the rule and give another similar question to reinforce.`;
  }

  if (activity === "traduci") {
    if (l === "A1-A2") return `TRANSLATION MODE — A1-A2:
- Translate very simple sentences between Italian and English.
- When translating Italian→English, use only present simple, to be, to have. Avoid complex structures.
- After each translation, highlight ONE grammar point in Italian:
  "Ho 25 anni" → "I am 25 years old" — explain: in English we use "to be" for age, not "to have" as in Italian.
  "Mi piace il gelato" → "I like ice cream" — explain: no article "the" before general concepts in English.
- If the learner tries to translate something too complex, simplify it first: "Let's start with something easier: how would you say just the first part?"
- Point out word-by-word translation traps that Italian speakers fall into.`;

    if (l === "C1-C2") return `TRANSLATION MODE — C1-C2:
- Handle complex, nuanced translations in both directions.
- When translating, discuss multiple valid translations and their register/tone differences.
- Highlight untranslatable concepts: Italian words with no English equivalent (abbiocco, meriggiare, dietrologia, arrangiarsi, magari as a response) and vice versa (serendipity, accountability, cringe, awkward).
- Discuss how the same idea is expressed differently in the two cultures, not just languages.
- For literary or formal text, discuss translation choices: literal vs free translation, domestication vs foreignization.
- Point out when a translation "works" but sounds unnatural — suggest how a native would actually express the same idea.
- Address common professional translation needs: email register, business proposals, academic abstracts.`;

    return `TRANSLATION MODE — B1-B2:
- Translate sentences of moderate complexity between Italian and English.
- Focus on structures that Italian speakers typically get wrong:
  Present perfect: "Studio inglese da 3 anni" → "I've been studying English for 3 years" (NOT "I study English since 3 years")
  Conditional: "Se fossi ricco, comprerei una casa" → "If I were rich, I would buy a house"
  Passive: "La pizza è stata inventata a Napoli" → "Pizza was invented in Naples"
  Phrasal verbs: "L'ho scoperto per caso" → "I came across it by chance"
- After each translation, point out the key structural difference between the Italian and English version.
- When the learner translates, praise what's correct before correcting what's wrong.
- Suggest more natural/idiomatic alternatives when the translation is correct but stiff.`;
  }

  return "";
}


const LEVEL_PROFILES: Record<string, string> = {
  "A1-A2": `LEVEL A1-A2 — PRINCIPIANTE / ELEMENTARE
SPEAKING SPEED: Very slow and clear. Pause between sentences.
LANGUAGE MIX: 70% Italian, 30% English. Always translate English phrases into Italian right after.
VOCABULARY: Only the 500 most common English words. No phrasal verbs, no idioms.
GRAMMAR FOCUS: present simple (I go, he goes), to be, to have, articles (a/the), plurals, basic questions with do/does, there is/are, can/can't, basic prepositions (in, on, at).
TOPICS: greetings, introductions, family, food, daily routine, numbers, colors, weather, time, shopping basics.
CORRECTION STYLE: Correct every significant error. Repeat the correct form slowly, ask the learner to repeat it. Use Italian to explain why.
SENTENCE LENGTH: Your English sentences must be max 6-8 words. One concept at a time.
ENCOURAGEMENT: Praise frequently in Italian ("Bravo!", "Perfetto!", "Ci sei quasi!"). Make the learner feel safe to make mistakes.
PATIENCE: Give the learner lots of time to think. If they struggle, offer the answer in Italian first, then in English.`,

  "B1-B2": `LEVEL B1-B2 — INTERMEDIO / INTERMEDIO SUPERIORE
SPEAKING SPEED: Moderate, natural rhythm but not too fast. Enunciate clearly.
LANGUAGE MIX: 30% Italian, 70% English. Use Italian only to clarify complex grammar or abstract concepts.
VOCABULARY: 2000-4000 words. Introduce common phrasal verbs (look up, get along, turn out), collocations (make a decision, take advantage), and everyday idioms (it's raining cats and dogs, break the ice).
GRAMMAR FOCUS: present perfect vs past simple, future forms (will/going to/present continuous), first and second conditional, passive voice, relative clauses (who/which/that), reported speech, comparatives and superlatives, modal verbs for advice/obligation (should, must, have to).
TOPICS: work, travel experiences, opinions, news, culture, health, education, technology, relationships, plans and ambitions.
CORRECTION STYLE: Correct important errors that affect meaning. For minor errors, model the correct form naturally without interrupting ("Right, so you WENT there..."). Push the learner to self-correct ("Can you say that differently?").
SENTENCE LENGTH: Use normal sentences (10-15 words). Introduce subordinate clauses.
CHALLENGE: Ask open-ended questions. Push the learner to express opinions and justify them in English.`,

  "C1-C2": `LEVEL C1-C2 — AVANZATO / PADRONANZA
SPEAKING SPEED: Natural native speed. No simplification.
LANGUAGE MIX: 95% English, 5% Italian — use Italian only for very specific linguistic comparisons between the two languages or to highlight a false friend.
VOCABULARY: Full range. Use advanced collocations (undergo surgery, draw a conclusion), academic vocabulary, register variations (formal vs informal), nuanced synonyms, and sophisticated connectors (nevertheless, notwithstanding, insofar as).
GRAMMAR FOCUS: mixed conditionals, inversion for emphasis (Not only did he..., Rarely have I...), cleft sentences (What I meant was..., It was John who...), advanced passive constructions, subjunctive (I suggest he go), discourse markers for academic/professional English.
TOPICS: Any topic at depth — politics, philosophy, science, literature, economics, cultural nuances, humor, sarcasm, professional presentations, debate.
CORRECTION STYLE: Focus on style, register, and nuance rather than grammar. Point out when something is "correct but unnatural" and suggest how a native would say it. Discuss connotations and subtle differences (e.g., "slim" vs "thin" vs "skinny").
SENTENCE LENGTH: Full complexity. Use embedded clauses, parentheticals, hedging.
CHALLENGE: Devil's advocate. Challenge the learner's arguments. Ask them to rephrase using more sophisticated structures. Discuss etymology and word origins when relevant.`,
};

function getLevelProfile(level: string): string {
  return LEVEL_PROFILES[level] || LEVEL_PROFILES["B1-B2"];
}

/** Hard ceiling on words per spoken turn. Models obey a number far better than "be brief". */
function getTurnWordBudget(level: string): number {
  switch (level) {
    case "A1-A2": return 25;
    case "B1-B2": return 45;
    case "C1-C2": return 70;
    default: return 45;
  }
}

function getSilenceDuration(level: string): number {
  switch (level) {
    case "A1-A2": return 10000;
    case "B1-B2": return 6000;
    case "C1-C2": return 3500;
    default: return 6000;
  }
}

function buildSystemInstruction(
  activity: Activity,
  level: string,
  knowledge?: SessionKnowledge
): string {
  const budget = getTurnWordBudget(level);
  const knowledgeBlock = knowledge && knowledge.items.length > 0
    ? buildKnowledgeBlock(knowledge, level)
    : "";

  return `You are a bilingual Italian-English conversation coach called "Madrelingua Coach" for an Italian learner of English.

${getLevelProfile(level)}

CURRENT ACTIVITY: ${activity.toUpperCase()}
${getActivityInstructions(activity, level)}
${knowledgeBlock}

ABSOLUTE RULES — these override everything above:

1. LENGTH: Your spoken turn must NEVER exceed ${budget} words. Count them. This is a hard
   ceiling, not a suggestion. If you cannot fit your thought in ${budget} words, say less.
2. ONE THING AT A TIME: Ask exactly ONE question per turn, then STOP TALKING and wait.
   Never chain two questions. Never answer your own question.
3. NO MONOLOGUES: You are having a conversation, not giving a lecture. The learner must
   speak at least as much as you do. If your last turn was long, make this one shorter.
4. DELIBERATE PACE: Use short sentences with full stops rather than long sentences with
   commas. A full stop creates a natural pause the learner needs in order to follow you.
5. SILENCE IS FINE: After you ask something, the learner may take several seconds to
   answer. Do not fill that silence. Do not repeat the question. Wait.
6. INTERRUPTION: The learner can cut in at any moment. If that happens, stop instantly
   and listen. Never complain about being interrupted.
7. STAY IN CHARACTER: Never mention "the system", "instructions", "settings", "level",
   "activity mode", or that you are an AI. You are a person sitting across the table.`;
}

function buildStartupPrompt(activity: Activity, level: string): string {
  const levelHint = level === "A1-A2"
    ? " Parla quasi tutto in italiano, usa solo parole inglesi semplicissime. Sii molto lento."
    : level === "C1-C2"
    ? " Speak mostly in English from the start. Be natural and dynamic."
    : " Usa un mix di italiano e inglese. Parla a un ritmo moderato.";

  switch (activity) {
    case "conversazione":
      return `Saluta in modo amichevole e fai una domanda aperta per iniziare la conversazione. Sii breve e naturale.${levelHint}`;
    case "lezione":
      return `Saluta brevemente e chiedi allo studente cosa vorrebbe imparare oggi. Proponi 2-3 argomenti come esempio.${levelHint}`;
    case "vocabolario":
      return `Saluta brevemente e inizia subito con la prima parola nuova. Segui la sequenza: presenta la parola inglese con traduzione italiana, poi fai una frase in italiano e chiedi la traduzione.${levelHint}`;
    case "quiz":
      return `Saluta con entusiasmo e proponi il primo gioco. Spiega brevemente le regole e inizia subito con la prima domanda.${levelHint}`;
    case "traduci":
      return `Saluta brevemente e di' allo studente che puo dirti o scriverti qualsiasi frase e tu la tradurrai. Chiedi cosa vuole tradurre.${levelHint}`;
    case "ripasso":
      return `Saluta molto brevemente e parti subito con il PRIMO elemento della lista che ti e stata data. Non elencare le parole in anticipo, non spiegare come funziona il ripasso: fai direttamente la prima domanda.${levelHint}`;
  }
}

function sendText(liveSession: any, text: string) {
  liveSession.sendClientContent({
    turns: [{ role: "user", parts: [{ text }] }],
    turnComplete: true,
  });
}

// ── WebSocket relay ─────────────────────────────────────────────
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/api/live-ws" });

interface SessionData {
  activity: Activity;
  level: string;
  voiceName: string;
  turnMode: "free" | "push_to_talk";
  liveSessionReady: boolean;
  initialTurnSent: boolean;
  teacherTurnActive: boolean;
  currentTeacherTurnId?: string;
  turnSequence: number;
  resumptionHandle?: string;
  audioChunksReceived?: number;
  knowledge?: SessionKnowledge;
  reconnecting: boolean;
  reconnectAttempts: number;
  ended: boolean;
}

wss.on("connection", (clientWs: WebSocket) => {
  console.log("[WS] Client connesso");
  let liveSession: any = null;
  let session: SessionData | null = null;

  async function connectToGemini(ai: GoogleGenAI, sess: SessionData, isReconnect: boolean) {
    const { activity, level, voiceName, turnMode } = sess;
    const silenceMs = getSilenceDuration(level);
    const tag = isReconnect ? "[RECONNECT]" : "[GEMINI]";
    console.log(`${tag} VAD: silenceDurationMs=${silenceMs} level=${level}`);

    const realtimeInputConfig: any = turnMode === "push_to_talk"
      ? {
          automaticActivityDetection: { disabled: true },
          activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
        }
      : {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            prefixPaddingMs: 300,
            silenceDurationMs: silenceMs,
          },
          activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
        };

    const systemInstruction = buildSystemInstruction(activity, level, sess.knowledge);
    const sessionResumption = isReconnect && sess.resumptionHandle
      ? { handle: sess.resumptionHandle }
      : undefined;

    console.log(`${tag} Connecting to gemini-3.1-flash-live-preview...${sessionResumption ? " (with resumption handle)" : ""}`);

    try {
      liveSession = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
            languageCode: "en-US",
          },
          realtimeInputConfig,
          systemInstruction,
          contextWindowCompression: { slidingWindow: {} },
          sessionResumption,
        },
        callbacks: {
          onmessage: (liveMsg: LiveServerMessage) => {
            if (!session) return;

            if (liveMsg.sessionResumptionUpdate?.resumable && liveMsg.sessionResumptionUpdate.newHandle) {
              session.resumptionHandle = liveMsg.sessionResumptionUpdate.newHandle;
            }

            if (liveMsg.goAway) {
              console.log("[GEMINI] GoAway received — will auto-reconnect");
              send({ type: "reconnecting" });
              attemptReconnect();
              return;
            }

            if (liveMsg.setupComplete) {
              console.log(`${tag} Setup complete — session ready`);
              session.liveSessionReady = true;
              session.reconnecting = false;
              session.reconnectAttempts = 0;
              if (isReconnect) {
                send({ type: "reconnected" });
              } else {
                send({ type: "setup_complete" });
              }
              if (!session.initialTurnSent) {
                triggerInitialTurn();
              }
            }

            const parts = liveMsg.serverContent?.modelTurn?.parts;
            if (parts) {
              if (!session.teacherTurnActive) {
                session.teacherTurnActive = true;
                session.turnSequence++;
                session.currentTeacherTurnId = `t_${session.turnSequence}_${Date.now()}`;
                console.log(`[GEMINI] Teacher turn started: ${session.currentTeacherTurnId}`);
                send({ type: "teacher_turn_started", teacherTurnId: session.currentTeacherTurnId });
              }
              for (const part of parts) {
                if (part.inlineData?.data) {
                  send({ type: "audio", data: part.inlineData.data, mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000", teacherTurnId: session.currentTeacherTurnId });
                }
                if (part.text) {
                  send({ type: "teacher_transcript", text: part.text, teacherTurnId: session.currentTeacherTurnId });
                }
              }
            }

            const coachText = liveMsg.serverContent?.outputTranscription?.text;
            if (coachText) {
              send({ type: "teacher_transcript", text: coachText, teacherTurnId: session.currentTeacherTurnId });
            }

            const userText = liveMsg.serverContent?.inputTranscription?.text;
            if (userText) {
              send({ type: "user_transcript", text: userText });
            }

            if (liveMsg.serverContent?.interrupted) {
              console.log("[GEMINI] Interrupted");
              const id = session.currentTeacherTurnId;
              session.teacherTurnActive = false;
              session.currentTeacherTurnId = undefined;
              send({ type: "interrupted", teacherTurnId: id });
            }

            if (liveMsg.serverContent?.turnComplete) {
              console.log("[GEMINI] Turn complete");
              const id = session.currentTeacherTurnId;
              session.teacherTurnActive = false;
              session.currentTeacherTurnId = undefined;
              send({ type: "turn_complete", teacherTurnId: id });
            }
          },
          onclose: () => {
            console.log(`${tag} Connection closed (ready=${session?.liveSessionReady}, ended=${session?.ended})`);
            if (session && !session.ended && session.liveSessionReady) {
              console.log("[GEMINI] Unexpected close — attempting reconnect");
              send({ type: "reconnecting" });
              attemptReconnect();
            } else if (!session?.liveSessionReady) {
              send({ type: "error", error: "Sessione chiusa prima dell'avvio. Verifica la API key." });
              send({ type: "session_closed" });
            }
          },
          onerror: (err: any) => {
            console.error(`${tag} Error:`, err?.message || err);
            send({ type: "error", error: err?.message || "Errore sessione Gemini" });
          },
        },
      });

      console.log(`${tag} Connection established, liveSession assigned`);
      if (!isReconnect) {
        send({ type: "connected", activity, level, turnMode, voiceName });
      }

      if (session.liveSessionReady && !session.initialTurnSent) {
        console.log(`${tag} setupComplete already fired before connect resolved — triggering initial turn now`);
        triggerInitialTurn();
      }
    } catch (connErr: any) {
      console.error(`${tag} Connection FAILED:`, connErr?.message || connErr);
      if (isReconnect && session && session.reconnectAttempts < 3) {
        const delay = 2000 * (session.reconnectAttempts + 1);
        console.log(`${tag} Will retry in ${delay}ms (attempt ${session.reconnectAttempts + 1}/3)`);
        setTimeout(() => attemptReconnect(), delay);
      } else {
        send({ type: "error", error: connErr.message || "Impossibile connettersi al servizio vocale" });
        send({ type: "session_closed" });
      }
    }
  }

  async function attemptReconnect() {
    if (!session || session.ended || clientWs.readyState !== WebSocket.OPEN) return;
    if (session.reconnectAttempts >= 3) {
      console.log("[RECONNECT] Max attempts reached — giving up");
      send({ type: "error", error: "Impossibile riconnettersi. Riavvia la sessione." });
      send({ type: "session_closed" });
      return;
    }
    session.reconnecting = true;
    session.reconnectAttempts++;
    session.liveSessionReady = false;
    session.teacherTurnActive = false;
    session.currentTeacherTurnId = undefined;
    if (liveSession) {
      try { liveSession.close(); } catch (e) {}
      liveSession = null;
    }
    console.log(`[RECONNECT] Attempt ${session.reconnectAttempts}/3 (handle=${session.resumptionHandle ? "yes" : "no"})`);
    try {
      const ai = getGeminiClient();
      await connectToGemini(ai, session, true);
    } catch (err: any) {
      console.error("[RECONNECT] Failed:", err?.message);
    }
  }

  clientWs.on("message", async (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "init") {
        const activity: Activity = msg.activity || "conversazione";
        const level = msg.level || "A1-A2";
        const voiceName = msg.voiceName || "Achird";
        const turnMode = msg.turnMode || "free";

        console.log(`[INIT] activity=${activity} level=${level} voice=${voiceName} mode=${turnMode}`);

        const knowledge: SessionKnowledge | undefined =
          msg.knowledge && Array.isArray(msg.knowledge.items) && msg.knowledge.items.length > 0
            ? {
                items: msg.knowledge.items.slice(0, 40),
                sourceName: msg.knowledge.sourceName,
                mode: msg.knowledge.mode === "conversation" ? "conversation" : "drill",
              }
            : undefined;

        if (knowledge) {
          console.log(
            `[INIT] Knowledge batch: ${knowledge.items.length} items, mode=${knowledge.mode}` +
              (knowledge.sourceName ? `, source="${knowledge.sourceName}"` : "")
          );
        }

        session = {
          activity,
          level,
          voiceName,
          turnMode,
          knowledge,
          liveSessionReady: false,
          initialTurnSent: false,
          teacherTurnActive: false,
          turnSequence: 0,
          reconnecting: false,
          reconnectAttempts: 0,
          ended: false,
        };

        let ai: GoogleGenAI;
        try {
          ai = getGeminiClient();
        } catch (keyErr: any) {
          console.error("[INIT] API key error:", keyErr.message);
          send({ type: "error", error: keyErr.message });
          return;
        }

        await connectToGemini(ai, session, false);
      }

      else if (msg.type === "audio" && liveSession) {
        if (!session) return;
        if (!session.audioChunksReceived) session.audioChunksReceived = 0;
        session.audioChunksReceived++;
        if (session.audioChunksReceived % 50 === 1) {
          console.log(`[AUDIO] Chunk #${session.audioChunksReceived} received from client, size=${msg.data?.length || 0} chars`);
        }
        liveSession.sendRealtimeInput({ audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" } });
      }

      else if (msg.type === "text" && liveSession) {
        console.log("[TEXT] User sent text:", msg.text.slice(0, 50));
        sendText(liveSession, msg.text);
      }

      else if (msg.type === "activity_start" && liveSession) {
        liveSession.sendRealtimeInput({ activityStart: {} });
      }
      else if (msg.type === "activity_end" && liveSession) {
        liveSession.sendRealtimeInput({ activityEnd: {} });
      }
      else if (msg.type === "audio_stream_end" && liveSession) {
        liveSession.sendRealtimeInput({ audioStreamEnd: true });
      }

      else if (msg.type === "interrupt" && liveSession) {
        console.log("[INTERRUPT] Coach interrupted by user");
        if (session) {
          const id = session.currentTeacherTurnId;
          session.teacherTurnActive = false;
          session.currentTeacherTurnId = undefined;
          send({ type: "interrupted", teacherTurnId: id });
        }
      }

      else if (msg.type === "change_activity" && liveSession && session) {
        const newActivity: Activity = msg.activity || "conversazione";
        session.activity = newActivity;
        if (msg.level) session.level = msg.level;
        console.log(`[ACTIVITY] Switched to: ${newActivity}`);
        sendText(liveSession, `[ACTIVITY_SWITCH] The learner wants to switch to: ${newActivity}. ${buildStartupPrompt(newActivity, session.level)}`);
      }

      else if (msg.type === "change_level" && liveSession && session) {
        session.level = msg.level || session.level;
        console.log(`[LEVEL] Changed to: ${session.level}`);
        sendText(liveSession, `[LEVEL_CHANGE] The learner's level is now: ${session.level}. Adapt your English complexity accordingly from now on. Confirm the change briefly in Italian.`);
      }

      else if (msg.type === "retry_teacher_turn" && liveSession) {
        console.log("[RETRY] Audio retry requested");
        sendText(liveSession, "[AUDIO_RETRY] Please respond with audio now.");
      }

      else if (msg.type === "session_end") {
        console.log("[SESSION] End requested");
        if (session) session.ended = true;
        if (liveSession) {
          try { liveSession.close(); } catch (e) {}
          liveSession = null;
        }
        session = null;
      }
    } catch (e: any) {
      console.error("[WS] Message error:", e?.message || e);
    }
  });

  clientWs.on("close", () => {
    console.log("[WS] Client disconnected");
    if (liveSession) {
      try { liveSession.close(); } catch (e) {}
      liveSession = null;
    }
    session = null;
  });

  function send(data: any) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify(data));
    }
  }

  function triggerInitialTurn() {
    if (!session || session.initialTurnSent || !liveSession) return;
    session.initialTurnSent = true;
    const prompt = buildStartupPrompt(session.activity, session.level);
    console.log("[INITIAL] Sending startup prompt for:", session.activity);
    try {
      sendText(liveSession, prompt);
      console.log("[INITIAL] Startup prompt sent successfully");
    } catch (err: any) {
      console.error("[INITIAL] Startup prompt FAILED:", err?.message);
      setTimeout(() => {
        try {
          if (liveSession && clientWs.readyState === WebSocket.OPEN) {
            sendText(liveSession, prompt);
            console.log("[INITIAL] Retry succeeded");
          }
        } catch (retryErr: any) {
          console.error("[INITIAL] Retry FAILED:", retryErr?.message);
          send({ type: "error", error: "Impossibile avviare la sessione vocale." });
        }
      }, 1000);
    }
  }
});

// ── Server startup ──────────────────────────────────────────────
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Madrelingua Coach attivo su http://localhost:${PORT}`);
    console.log(`API key: ${GEMINI_API_KEY ? "configurata" : "MANCANTE"}`);
  });
}

startServer();
