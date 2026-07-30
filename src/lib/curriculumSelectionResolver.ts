import { TopicPack, TopicModule, CompetencyArea } from './topicPacks/types';
import {
  getAllTopicPacks,
  getTopicPack,
  PACK_ITALIAN_LABELS,
  getPackSelectionAliases,
} from './topicPacks/registry';
import { analyzeNewVocabularyRequest } from './newVocabularyRequestAnalyzer';

export type ResolutionType =
  | 'resolved'
  | 'needs_module'
  | 'needs_competency'
  | 'ambiguous'
  | 'not_found'
  | 'activity_only'
  | 'unclear_choice'
  | 'custom_topic';

export interface CandidateOption {
  id: string;
  title: string;
  description?: string;
  packId?: string;
  moduleId?: string;
  type: 'pack' | 'module' | 'competency';
}

export interface CurriculumResolution {
  type: ResolutionType;
  confidence: number;
  pack?: TopicPack;
  module?: TopicModule;
  competencyArea?: CompetencyArea;
  candidateOptions?: CandidateOption[];
  matchedPhrase?: string;
  requestedTopic?: string;
  explanation: string;
  isActivityOnlyRequest?: boolean;
}

const UNCLEAR_CHOICE_PHRASES = [
  'non so',
  'scegli tu',
  'boh',
  'qualcosa di utile',
  'fai tu',
  'decidi tu',
  'qualsiasi',
  'non ho preferenze',
  'scegli per me',
  'quello che vuoi',
];

export function normalizeCurriculumText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meaningfulTokens(text: string): string[] {
  const stop = new Set([
    'and', 'the', 'for', 'with', 'about', 'from', 'into', 'per', 'con', 'della', 'delle', 'degli', 'del',
    'dei', 'sul', 'sulla', 'sulle', 'una', 'uno', 'un', 'il', 'lo', 'la', 'le', 'gli', 'di', 'in', 'e', 'a',
  ]);
  return normalizeCurriculumText(text)
    .split(' ')
    .filter((token) => token.length >= 3 && !stop.has(token));
}

function tokenSimilarity(query: string, candidate: string): number {
  const q = normalizeCurriculumText(query);
  const c = normalizeCurriculumText(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (q.length >= 4 && c.length >= 4 && (q.includes(c) || c.includes(q))) return 0.88;

  const qTokens = meaningfulTokens(q);
  const cTokens = meaningfulTokens(c);
  if (!qTokens.length || !cTokens.length) return 0;

  let matched = 0;
  for (const qToken of qTokens) {
    if (
      cTokens.some(
        (cToken) =>
          cToken === qToken ||
          (cToken.length >= 5 && qToken.length >= 5 && (cToken.includes(qToken) || qToken.includes(cToken)))
      )
    ) {
      matched += 1;
    }
  }

  const queryCoverage = matched / qTokens.length;
  const candidateCoverage = matched / cTokens.length;
  return Math.max(queryCoverage * 0.82, candidateCoverage * 0.68);
}

function buildModuleSearchText(module: TopicModule): string[] {
  const values = [module.title];
  for (const competency of module.competencyAreas || []) {
    values.push(competency.title, competency.description);
    values.push(...(competency.learningObjectives || []));
    values.push(...(competency.realLifeSituations || []));
  }
  for (const seed of module.seedItems || []) {
    values.push(seed.expression, seed.meaning, seed.usage);
  }
  return values.filter(Boolean);
}

function scorePack(query: string, pack: TopicPack): number {
  const candidates = [
    pack.title,
    pack.description,
    PACK_ITALIAN_LABELS[pack.id] || '',
    ...getPackSelectionAliases(pack.id),
  ];
  return candidates.reduce((best, candidate) => Math.max(best, tokenSimilarity(query, candidate)), 0);
}

function scoreModule(query: string, module: TopicModule): { score: number; competency?: CompetencyArea } {
  let score = tokenSimilarity(query, module.title);
  let bestCompetency: CompetencyArea | undefined;

  for (const competency of module.competencyAreas || []) {
    const competencyScore = Math.max(
      tokenSimilarity(query, competency.title),
      tokenSimilarity(query, competency.description),
      ...(competency.realLifeSituations || []).map((value) => tokenSimilarity(query, value))
    );
    if (competencyScore > score) {
      score = competencyScore;
      bestCompetency = competency;
    }
  }

  for (const value of buildModuleSearchText(module)) {
    score = Math.max(score, tokenSimilarity(query, value) * 0.94);
  }

  return { score, competency: bestCompetency };
}

function moduleOptions(pack: TopicPack): CandidateOption[] {
  return pack.modules.map((module) => ({
    id: module.id,
    title: module.title,
    packId: pack.id,
    type: 'module' as const,
  }));
}

/**
 * Resolves a registry topic or module without letting generic conversation text
 * activate the vocabulary activity outside select_topic.
 */
export function resolveCurriculumSelection(params: {
  userText: string;
  currentPhase?: string;
  activeTopicPackId?: string;
  packsRegistry?: TopicPack[];
}): CurriculumResolution {
  const { userText, currentPhase = 'select_topic', activeTopicPackId } = params;
  const allPacks = params.packsRegistry?.length ? params.packsRegistry : getAllTopicPacks();
  const normUserText = normalizeCurriculumText(userText);

  if (!normUserText) {
    return {
      type: 'not_found',
      confidence: 0,
      explanation: 'Nessun testo utile da risolvere.',
    };
  }

  const delegatedChoice = UNCLEAR_CHOICE_PHRASES.some(
    (phrase) => normUserText === phrase || normUserText.includes(phrase)
  );

  if (delegatedChoice) {
    // “Scegli tu” is explicit permission to choose, not a failure to understand.
    // Prefer the already selected pack; otherwise start from a broadly useful daily-life pack.
    const preferredPack = activeTopicPackId
      ? (getTopicPack(activeTopicPackId) || allPacks.find((pack) => pack.id === activeTopicPackId))
      : (allPacks.find((pack) => pack.id === 'everyday_life_and_daily_english') || allPacks[0]);
    const preferredModule = preferredPack?.modules?.[0];

    if (preferredPack && preferredModule) {
      return {
        type: 'resolved',
        confidence: 0.72,
        pack: preferredPack,
        module: preferredModule,
        competencyArea: preferredModule.competencyAreas?.[0],
        matchedPhrase: 'scelta delegata all’applicazione',
        explanation: `L'utente ha delegato la scelta. Selezionati il Topic Pack "${preferredPack.title}" e il modulo "${preferredModule.title}".`,
      };
    }

    return {
      type: 'unclear_choice',
      confidence: 0.2,
      explanation: "L'utente ha delegato la scelta, ma il registro non contiene un modulo utilizzabile.",
    };
  }

  const analysis = analyzeNewVocabularyRequest(userText, { currentPhase });

  if (analysis.requestsActivity && !analysis.hasExplicitTopic) {
    return {
      type: 'activity_only',
      confidence: analysis.confidence,
      isActivityOnlyRequest: true,
      explanation: 'Richiesta della modalità nuove parole senza argomento specifico.',
    };
  }

  if (!analysis.requestsActivity && !analysis.hasExplicitTopic && currentPhase !== 'select_topic' && currentPhase !== 'select_module') {
    return {
      type: 'not_found',
      confidence: 0,
      explanation: 'La frase non è una richiesta di apprendimento vocaboli e non è una scelta contestuale.',
    };
  }

  const topicQuery = analysis.explicitTopicText || userText;
  const normalizedTopicQuery = normalizeCurriculumText(topicQuery);

  if (currentPhase === 'select_module' && activeTopicPackId) {
    const activePack = getTopicPack(activeTopicPackId) || allPacks.find((pack) => pack.id === activeTopicPackId);
    if (!activePack) {
      return {
        type: 'not_found',
        confidence: 0,
        explanation: 'Topic Pack attivo non trovato.',
      };
    }

    const moduleMatches = activePack.modules
      .map((module) => ({ module, ...scoreModule(normalizedTopicQuery, module) }))
      .sort((a, b) => b.score - a.score);

    const best = moduleMatches[0];
    if (best && best.score >= 0.38) {
      return {
        type: 'resolved',
        confidence: best.score,
        pack: activePack,
        module: best.module,
        competencyArea: best.competency,
        matchedPhrase: best.module.title,
        explanation: `Modulo "${best.module.title}" risolto nel Topic Pack "${activePack.title}".`,
      };
    }

    return {
      type: 'needs_module',
      confidence: 0.25,
      pack: activePack,
      candidateOptions: moduleOptions(activePack),
      explanation: 'La scelta non identifica chiaramente uno dei moduli disponibili.',
    };
  }

  const packMatches = allPacks
    .map((pack) => {
      const packScore = scorePack(normalizedTopicQuery, pack);
      const moduleScores = pack.modules
        .map((module) => ({ module, ...scoreModule(normalizedTopicQuery, module) }))
        .sort((a, b) => b.score - a.score);
      const bestModule = moduleScores[0];
      const combinedScore = Math.min(1, Math.max(packScore, (bestModule?.score || 0) + packScore * 0.12));
      return { pack, packScore, bestModule, combinedScore };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore);

  const top = packMatches[0];
  const second = packMatches[1];

  if (!top || top.combinedScore < 0.34) {
    if (analysis.hasExplicitTopic && analysis.explicitTopicText) {
      return {
        type: 'custom_topic',
        confidence: 0.62,
        requestedTopic: analysis.explicitTopicText,
        explanation: `L'argomento "${analysis.explicitTopicText}" non corrisponde a un Topic Pack registrato.`,
      };
    }

    if (currentPhase === 'select_topic' && normalizedTopicQuery.length >= 3) {
      return {
        type: 'custom_topic',
        confidence: 0.55,
        requestedTopic: topicQuery.trim(),
        explanation: `Scelta contestuale trattata come argomento personalizzato: "${topicQuery.trim()}".`,
      };
    }

    return {
      type: 'not_found',
      confidence: 0,
      explanation: 'Nessuna corrispondenza affidabile nel registro.',
    };
  }

  if (second && second.combinedScore >= top.combinedScore - 0.07 && second.pack.id !== top.pack.id) {
    return {
      type: 'ambiguous',
      confidence: top.combinedScore,
      candidateOptions: [top, second].map((entry) => ({
        id: entry.pack.id,
        title: PACK_ITALIAN_LABELS[entry.pack.id] || entry.pack.title,
        description: entry.pack.description,
        packId: entry.pack.id,
        type: 'pack' as const,
      })),
      explanation: 'Due Topic Pack risultano quasi equivalenti per la richiesta.',
    };
  }

  const moduleMatch = top.bestModule;
  const queryClearlyTargetsModule = Boolean(
    moduleMatch &&
      moduleMatch.score >= 0.38
  );

  if (queryClearlyTargetsModule && moduleMatch) {
    return {
      type: 'resolved',
      confidence: top.combinedScore,
      pack: top.pack,
      module: moduleMatch.module,
      competencyArea: moduleMatch.competency,
      matchedPhrase: moduleMatch.module.title,
      explanation: `Risolti Topic Pack "${top.pack.title}" e modulo "${moduleMatch.module.title}".`,
    };
  }

  if (top.pack.modules.length === 1) {
    return {
      type: 'resolved',
      confidence: top.combinedScore,
      pack: top.pack,
      module: top.pack.modules[0],
      matchedPhrase: top.pack.title,
      explanation: `Topic Pack "${top.pack.title}" risolto sul suo unico modulo.`,
    };
  }

  return {
    type: 'needs_module',
    confidence: top.combinedScore,
    pack: top.pack,
    candidateOptions: moduleOptions(top.pack),
    matchedPhrase: top.pack.title,
    explanation: `Topic Pack "${top.pack.title}" riconosciuto. È necessaria la scelta del modulo.`,
  };
}
