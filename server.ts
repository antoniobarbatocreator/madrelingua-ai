import "dotenv/config";
import express from "express";
import path from "path";
import multer from "multer";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as pdfParseModule from "pdf-parse";
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity, ActivityHandling, LiveServerMessage, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { buildLevelInstruction } from "./src/lib/levelProfiles";
import { buildLearningModeInstruction } from "./src/lib/learningInstructions";
import { getMacroTopicOverview } from "./src/lib/topicPacks/registry";

const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "25mb" }));

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// Lazy Gemini client getter
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY non configurata nei Secret di AI Studio.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Helper to retry Gemini calls on transient 429 rate limit or 503 high demand errors
async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  initialDelayMs = 1000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const errStr = String(err?.message || err);
      const isQuotaExceeded = errStr.includes("Quota exceeded") || errStr.includes("generate_content_free_tier_requests");
      const isTransient =
        errStr.includes("429") ||
        errStr.includes("503") ||
        errStr.includes("RESOURCE_EXHAUSTED") ||
        errStr.includes("UNAVAILABLE") ||
        errStr.includes("quota") ||
        errStr.includes("high demand") ||
        errStr.includes("rate-limits");

      if (isTransient && !isQuotaExceeded && attempt <= maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[Gemini Retry] Attempt ${attempt}/${maxRetries} failed due to rate limit/high demand. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Madrelingua AI Coach" });
});

// Voice Preview Endpoint for Previewing Gemini prebuilt voices
app.post("/api/voice-preview", async (req, res) => {
  try {
    const { voiceName = "Achird", text } = req.body;
    const ai = getGeminiClient();

    const previewText = text && text.trim() ? text.trim() : `Hello there! I'm ${voiceName}, your native English conversation tutor. Let's practice speaking together!`;

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: previewText }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      })
    );

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data) {
      return res.json({
        success: true,
        audioBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
      });
    }

    return res.status(500).json({ error: "Impossibile generare l'audio di anteprima della voce." });
  } catch (error: any) {
    console.error("Errore generatore anteprima voce:", error);
    return res.status(500).json({ error: error.message || "Errore nella generazione dell'anteprima vocale." });
  }
});

// Helper functions for block splitting and deduplication in PDF processing
function splitTextIntoBlocks(text: string, blockSize = 10000, overlap = 400): string[] {
  if (text.length <= blockSize) {
    return [text];
  }
  const blocks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + blockSize;
    if (end >= text.length) {
      blocks.push(text.slice(start));
      break;
    }
    let breakPoint = text.lastIndexOf('\n', end);
    if (breakPoint < start + blockSize - 2000) {
      breakPoint = text.lastIndexOf('. ', end);
    }
    if (breakPoint <= start) {
      breakPoint = end;
    } else {
      breakPoint += 1;
    }
    blocks.push(text.slice(start, breakPoint));
    start = Math.max(start + 1, breakPoint - overlap);
  }
  return blocks;
}

interface RawExtractedChunk {
  phrase: string;
  translation: string;
  context: string;
  category?: string;
}

function normalizePhraseKey(phrase: string): string {
  return String(phrase || '')
    .toLowerCase()
    .normalize('NFKC')
    .trim()
    .replace(/[’`]/g, "'")
    .replace(/^to\s+/i, '')
    .replace(/[.,/#!$%^&*;:{}=\-_~()?"«»!@]/g, ' ')
    .replace(/(^'+|'+$)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function targetAppearsNaturally(text: string, target: string): boolean {
  const normalizedText = normalizePhraseKey(text);
  const normalizedTarget = normalizePhraseKey(target);
  if (!normalizedText || !normalizedTarget) return false;
  if ((` ${normalizedText} `).includes(` ${normalizedTarget} `)) return true;

  if (normalizedTarget.startsWith('be ')) {
    const complement = normalizedTarget.slice(3);
    const forms = [
      'am', 'is', 'are', 'was', 'were', 'been', 'being',
      "i'm", "you're", "he's", "she's", "it's", "we're", "they're",
      "isn't", "aren't", "wasn't", "weren't",
    ];
    return forms.some((form) => (` ${normalizedText} `).includes(` ${form} ${complement} `));
  }

  return false;
}

function deduplicateExtractedChunks(chunks: RawExtractedChunk[]): RawExtractedChunk[] {
  const map = new Map<string, RawExtractedChunk>();

  for (const item of chunks) {
    if (!item || !item.phrase || typeof item.phrase !== 'string' || !item.phrase.trim()) {
      continue;
    }

    const key = normalizePhraseKey(item.phrase);
    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        phrase: item.phrase.trim(),
        translation: (item.translation || '').trim(),
        context: (item.context || item.phrase).trim(),
        category: (item.category || 'Generale').trim(),
      });
    } else {
      const newScore = (item.translation || '').length + (item.context || '').length;
      const existingScore = (existing.translation || '').length + (existing.context || '').length;
      if (newScore > existingScore) {
        map.set(key, {
          phrase: item.phrase.trim(),
          translation: (item.translation || '').trim(),
          context: (item.context || item.phrase).trim(),
          category: (item.category || existing.category || 'Generale').trim(),
        });
      }
    }
  }

  return Array.from(map.values());
}

// PDF Upload & Extraction Endpoint
app.post("/api/upload-pdf", upload.single("pdfFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nessun file PDF caricato." });
    }

    console.log(`FILE PDF CARICATO: ${req.file.originalname} (${req.file.size} byte)`);

    let extractedText = "";
    try {
      const pdfData = await pdfParse(req.file.buffer);
      extractedText = pdfData.text || "";
    } catch (parseErr) {
      console.error("Errore durante il parsing del PDF con pdf-parse:", parseErr);
      extractedText = req.file.buffer.toString("utf-8");
    }

    extractedText = extractedText.replace(/\s+/g, " ").trim();

    if (!extractedText) {
      extractedText = "Nessun testo leggibile estratto dal PDF.";
    }

    let rawChunks: RawExtractedChunk[] = [];
    const textBlocks = splitTextIntoBlocks(extractedText, 10000, 400);
    console.log(`PDF diviso in ${textBlocks.length} blocco/i di elaborazione.`);

    const ai = getGeminiClient();

    for (let i = 0; i < Math.min(textBlocks.length, 10); i++) {
      const block = textBlocks[i];
      try {
        const prompt = `Analizza il seguente blocco di testo estratto da appunti/dispense di inglese per un apprendente italiano.
Estrai TUTTE le espressioni utili, vocaboli chiave, phrasal verbs, collocazioni, idiomi o strutture grammaticali inglesi presenti nel testo.
Per ciascun elemento identificato, fornisci:
- phrase: l'espressione o parola in inglese (forma base/canonica)
- translation: traduzione o spiegazione accurata in italiano in base al contesto
- context: una frase di esempio chiara ed efficace in inglese che mostra l'uso dell'espressione
- category: la categoria di appartenenza (es. Viaggi, Lavoro, Vita Quotidiana, Cibo, Grammatica, Idiomi)

Estrai quanti più elementi utili reali trovi nel testo, senza tralasciare nulla di rilevante. Se un elemento appare con la sua traduzione nel testo, estrailo con precisione.

Blocco di Testo PDF (${i + 1}/${textBlocks.length}):
${block}`;

        const aiRes = await callGeminiWithRetry(() =>
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
                  required: ["phrase", "translation", "context"],
                },
              },
            },
          })
        );

        if (aiRes.text) {
          const parsed = JSON.parse(aiRes.text);
          if (Array.isArray(parsed)) {
            rawChunks.push(...parsed);
          }
        }
      } catch (blockErr) {
        console.warn(`Estrazione fallita per il blocco ${i + 1}:`, blockErr);
      }
    }

    const deduplicatedChunks = deduplicateExtractedChunks(rawChunks);
    const indexedItemCount = deduplicatedChunks.length;

    const documentData = {
      id: `doc-${Date.now()}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploadedAt: new Date().toISOString(),
      extractedText: extractedText.substring(0, 20000),
      vocabularyCount: indexedItemCount, // ALWAYS synchronized with extractedChunks.length!
      indexedItemCount: indexedItemCount,
      indexingStatus: "ready" as const,
      sourceItemEstimate: indexedItemCount,
      extractedChunks: deduplicatedChunks.map((chunk, index) => ({
        id: `chunk-up-${Date.now()}-${index}`,
        phrase: chunk.phrase,
        translation: chunk.translation,
        context: chunk.context || chunk.phrase,
        category: chunk.category || "Caricato da PDF",
      })),
    };

    return res.json({ success: true, document: documentData });
  } catch (error: any) {
    console.error("Errore endpoint upload-pdf:", error);
    return res.status(500).json({ error: error.message || "Errore nel caricamento del file PDF." });
  }
});

// Helper function for tolerant parsing of vocabulary analysis responses
function parseVocabularyAnalysisResponse(rawText: string, fallbackSelection: string, fallbackSentence: string) {
  if (!rawText || typeof rawText !== "string") return null;

  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    const obj = JSON.parse(cleaned);
    const validTypes = ["word", "chunk", "phrasal_verb", "idiom", "collocation", "expression"];
    const type = validTypes.includes(obj.type) ? obj.type : "expression";
    const recommendedExpression = obj.recommendedExpression || obj.lemma || fallbackSelection;

    const alternatives = Array.isArray(obj.alternativeSelections) && obj.alternativeSelections.length > 0
      ? obj.alternativeSelections
      : [
          { text: fallbackSelection, type: "word" },
          ...(recommendedExpression !== fallbackSelection ? [{ text: recommendedExpression, type }] : [])
        ];

    return {
      selectedText: obj.selectedText || fallbackSelection,
      recommendedExpression,
      alternativeSelections: alternatives,
      lemma: obj.lemma || recommendedExpression,
      type,
      translationIt: obj.translationIt || "Traduzione contestuale non disponibile",
      contextualMeaningIt: obj.contextualMeaningIt || "",
      pronunciationIpa: obj.pronunciationIpa || null,
      originalSentence: obj.originalSentence || fallbackSentence,
      exampleEnglish: obj.exampleEnglish || null,
      exampleItalian: obj.exampleItalian || null,
      cefrEstimate: obj.cefrEstimate || null,
      tags: Array.isArray(obj.tags) ? obj.tags : [],
      confidence: typeof obj.confidence === "number" ? obj.confidence : 0.9,
    };
  } catch (e) {
    console.error("JSON parse error in parseVocabularyAnalysisResponse:", e, "Raw text:", rawText);
    return null;
  }
}

// Contextual Vocabulary Analysis Endpoint
app.post("/api/vocabulary/analyze", async (req, res) => {
  try {
    const { selectedText, fullSentence, surroundingText, cefrLevel = "B1_B2", interfaceLanguage = "it" } = req.body;

    if (!selectedText || typeof selectedText !== "string" || !selectedText.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Parola selezionata obbligatoria.",
          retryable: false
        }
      });
    }

    if (!fullSentence || typeof fullSentence !== "string" || !fullSentence.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Frase completa obbligatoria.",
          retryable: false
        }
      });
    }

    const trimmedSelection = selectedText.trim().slice(0, 100);
    const trimmedSentence = fullSentence.trim().slice(0, 3000);

    const ai = getGeminiClient();
    const prompt = `You analyse English words and multi-word expressions for an Italian learner.

Selected Text: "${trimmedSelection}"
Full Sentence: "${trimmedSentence}"
Learner CEFR Level: ${cefrLevel}

Use the exact context supplied.
The context may contain Italian and English.
Identify whether the selected token belongs to a phrasal verb, chunk, collocation, idiom or fixed expression in this sentence.
Prefer the complete useful expression when appropriate (e.g. if selection is "look" in "look it up", recommendedExpression is "look up").
Do not include surrounding Italian words in the English expression.
Return only valid JSON matching this schema:
{
  "selectedText": "${trimmedSelection}",
  "recommendedExpression": "the base canonical expression or phrasal verb",
  "alternativeSelections": [
    { "text": "${trimmedSelection}", "type": "word" },
    { "text": "recommendedExpression", "type": "phrasal_verb" }
  ],
  "lemma": "canonical base form",
  "type": "word | chunk | phrasal_verb | idiom | collocation | expression",
  "translationIt": "accurate Italian translation in context",
  "contextualMeaningIt": "concise Italian explanation of nuance in context",
  "pronunciationIpa": "IPA string or null",
  "originalSentence": "${trimmedSentence}",
  "exampleEnglish": "a simple clear new example sentence in English",
  "exampleItalian": "Italian translation of example sentence",
  "cefrEstimate": "A1 | A2 | B1 | B2 | C1",
  "tags": ["tag1", "tag2"],
  "confidence": 0.95
}

Return only valid JSON. Do not use markdown code fences. Do not invent IPA (return null if uncertain). Keep Italian explanations concise and natural.`;

    let aiRes;
    try {
      aiRes = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        })
      );
    } catch (firstErr: any) {
      console.warn("[Vocab Analyze] First attempt failed, attempting simplified retry...", firstErr?.message);
      const simplifiedPrompt = `Return JSON analysis for English expression "${trimmedSelection}" in sentence "${trimmedSentence}" for Italian learner.
JSON format:
{
  "recommendedExpression": "${trimmedSelection}",
  "type": "word",
  "translationIt": "Italian translation",
  "contextualMeaningIt": "Italian explanation",
  "originalSentence": "${trimmedSentence}",
  "exampleEnglish": "Example sentence",
  "exampleItalian": "Traduzione esempio"
}`;
      aiRes = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: simplifiedPrompt,
        })
      );
    }

    const rawText = aiRes?.text || "";
    const parsedData = parseVocabularyAnalysisResponse(rawText, trimmedSelection, trimmedSentence);

    if (!parsedData) {
      return res.status(500).json({
        ok: false,
        error: {
          code: "INVALID_MODEL_JSON",
          message: "La risposta del modello non contiene un JSON valido.",
          retryable: true
        }
      });
    }

    return res.json({
      ok: true,
      data: parsedData
    });
  } catch (error: any) {
    console.error("Vocabulary analysis endpoint error:", error);
    return res.status(500).json({
      ok: false,
      error: {
        code: "MODEL_ERROR",
        message: error.message || "Non sono riuscito ad analizzare questa espressione.",
        retryable: true
      }
    });
  }
});

// Custom Topic Vocabulary Generation Endpoint
app.post("/api/vocabulary/generate-custom-topic", async (req, res) => {
  try {
    const { topic, cefrLevel = "B1_B2", targetCount = 3, excludedExpressions = [] } = req.body;
    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({ ok: false, error: "Argomento mancante" });
    }

    const cleanTopic = topic.trim();
    const ai = getGeminiClient();

    const prompt = `Sei un docente di inglese esperto per studenti italiani.
Genera ${targetCount} target lessicali utili in inglese per un apprendente di livello ${cefrLevel} relativi all'argomento: "${cleanTopic}".

PRIORITÀ OBBLIGATORIA:
1. parole individuali e verbi utili;
2. phrasal verbs;
3. collocations;
4. chunks ed espressioni brevi e naturali;
5. idiomi frequenti, solo se davvero pertinenti.

Non generare normali frasi complete da memorizzare o domande come target. Una formula completa è ammessa soltanto se funziona come un'unica breve espressione comunicativa. Non includere punteggiatura finale nel campo expression.

ESCLUSIONS RIGIDE (NON usare nessuna di queste espressioni né loro forme base):
${Array.isArray(excludedExpressions) ? excludedExpressions.slice(0, 100).join(", ") : ""}

Per ciascun elemento, fornisci:
- expression: il singolo target in inglese;
- meaning: traduzione/spiegazione chiara in italiano;
- usage: quando e come si usa in contesto;
- example: una sola frase di esempio naturale in inglese;
- type: 'word' | 'phrasal_verb' | 'collocation' | 'chunk' | 'idiom'.

Restituisci un array JSON valido con gli elementi generati.`;

    const aiRes = await callGeminiWithRetry(() =>
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
                expression: { type: Type.STRING },
                meaning: { type: Type.STRING },
                usage: { type: Type.STRING },
                example: { type: Type.STRING },
                type: { type: Type.STRING },
              },
              required: ["expression", "meaning", "usage", "example"],
            },
          },
        },
      })
    );

    let items: any[] = [];
    if (aiRes.text) {
      const parsed = JSON.parse(aiRes.text);
      items = Array.isArray(parsed) ? parsed : [];
    }

    // Server-side hard barrier. The browser validates again before assigning
    // currentItem, so Material exclusions are enforced independently twice.
    const excludedKeys = new Set(
      (Array.isArray(excludedExpressions) ? excludedExpressions : [])
        .filter((value: unknown) => typeof value === "string")
        .map((value: string) => normalizePhraseKey(value))
        .filter(Boolean)
    );
    const seenKeys = new Set<string>();
    const allowedTargetTypes = new Set(["word", "phrasal_verb", "collocation", "chunk", "idiom"]);
    const safeItems = items.filter((item: any) => {
      const expression = String(item?.expression || "").trim();
      const key = normalizePhraseKey(expression);
      const type = String(item?.type || "chunk").toLowerCase();
      const wordCount = expression.split(/\s+/).filter(Boolean).length;
      const looksLikeSentence = /[.!?]$/.test(expression) || wordCount > 9;
      if (!key || excludedKeys.has(key) || seenKeys.has(key)) return false;
      if (!allowedTargetTypes.has(type) || looksLikeSentence) return false;
      if (!String(item?.meaning || "").trim() || !String(item?.example || "").trim()) return false;
      seenKeys.add(key);
      item.type = type;
      return true;
    }).slice(0, Math.max(1, Math.min(10, Number(targetCount) || 3)));

    return res.json({ ok: true, topic: cleanTopic, items: safeItems });
  } catch (err: any) {
    console.error("Errore generazione custom topic:", err);
    return res.status(500).json({ ok: false, error: err.message || "Errore durante la generazione dell'argomento." });
  }
});


// Deterministic Vocabulary Exercise Generation Endpoint
app.post("/api/vocabulary/create-exercise", async (req, res) => {
  try {
    const { currentItem, attemptNumber = 1, cefrLevel = "B1_B2", previousSentence = "" } = req.body || {};
    const expression = String(currentItem?.expression || currentItem?.english || "").trim();
    const meaning = String(currentItem?.meaning || currentItem?.italian || "").trim();
    if (!expression || !currentItem?.id) {
      return res.status(400).json({ ok: false, error: "Elemento target mancante." });
    }

    const ai = getGeminiClient();
    const prompt = `Create one controlled Italian-to-English translation exercise for an Italian learner.
CEFR level: ${cefrLevel}
Mandatory English target: "${expression}"
Italian meaning: "${meaning}"
Usage: "${String(currentItem?.usage || "")}"
Natural English example: "${String(currentItem?.example || "")}"
Attempt number: ${Number(attemptNumber) || 1}
Previous Italian sentence that MUST NOT be repeated: "${String(previousSentence || "")}"

Return one realistic everyday Italian sentence whose most natural English translation requires the target expression in a grammatically correct form.
Do not use metalinguistic wording such as "usa questa parola", "devo usare" or "frase relativa".
The expected English translation must be complete, natural and contain the target expression or its necessary grammatical form, for example am/is/are for a target beginning with be.
Return only JSON.`;

    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            italianSentence: { type: Type.STRING },
            expectedEnglish: { type: Type.STRING },
            acceptedAlternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["italianSentence", "expectedEnglish"],
        },
      },
    }));

    const parsed = JSON.parse(response.text || "{}");
    const italianSentence = String(parsed.italianSentence || "").trim();
    const expectedEnglish = String(parsed.expectedEnglish || "").trim();
    const normalizedTarget = normalizePhraseKey(expression);
    if (
      italianSentence.length < 8 || expectedEnglish.length < 8 ||
      normalizePhraseKey(italianSentence) === normalizePhraseKey(String(previousSentence || "")) ||
      !targetAppearsNaturally(expectedEnglish, normalizedTarget)
    ) {
      return res.status(422).json({ ok: false, error: "Esercizio generato non valido." });
    }

    return res.json({
      ok: true,
      exercise: {
        id: `exercise_${currentItem.id}_${Date.now()}`,
        italianSentence,
        expectedEnglish,
        acceptedAlternatives: Array.isArray(parsed.acceptedAlternatives)
          ? parsed.acceptedAlternatives.filter((value: unknown) => typeof value === "string")
          : [],
        targetItemId: currentItem.id,
        attemptNumber: Math.max(1, Number(attemptNumber) || 1),
        answerWasRevealed: false,
        createdAt: Date.now(),
      },
    });
  } catch (error: any) {
    console.warn("Controlled exercise generation failed:", error?.message || error);
    return res.status(500).json({ ok: false, error: error?.message || "Generazione esercizio non riuscita." });
  }
});

// Structured Translation Evaluation Endpoint
app.post("/api/vocabulary/evaluate-translation", async (req, res) => {
  try {
    const { userAnswer, currentItem, assignedTranslationExercise, cefrLevel = "B1_B2" } = req.body || {};
    const target = String(currentItem?.expression || currentItem?.english || "").trim();
    const answer = String(userAnswer || "").trim();
    const italianSentence = String(assignedTranslationExercise?.italianSentence || "").trim();
    const expectedEnglish = String(assignedTranslationExercise?.expectedEnglish || "").trim();
    if (!target || !answer || !italianSentence || !expectedEnglish) {
      return res.status(400).json({ ok: false, error: "Dati di valutazione incompleti." });
    }

    const ai = getGeminiClient();
    const prompt = `Evaluate one Italian-to-English translation attempt.
Learner CEFR: ${cefrLevel}
Italian sentence assigned: "${italianSentence}"
Expected natural translation: "${expectedEnglish}"
Canonical target expression: "${target}"
Learner answer: "${answer}"

A correct answer must express the assigned meaning, use the target correctly in a grammatical form and be a coherent sentence.
Do not mark it correct merely because it contains the target substring.
Give a score from 4 to 10 and a concise Italian explanation. Return only JSON.`;

    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correct: { type: Type.BOOLEAN },
            score: { type: Type.INTEGER },
            correctedEnglish: { type: Type.STRING },
            explanationItalian: { type: Type.STRING },
            targetUsedCorrectly: { type: Type.BOOLEAN },
          },
          required: ["correct", "score", "correctedEnglish", "explanationItalian", "targetUsedCorrectly"],
        },
      },
    }));
    const parsed = JSON.parse(response.text || "{}");
    const answerWasRevealed = Boolean(assignedTranslationExercise?.answerWasRevealed);
    return res.json({
      ok: true,
      assessment: {
        correct: Boolean(parsed.correct),
        score: Math.max(4, Math.min(10, Number(parsed.score) || 4)),
        correctedEnglish: String(parsed.correctedEnglish || expectedEnglish),
        explanationItalian: String(parsed.explanationItalian || "Valutazione completata."),
        targetUsedCorrectly: Boolean(parsed.targetUsedCorrectly),
        independentlyProduced: Boolean(parsed.correct) && !answerWasRevealed,
      },
    });
  } catch (error: any) {
    console.warn("Structured translation evaluation failed:", error?.message || error);
    return res.status(500).json({ ok: false, error: error?.message || "Valutazione non riuscita." });
  }
});

// Silent State Evaluator Endpoint
app.post("/api/learning-state/update", async (req, res) => {
  try {
    const {
      currentRuntimeState,
      learningMode = "free_conversation",
      latestUserMessage,
      latestAssistantMessage,
      currentItem,
      cefrLevel = "B1_B2",
    } = req.body;

    if (!currentRuntimeState) {
      return res.status(400).json({ error: "State mancante" });
    }

    const ai = getGeminiClient();

    const evaluationPrompt = `Analizza la seguente interazione tra l'apprendente e il coach d'inglese.
Modalità Didattica: ${learningMode}
Livello CEFR: ${cefrLevel}
Elemento Corrente Target: ${JSON.stringify(currentItem || {})}
Messaggio Utente: "${latestUserMessage || ''}"
Risposta Coach: "${latestAssistantMessage || ''}"

Valuta e aggiorna lo stato pedagogico strutturato:
1. userStopRequested: boolean (true se l'utente ha pronunciato un comando esplicito di arresto o pausa come "stop", "terminiamo", "basta", "cambia attività", "mettiamo in pausa", "pausa")
2. answerAssessment:
   - correct: boolean (se la risposta dell'utente è corretta o comprensibile)
   - score: numero intero da 4 a 10 (10=perfetto/naturale, 9=piccola imperfezione, 8=corretto ma poco naturale, 7=comprensibile con un errore, 6=diversi errori ma significato chiaro, 5=parzialmente chiaro, 4=errore grave/non pertinente). Mai sotto 4.
   - neededHint: boolean (se l'utente ha avuto bisogno di un indizio per rispondere)
3. currentItemCompleted: boolean (se l'elemento o esercizio corrente si può considerare completato con successo)
4. currentPhase: stringa descrittiva della fase attuale (es. "presentation", "explanation", "comprehension", "production", "correction", "application", "retrieval", "active_recall", "conversation")
5. waitingFor: cosa si aspetta dal prossimo turno dell'utente ("none", "english_word", "italian_meaning", "sentence_translation", "spoken_answer", "multiple_choice", "confirmation")
6. recentError: se l'utente ha commesso un errore rilevante, estrailo come oggetto { original, correction, explanation, category }. Altrimenti null.
7. introducedVocabularyItem: se il coach ha introdotto una nuova espressione o vocabolo utile, estraila come oggetto { english, italian, type, example }. Altrimenti null.`;

    const evalRes = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: evaluationPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              userStopRequested: { type: Type.BOOLEAN },
              currentPhase: { type: Type.STRING },
              waitingFor: { type: Type.STRING },
              answerAssessment: {
                type: Type.OBJECT,
                properties: {
                  correct: { type: Type.BOOLEAN },
                  score: { type: Type.INTEGER },
                  neededHint: { type: Type.BOOLEAN },
                },
                required: ["correct", "score"],
              },
              currentItemCompleted: { type: Type.BOOLEAN },
              recentError: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  correction: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  category: { type: Type.STRING },
                },
              },
              introducedVocabularyItem: {
                type: Type.OBJECT,
                properties: {
                  english: { type: Type.STRING },
                  italian: { type: Type.STRING },
                  type: { type: Type.STRING },
                  example: { type: Type.STRING },
                },
              },
            },
            required: ["currentPhase", "waitingFor", "answerAssessment", "currentItemCompleted"],
          },
        },
      })
    );

    const evalData = JSON.parse(evalRes.text || "{}");

    // Construct updated state while keeping invariant fields intact
    const updatedState = { ...currentRuntimeState };

    if (evalData.userStopRequested) {
      updatedState.exerciseStatus = 'stopped';
      updatedState.activityStatus = 'paused';
    } else {
      updatedState.exerciseStatus = 'active';
      if (updatedState.activityStatus === 'not_started' || updatedState.activityStatus === 'introducing') {
        updatedState.activityStatus = 'waiting_for_user';
      }
    }

    if (evalData.currentPhase) updatedState.currentPhase = evalData.currentPhase;
    if (evalData.waitingFor) updatedState.waitingFor = evalData.waitingFor;

    if (evalData.answerAssessment) {
      updatedState.lastScore = evalData.answerAssessment.score;
    }

    // Handle learning_games runtime state update
    if (learningMode === 'learning_games' || updatedState.learningMode === 'learning_games') {
      const existingGame = updatedState.gameRuntimeState || {
        schemaVersion: 1,
        appSessionId: updatedState.appSessionId || "session",
        learningMode: "learning_games",
        gameType: updatedState.gameType || "quick_translation",
        status: "waiting_for_user",
        roundNumber: 1,
        targetRounds: 5,
        source: updatedState.gameContentSource || "free_topic",
        score: 0,
        correctAnswers: 0,
        partiallyCorrectAnswers: 0,
        incorrectAnswers: 0,
        currentDifficulty: "medium",
        usedItemIds: [],
        recentMistakes: [],
        updatedAt: new Date().toISOString(),
      };

      if (evalData.answerAssessment) {
        if (evalData.answerAssessment.score >= 8) {
          existingGame.score += 2;
          existingGame.correctAnswers += 1;
        } else if (evalData.answerAssessment.score >= 6) {
          existingGame.score += 1;
          existingGame.partiallyCorrectAnswers += 1;
        } else {
          existingGame.incorrectAnswers += 1;
        }
      }

      if (evalData.currentItemCompleted) {
        existingGame.roundNumber += 1;
      }

      // Do NOT set game status to "completed" automatically - exercise stays active until user stops
      if (evalData.userStopRequested) {
        existingGame.status = "paused";
      } else {
        existingGame.status = "waiting_for_user";
      }

      existingGame.updatedAt = new Date().toISOString();
      updatedState.gameRuntimeState = existingGame;
      updatedState.gameType = existingGame.gameType;
    }

    if (evalData.currentItemCompleted) {
      updatedState.completedItemCount = (updatedState.completedItemCount || 0) + 1;
      if (currentItem && currentItem.english) {
        if (!updatedState.completedItemIds.includes(currentItem.english)) {
          updatedState.completedItemIds.push(currentItem.english);
        }
      }
    }

    if (evalData.recentError && evalData.recentError.original) {
      updatedState.recentErrors = [
        ...(updatedState.recentErrors || []),
        evalData.recentError,
      ].slice(-10);
    }

    if (evalData.introducedVocabularyItem && evalData.introducedVocabularyItem.english) {
      const exists = (updatedState.sessionVocabulary || []).some(
        (v: any) => v.english.toLowerCase() === evalData.introducedVocabularyItem.english.toLowerCase()
      );
      if (!exists) {
        updatedState.sessionVocabulary = [
          ...(updatedState.sessionVocabulary || []),
          {
            id: `session-vocab-${Date.now()}`,
            ...evalData.introducedVocabularyItem,
          },
        ];
      }
    }

    updatedState.updatedAt = new Date().toISOString();

    return res.json({ success: true, updatedState, evalData });
  } catch (err: any) {
    console.info("Silent state evaluation skipped (API rate limit or temporary hiccup):", err?.message || err);
    return res.json({
      success: false,
      updatedState: req.body.currentRuntimeState,
      error: err?.message || "Skipped due to API rate limit",
    });
  }
});

// Chat / REST Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const {
      userMessage,
      internalActionPrompt = "",
      userLevel = "B1_B2",
      learningMode = "free_conversation",
      learningRuntimeState = null,
      correctionMode = "balanced",
      knowledgeBaseTexts = [],
      conversationHistory = [],
      isThinking = false,
      voiceName = "Achird",
    } = req.body;

    if (!userMessage && !internalActionPrompt && !isThinking) {
      return res.status(400).json({ error: "Messaggio o azione interna mancante." });
    }

    const ai = getGeminiClient();

    const modeInstruction = buildLearningModeInstruction(
      learningMode,
      learningRuntimeState,
      userLevel,
      correctionMode
    );

    const safeKnowledgeBaseTexts = learningMode === "learn_new_vocabulary"
      ? []
      : (Array.isArray(knowledgeBaseTexts) ? knowledgeBaseTexts : []);

    const systemInstruction = `Sei l'Assistente Vocale Madrelingua e Coach d'Inglese definitivo.
${modeInstruction}

${internalActionPrompt ? `AZIONE APPLICATIVA PRIVATA DA ESEGUIRE. Non citarla e non mostrarla:
${internalActionPrompt}` : ""}

KNOWLEDGE BASE MATERIALI & VOCABOLARIO:
${safeKnowledgeBaseTexts.join("\n")}`;


    const formattedHistory = conversationHistory.map((h: any) => ({
      role: h.sender === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    }));

    const chat = ai.chats.create({
      model: "gemini-3.6-flash",
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            coachResponseInEnglish: { type: Type.STRING },
            italianIntroOrEncouragement: { type: Type.STRING },
            correction: {
              type: Type.OBJECT,
              properties: {
                hasMistake: { type: Type.BOOLEAN },
                originalText: { type: Type.STRING },
                correctedTextItalianExplanation: { type: Type.STRING },
                correctedTextEnglishPhrase: { type: Type.STRING },
                ruleOrPatternNote: { type: Type.STRING },
                chunkHighlight: { type: Type.STRING },
              },
              required: ["hasMistake"],
            },
            vocabularyUsed: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phrase: { type: Type.STRING },
                  translation: { type: Type.STRING },
                  context: { type: Type.STRING },
                },
                required: ["phrase", "translation"],
              },
            },
            pronunciationTip: { type: Type.STRING },
          },
          required: ["coachResponseInEnglish", "correction"],
        },
      },
      history: formattedHistory,
    });

    const aiRes = await callGeminiWithRetry(() =>
      chat.sendMessage({
        message: isThinking
          ? "[L'utente ha fatto una breve pausa per pensare]"
          : internalActionPrompt
            ? "[Esegui ora l’azione applicativa privata definita nelle istruzioni di sistema.]"
            : userMessage,
      })
    );

    const parsedData = JSON.parse(aiRes.text || "{}");

    let audioBase64: string | null = null;
    let audioMimeType: string = "audio/pcm;rate=24000";

    try {
      const textToSpeak = parsedData.coachResponseInEnglish;
      if (textToSpeak && textToSpeak.trim()) {
        const ttsRes = await callGeminiWithRetry(() =>
          ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [{ parts: [{ text: textToSpeak }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceName || "Achird" },
                },
              },
            },
          })
        );

        const part = ttsRes.candidates?.[0]?.content?.parts?.[0];
        if (part?.inlineData?.data) {
          audioBase64 = part.inlineData.data;
          if (part.inlineData.mimeType) {
            audioMimeType = part.inlineData.mimeType;
          }
        }
      }
    } catch (ttsErr: any) {
      console.warn("Gemini TTS audio note:", ttsErr?.message || ttsErr);
    }

    return res.json({
      success: true,
      data: parsedData,
      audioBase64,
      audioMimeType,
    });
  } catch (error: any) {
    console.error("Errore endpoint chat:", error);
    return res.status(500).json({ error: error.message || "Errore nella comunicazione con il Coach AI." });
  }
});

// Endpoint per la classificazione deterministica dell'intento vocale dell'attività
app.post("/api/activity-route", async (req, res) => {
  try {
    const { text, currentMode } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ intent: "unknown", confidence: 0 });
    }

    const ai = getGeminiClient();
    const prompt = `Sei un classificatore di intenti per un'app di apprendimento dell'inglese per utenti italiani.
Analizza la frase pronunciata dall'utente e determina quale attività desidera svolgere.

Le quattro attività disponibili sono:
1. 'free_conversation' (conversazione libera, parlare liberamente in inglese)
2. 'knowledge_review' (ripassare le proprie parole salvate, materiale personale, vocaboli)
3. 'learn_new_vocabulary' (imparare nuove parole ed espressioni, esplorare un nuovo argomento o topic pack)
4. 'learning_games' (fare un gioco linguistico, quiz, sfide)

Altre azioni possibili:
- 'change_activity' (l'utente dice "cambia attività", "cambiamo esercizio", "voglio fare qualcos'altro", "basta questo")
- 'stop' (l'utente dice "stop", "pausa", "terminiamo", "basta")
- 'unknown' (la frase non indica chiaramente un cambio o una scelta di attività)

Input utente: "${text}"
Modalità attuale: "${currentMode || 'free_conversation'}"

Rispondi rigorosamente ed ESCLUSIVAMENTE in formato JSON con la seguente struttura:
{
  "intent": "free_conversation" | "knowledge_review" | "learn_new_vocabulary" | "learning_games" | "change_activity" | "stop" | "unknown",
  "confidence": 0.95,
  "reason": "Spiegazione breve"
}`;

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      })
    );

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.warn("Errore /api/activity-route fallback unknown:", err?.message);
    return res.json({ intent: "unknown", confidence: 0, reason: err?.message });
  }
});

// Endpoint per la generazione dinamica di vocaboli da Topic Pack
app.post("/api/topic-vocabulary/generate", async (req, res) => {
  try {
    const {
      packId,
      moduleId,
      competencyAreaId,
      cefrLevel = "B1",
      targetCount = 3,
      existingExpressions = [],
      excludedExpressions = []
    } = req.body;

    const allExclusions = Array.from(new Set([...existingExpressions, ...excludedExpressions]));

    const ai = getGeminiClient();
    const prompt = `Genera esattamente ${targetCount} nuovi elementi di vocabolario target (parole, chunk, phrasal verbs o espressioni utili) in inglese per un docente di inglese.
Livello CEFR target: ${cefrLevel}.
Topic Pack: ${packId || "generale"}, Modulo: ${moduleId || "generale"}, Area di Competenza: ${competencyAreaId || "generale"}.

IMPORTANTE: NON includere nessuna delle seguenti espressioni escluse/già note all'utente:
${JSON.stringify(allExclusions)}

Fornisci la risposta ESCLUSIVAMENTE in formato JSON come array di oggetti con questo schema:
[
  {
    "id": "gen_item_1",
    "expression": "Espressione in inglese",
    "meaningIt": "Traduzione/significato in italiano",
    "usageIt": "Nota d'uso breve in italiano",
    "exampleEnglish": "Frase di esempio in inglese",
    "type": "word|chunk|phrasal_verb|collocation|idiom|grammar_pattern",
    "difficulty": "${cefrLevel}"
  }
]`;

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      })
    );

    const items = JSON.parse(response.text || "[]");
    return res.json({ success: true, items: Array.isArray(items) ? items : [] });
  } catch (err: any) {
    console.error("Errore /api/topic-vocabulary/generate:", err);
    return res.status(500).json({ success: false, items: [], error: err?.message });
  }
});

// Create HTTP and WebSocket Server
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/api/live-ws" });

  interface ServerSessionData {
  appSessionId: string;
  sessionStartReason?: string;
  resumptionHandle?: string;
  initialCoachTurnSent?: boolean;
  liveSessionReady?: boolean;
  startupTurnPending?: boolean;
  customStartupPrompt?: string;
  learningMode?: string;
  learningRuntimeState?: any;
  lastUpdated: number;
  currentTransitionId?: number;
  deferInitialCoachTurn?: boolean;
  teacherTurnStarted?: boolean;
  interruptedTeacherTurnId?: string;
  teacherTurnSequence?: number;
  currentTeacherTurnId?: string;
  currentTeacherTransitionId?: number;
  lastTeacherPrompt?: string;
  level?: string;
  correctionMode?: string;
  topic?: string;
  knowledgeText?: string;
  turnMode?: string;
}
const serverSessions = new Map<string, ServerSessionData>();

function executeInitialCoachTurn(liveSession: any, clientWs: WebSocket, sessionObj: ServerSessionData, customPrompt?: string) {
  if (sessionObj.initialCoachTurnSent || !liveSession) return;
  if (sessionObj.sessionStartReason === 'technical_reconnect') {
    sessionObj.initialCoachTurnSent = true;
    sessionObj.startupTurnPending = false;
    return;
  }
  sessionObj.initialCoachTurnSent = true;
  sessionObj.startupTurnPending = false;

  if (clientWs.readyState === WebSocket.OPEN) {
    clientWs.send(
      JSON.stringify({
        type: "initial_coach_turn_accepted",
        appSessionId: sessionObj.appSessionId,
        transitionId: sessionObj.currentTransitionId,
      })
    );
  }

  let startupPrompt = customPrompt || sessionObj.customStartupPrompt;
  const isFreshSession = sessionObj.sessionStartReason === 'fresh_session';
  const isActivitySelection = sessionObj.learningMode === 'activity_selection';

  if (!startupPrompt) {
    if (isFreshSession || isActivitySelection) {
      startupPrompt = "This is a brand-new activity-selection opening. Speak only in Italian. Ignore and do not mention any previous conversation, saved phrases, Materials, travel, business, meetings or role-play. Say exactly this sentence and nothing else: \"Ciao! Sono il tuo assistente madrelingua per l’inglese. Oggi possiamo fare una conversazione libera, ripassare le tue parole, imparare nuove parole ed espressioni oppure fare un gioco linguistico. Cosa scegli?\" Do not paraphrase it and do not ask any other question.";
    } else {
      const mode = sessionObj.learningMode || "activity_selection";
      if (mode === "activity_selection") {
        startupPrompt = "This is a brand-new activity-selection opening. Speak only in Italian. Ignore and do not mention any previous conversation, saved phrases, Materials, travel, business, meetings or role-play. Say exactly this sentence and nothing else: \"Ciao! Sono il tuo assistente madrelingua per l’inglese. Oggi possiamo fare una conversazione libera, ripassare le tue parole, imparare nuove parole ed espressioni oppure fare un gioco linguistico. Cosa scegli?\" Do not paraphrase it and do not ask any other question.";
      } else if (mode === "knowledge_review") {
        startupPrompt = "Conferma brevemente che inizierete il ripasso delle sue parole e presenta il primo elemento senza chiedere nuovamente quale attività vuole fare.";
      } else if (mode === "learn_new_vocabulary") {
        if (sessionObj.learningRuntimeState?.activeModuleId || sessionObj.learningRuntimeState?.currentItem) {
          startupPrompt = "Inizia immediatamente la micro-lezione dal primo elemento selezionato. Non ripresentare il menu e non chiedere di cosa vuole parlare.";
        } else {
          startupPrompt = getMacroTopicOverview().formattedPromptPanorama;
        }
      } else if (mode === "learning_games") {
        startupPrompt = "Conferma che farete un gioco linguistico e presenta la prima sfida.";
      } else {
        startupPrompt = "Saluta in inglese o italiano in modo informale e inizia la conversazione libera con una domanda aperta in inglese per rompere il ghiaccio.";
      }
    }
  }

  sessionObj.lastTeacherPrompt = startupPrompt || '';
  console.log(`[Dev Diag] Triggering initial coach turn via sendRealtimeInput for session ${sessionObj.appSessionId}`);

  const sendStartupPrompt = () => {
    liveSession.sendRealtimeInput({
      text: startupPrompt,
    });
  };

  try {
    // Gemini 3.1 Live accepts conversational text through realtime input.
    // sendClientContent is reserved for seeding initial history and can leave
    // a fresh voice session waiting forever without producing a teacher turn.
    sendStartupPrompt();
  } catch (stErr: any) {
    console.warn("First attempt of initial coach turn trigger failed, retrying in 500ms:", stErr?.message);
    setTimeout(() => {
      try {
        if (liveSession && clientWs.readyState === WebSocket.OPEN) {
          sendStartupPrompt();
        }
      } catch (retryErr) {
        console.error("Second attempt of initial coach turn trigger failed:", retryErr);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({
            type: "initial_coach_turn_failed",
            error: retryErr instanceof Error ? retryErr.message : "Startup turn failed",
          }));
        }
      }
    }, 500);
  }
}

wss.on("connection", (clientWs: WebSocket) => {
  console.log("⚡ Client connesso a Gemini Live WebSocket");
  let liveSession: any = null;
  let currentAppSessionId: string | null = null;

  clientWs.on("message", async (rawMessage: Buffer) => {
    try {
      const msg = JSON.parse(rawMessage.toString());

      if (msg.type === "init") {
        const {
          appSessionId = "default_session",
          sessionStartReason = "fresh_session",
          resumptionHandle: clientRequestedHandle,
          recentHistory,
          voiceName = "Achird",
          level = "Intermediate",
          topic = "General conversation",
          learningMode = "activity_selection",
          learningRuntimeState = null,
          correctionMode = "balanced",
          knowledgeText,
          turnMode = "automatic",
          pauseToleranceSeconds = 5,
          forceFreshModelContext = false,
          deferInitialCoachTurn = false,
          transitionId = 0,
          initialActionPrompt,
        } = msg;

        currentAppSessionId = appSessionId;
        let existingSession = serverSessions.get(appSessionId);
        if (!existingSession) {
          existingSession = { appSessionId, lastUpdated: Date.now() };
          serverSessions.set(appSessionId, existingSession);
        }

        existingSession.sessionStartReason = sessionStartReason;
        existingSession.learningMode = learningMode;
        existingSession.learningRuntimeState = learningRuntimeState;
        existingSession.level = level;
        existingSession.correctionMode = correctionMode;
        existingSession.topic = topic;
        existingSession.knowledgeText = learningMode === 'learn_new_vocabulary' ? '' : (knowledgeText || '');
        existingSession.turnMode = turnMode;
        existingSession.currentTransitionId = transitionId;
        existingSession.deferInitialCoachTurn = Boolean(deferInitialCoachTurn);
        if (initialActionPrompt) {
          existingSession.customStartupPrompt = initialActionPrompt;
        }

        if (deferInitialCoachTurn || forceFreshModelContext) {
          existingSession.initialCoachTurnSent = false;
          existingSession.teacherTurnStarted = false;
          existingSession.startupTurnPending = false;
          existingSession.liveSessionReady = false;
        }

        if (forceFreshModelContext) {
          existingSession.resumptionHandle = undefined;
        }

        const effectiveHandle = forceFreshModelContext
          ? undefined
          : clientRequestedHandle || existingSession.resumptionHandle;
        const isResuming = Boolean(effectiveHandle);

        const ai = getGeminiClient();

        const effectivePauseSeconds = Math.min(
          8,
          Math.max(3, Number(pauseToleranceSeconds) || 5)
        );
        const silenceDurationMs = Math.round(effectivePauseSeconds * 1000);

        let realtimeInputConfig: any;
        if (turnMode === "tap_to_talk") {
          realtimeInputConfig = {
            automaticActivityDetection: {
              disabled: true,
            },
            activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
          };
        } else if (turnMode === "noise_resistant") {
          realtimeInputConfig = {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
              prefixPaddingMs: 600,
              silenceDurationMs,
            },
            activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
          };
        } else {
          // "automatic" — LOW sensitivity + high prefix padding. The client now
          // mutes mic outbound while the coach speaks, so echo-triggered
          // self-interruptions are eliminated. The generous prefixPaddingMs
          // ensures that any residual ambient noise when the mic unmutes
          // doesn't immediately trigger Gemini's VAD.
          realtimeInputConfig = {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
              prefixPaddingMs: 500,
              silenceDurationMs,
            },
            activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
          };
        }

        // System Instruction using unified buildLearningModeInstruction
        const modeInstruction = buildLearningModeInstruction(
          learningMode,
          learningRuntimeState,
          level,
          correctionMode
        );

        const systemInstruction = `You are a bilingual Italian-English conversation coach for an Italian learner of English.

FRESH ACTIVITY-SELECTION SAFETY:
- When learningMode is activity_selection, the opening turn must be entirely in Italian.
- Never mention, infer or reuse previous sessions, saved phrases, Materials, travel, business, meetings or role-play unless the learner explicitly introduces them in the current session.
- A fresh session has no conversational memory.

${modeInstruction}

SPEECH AND TRANSCRIPTION CONTEXT:
- The learner normally speaks Italian or English and may switch between them.
- Treat short Italian confirmations such as "sì", "no", "va bene" and "dimmi tu" as valid complete turns.
- Do not reinterpret an isolated short Italian reply as another writing system or an unrelated language.
- When the transcript is unclear, ask for a brief repetition instead of inventing content.

Topic Focus / Scenario: ${topic}
${learningMode !== 'learn_new_vocabulary' && knowledgeText ? `- Student Materials & Vocabulary:\n${knowledgeText}` : ""}`;


        // Format history fallback if not resuming and history exists
        let historyTurns: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
        if (
          !isResuming &&
          sessionStartReason !== 'fresh_session' &&
          learningMode !== 'activity_selection' &&
          Array.isArray(recentHistory) &&
          recentHistory.length > 0
        ) {
          const filtered = recentHistory
            .filter((m: any) => m && (m.sender === "user" || m.sender === "coach") && typeof m.text === "string" && m.text.trim().length > 0)
            .slice(-12);

          let totalChars = 0;
          const pruned: Array<{ sender: "user" | "coach"; text: string }> = [];
          for (let i = filtered.length - 1; i >= 0; i--) {
            const item = filtered[i];
            if (totalChars + item.text.length > 8000) break;
            totalChars += item.text.length;
            pruned.unshift(item);
          }

          let lastRole: "user" | "model" | null = null;
          for (const item of pruned) {
            const role: "user" | "model" = item.sender === "user" ? "user" : "model";
            if (role !== lastRole) {
              historyTurns.push({
                role,
                parts: [{ text: item.text.trim() }],
              });
              lastRole = role;
            }
          }
        }

        const liveConfig: any = {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName || "Achird",
              },
            },
          },
          realtimeInputConfig,
          systemInstruction,
          sessionResumption: {
            handle: effectiveHandle || undefined,
          },
          contextWindowCompression: {
            slidingWindow: {},
          },
        };

        if (!isResuming && historyTurns.length > 0) {
          liveConfig.historyConfig = {
            initialHistoryInClientContent: true,
          };
        }

        try {
          liveSession = await ai.live.connect({
            model: "gemini-3.1-flash-live-preview",
            config: liveConfig,
            callbacks: {
              onmessage: (liveMsg: LiveServerMessage) => {
                // 0. Session Resumption & GoAway Handling
                if (liveMsg.sessionResumptionUpdate) {
                  const sru = liveMsg.sessionResumptionUpdate;
                  if (sru.resumable && sru.newHandle) {
                    existingSession!.resumptionHandle = sru.newHandle;
                    existingSession!.lastUpdated = Date.now();
                    if (clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(
                        JSON.stringify({
                          type: "session_resumption_update",
                          resumable: true,
                          hasHandle: true,
                        })
                      );
                    }
                  } else if (sru.resumable === false) {
                    if (clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(
                        JSON.stringify({
                          type: "session_resumption_update",
                          resumable: false,
                          hasHandle: Boolean(existingSession!.resumptionHandle),
                        })
                      );
                    }
                  }
                }

                if (liveMsg.goAway) {
                  const timeLeft = liveMsg.goAway.timeLeft || "unknown";
                  console.log(`[Gemini Live] GoAway received. Time left: ${timeLeft}`);
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: "go_away",
                        timeLeft,
                        hasHandle: Boolean(existingSession!.resumptionHandle),
                      })
                    );
                  }
                }

                if (liveMsg.setupComplete) {
                  existingSession!.liveSessionReady = true;
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: "setup_complete",
                        transitionId: existingSession!.currentTransitionId,
                      })
                    );
                  }

                  if (existingSession!.startupTurnPending && !existingSession!.initialCoachTurnSent) {
                    console.log(`[LiveHandoff] Executing pending startup turn upon setup_complete for transition #${existingSession!.currentTransitionId}`);
                    executeInitialCoachTurn(liveSession, clientWs, existingSession!, existingSession!.customStartupPrompt);
                  } else if (existingSession!.deferInitialCoachTurn) {
                    console.log(`[LiveHandoff] Deferring initial coach turn for transition #${existingSession!.currentTransitionId}`);
                  } else if (!isResuming && historyTurns.length > 0 && liveSession) {
                    try {
                      liveSession.sendClientContent({
                        turns: historyTurns,
                        turnComplete: true,
                      });
                      if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(
                          JSON.stringify({
                            type: "history_fallback_executed",
                            messageCount: historyTurns.length,
                          })
                        );
                      }
                    } catch (hErr) {
                      console.warn("Failed to send history fallback turns:", hErr);
                    }
                  } else if (!isResuming && historyTurns.length === 0 && liveSession) {
                    if (
                      !existingSession!.deferInitialCoachTurn &&
                      existingSession!.startupTurnPending &&
                      !existingSession!.initialCoachTurnSent
                    ) {
                      executeInitialCoachTurn(liveSession, clientWs, existingSession!);
                    }
                  }
                }

                // 1. Model Audio Response stream
                const parts = liveMsg.serverContent?.modelTurn?.parts;
                if (parts) {
                  if (!existingSession!.teacherTurnStarted) {
                    existingSession!.teacherTurnStarted = true;
                    existingSession!.teacherTurnSequence = (existingSession!.teacherTurnSequence || 0) + 1;
                    existingSession!.currentTeacherTurnId = `teacher_${existingSession!.teacherTurnSequence}_${Date.now()}`;
                    existingSession!.currentTeacherTransitionId = existingSession!.currentTransitionId;
                    if (clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(
                        JSON.stringify({
                          type: "teacher_turn_started",
                          transitionId: existingSession!.currentTeacherTransitionId,
                          teacherTurnId: existingSession!.currentTeacherTurnId,
                        })
                      );
                    }
                  }
                  for (const part of parts) {
                    if (part.inlineData?.data) {
                      clientWs.send(
                        JSON.stringify({
                          type: "audio",
                          data: part.inlineData.data,
                          mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                          teacherTurnId: existingSession!.currentTeacherTurnId,
                          transitionId: existingSession!.currentTeacherTransitionId,
                        })
                      );
                    }
                    if (part.text) {
                      clientWs.send(
                        JSON.stringify({
                          type: "teacher_transcript",
                          text: part.text,
                          teacherTurnId: existingSession!.currentTeacherTurnId,
                          transitionId: existingSession!.currentTeacherTransitionId,
                        })
                      );
                    }
                  }
                }

                // 2. Output Audio Transcription (Coach)
                const coachText = liveMsg.serverContent?.outputTranscription?.text;
                if (coachText) {
                  clientWs.send(
                    JSON.stringify({
                      type: "teacher_transcript",
                      text: coachText,
                      teacherTurnId: existingSession!.currentTeacherTurnId,
                      transitionId: existingSession!.currentTeacherTransitionId,
                    })
                  );
                }

                // 3. Input Audio Transcription (User) from Gemini Live
                const userText = liveMsg.serverContent?.inputTranscription?.text;
                if (userText) {
                  const isStartupTriggerText = userText.includes("Start this new voice session now") || userText.includes("[SYSTEM_STARTUP_TRIGGER]");
                  if (!isStartupTriggerText) {
                    clientWs.send(
                      JSON.stringify({
                        type: "user_transcript",
                        text: userText,
                      })
                    );
                  }
                }

                // 4. Interrupted event
                if (liveMsg.serverContent?.interrupted) {
                  const interruptedId = existingSession!.currentTeacherTurnId;
                  existingSession!.interruptedTeacherTurnId = interruptedId;
                  existingSession!.teacherTurnStarted = false;
                  existingSession!.currentTeacherTurnId = undefined;
                  clientWs.send(JSON.stringify({
                    type: "interrupted",
                    teacherTurnId: interruptedId,
                    transitionId: existingSession!.currentTeacherTransitionId,
                  }));
                }

                // 5. Turn complete event
                if (liveMsg.serverContent?.turnComplete) {
                  const completedTeacherTurnId = existingSession!.currentTeacherTurnId || existingSession!.interruptedTeacherTurnId;
                  existingSession!.teacherTurnStarted = false;
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: "teacher_turn_completed",
                        transitionId: existingSession!.currentTeacherTransitionId,
                        teacherTurnId: completedTeacherTurnId,
                      })
                    );
                  }
                  existingSession!.currentTeacherTurnId = undefined;
                  existingSession!.currentTeacherTransitionId = undefined;
                  existingSession!.interruptedTeacherTurnId = undefined;
                }
              },
              onclose: () => {
                if (clientWs.readyState === WebSocket.OPEN) {
                  // A close before setup ever completed means the upstream Gemini Live
                  // connection was rejected (bad/missing API key, quota, model unavailable,
                  // etc.) rather than ended gracefully. The client has no handler for a bare
                  // "session_closed" and would otherwise sit silently until the generic
                  // startup watchdog times out ~16s later. Surface it immediately as an
                  // error so the client's existing reconnect/error UI kicks in right away.
                  if (!existingSession!.liveSessionReady) {
                    clientWs.send(JSON.stringify({
                      type: "error",
                      error: "La sessione Gemini Live si è chiusa prima di completare l'avvio. Verifica che GEMINI_API_KEY sia configurata correttamente.",
                    }));
                  }
                  clientWs.send(JSON.stringify({ type: "session_closed" }));
                }
              },
              onerror: (err: any) => {
                console.error("Gemini Live Session Error:", err);
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: "error", error: err?.message || "Live session error" }));
                }
              },
            },
          });

          clientWs.send(
            JSON.stringify({
              type: "connected",
              serverPauseToleranceSeconds: effectivePauseSeconds,
              silenceDurationMs,
              serverReceivedLevel: level,
              levelProfileInjected: level,
              appSessionId,
              isResumed: isResuming,
              hasHandle: Boolean(existingSession.resumptionHandle),
              contextWindowCompressionActive: true,
            })
          );
        } catch (connErr: any) {
          console.error("Live session connect error:", connErr);
          clientWs.send(
            JSON.stringify({ type: "error", error: connErr.message || "Impossibile avviare Gemini Live API" })
          );
        }
      } else if (msg.type === "request_initial_coach_turn") {
        const sess = currentAppSessionId ? serverSessions.get(currentAppSessionId) : null;
        if (sess) {
          if (msg.transitionId !== undefined && sess.currentTransitionId !== undefined && msg.transitionId < sess.currentTransitionId) {
            console.log(`[LiveHandoff] Obsolete request_initial_coach_turn for transition #${msg.transitionId} (current: #${sess.currentTransitionId})`);
            return;
          }
          if (msg.initialActionPrompt) {
            sess.customStartupPrompt = msg.initialActionPrompt;
          }
          if (sess.liveSessionReady && liveSession) {
            executeInitialCoachTurn(liveSession, clientWs, sess, msg.initialActionPrompt);
          } else {
            sess.startupTurnPending = true;
          }
        }
      } else if (msg.type === "context_update" && liveSession) {
        const sess = currentAppSessionId ? serverSessions.get(currentAppSessionId) : null;
        if (!sess) return;
        sess.learningMode = msg.learningMode || sess.learningMode;
        sess.learningRuntimeState = msg.learningRuntimeState || sess.learningRuntimeState;
        sess.topic = msg.topic || sess.topic;
        sess.knowledgeText = sess.learningMode === 'learn_new_vocabulary' ? '' : String(msg.knowledgeText || sess.knowledgeText || '');
        sess.currentTransitionId = Number(msg.transitionId || 0);
        sess.customStartupPrompt = String(msg.initialActionPrompt || '');
        // Send ONLY the short action prompt to Gemini, not the entire learning
        // mode instruction set. The system instruction already contains the full
        // mode details — re-sending hundreds of lines as "user input" confused
        // Gemini into restarting its response mid-stream.
        sess.lastTeacherPrompt = sess.customStartupPrompt
          ? `[ACTIVITY_SWITCH] Mode: ${sess.learningMode || 'activity_selection'}. ${sess.customStartupPrompt}`
          : `[ACTIVITY_SWITCH] Mode: ${sess.learningMode || 'activity_selection'}. Procedi con l'attività indicata nelle tue istruzioni di sistema.`;
        sess.initialCoachTurnSent = false;
        // Preserve any in-flight teacher turn ID and its original transition.
        // Late chunks from that turn remain attributable and are discarded by the client.
        sess.interruptedTeacherTurnId = undefined;
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({
            type: "context_update_accepted",
            transitionId: sess.currentTransitionId,
          }));
        }
        if (sess.lastTeacherPrompt) {
          liveSession.sendRealtimeInput({ text: sess.lastTeacherPrompt });
        }
      } else if (msg.type === "retry_teacher_turn" && liveSession) {
        const sess = currentAppSessionId ? serverSessions.get(currentAppSessionId) : null;
        if (!sess) return;
        const actionPrompt = String(
          msg.initialActionPrompt ||
          sess.customStartupPrompt ||
          'Respond to the learner’s latest turn in the current active activity.'
        ).trim();
        sess.currentTransitionId = Number(msg.transitionId ?? sess.currentTransitionId ?? 0);
        sess.teacherTurnStarted = false;
        sess.currentTeacherTurnId = undefined;
        sess.currentTeacherTransitionId = undefined;
        sess.interruptedTeacherTurnId = undefined;
        const retryPrompt = `[AUDIO_RETRY] ${actionPrompt} Produce a complete SPOKEN audio response now.`;
        sess.lastTeacherPrompt = retryPrompt;
        liveSession.sendRealtimeInput({ text: retryPrompt });
      } else if (msg.type === "session_end") {
        if (currentAppSessionId) {
          serverSessions.delete(currentAppSessionId);
        }
        if (liveSession) {
          try {
            liveSession.close();
          } catch (e) {}
          liveSession = null;
        }
      } else if (msg.type === "audio" && liveSession) {
        liveSession.sendRealtimeInput({
          audio: {
            data: msg.data,
            mimeType: "audio/pcm;rate=16000",
          },
        });
      } else if (msg.type === "text" && liveSession) {
        liveSession.sendRealtimeInput({
          text: msg.text,
        });
      } else if (msg.type === "activity_start" && liveSession) {
        liveSession.sendRealtimeInput({
          activityStart: {},
        });
      } else if (msg.type === "activity_end" && liveSession) {
        liveSession.sendRealtimeInput({
          activityEnd: {},
        });
      } else if (msg.type === "audio_stream_end" && liveSession) {
        liveSession.sendRealtimeInput({
          audioStreamEnd: true,
        });
      } else if (msg.type === "interrupt" && liveSession) {
        let interruptedId = msg.teacherTurnId;
        if (currentAppSessionId) {
          const sess = serverSessions.get(currentAppSessionId);
          if (sess) {
            interruptedId = interruptedId || sess.currentTeacherTurnId;
            sess.interruptedTeacherTurnId = interruptedId || "current";
            // Keep the current turn identity until Gemini emits interrupted or
            // turnComplete, so every late chunk remains traceable and rejectable.
          }
        }
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: "teacher_turn_interrupted",
              teacherTurnId: interruptedId,
            })
          );
        }
      }
    } catch (e: any) {
      console.error("WebSocket message processing error:", e);
    }
  });

  clientWs.on("close", () => {
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {}
    }
  });
});

// Setup Vite Development Middleware or Static Production Serving
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Madrelingua AI Coach attivo su http://localhost:${PORT}`);
  });
}

startServer();
