export interface NewVocabularyRequestAnalysis {
  requestsActivity: boolean;
  explicitTopicText?: string;
  hasExplicitTopic: boolean;
  confidence: number;
}

export interface NewVocabularyRequestAnalysisOptions {
  currentPhase?: string;
}

const VOCABULARY_NOUN_PATTERNS = [
  /\bparol(?:a|e)\b/,
  /\bvocabol(?:o|i|ario)\b/,
  /\bespression(?:e|i)\b/,
  /\btermin(?:e|i)\b/,
  /\bphrasal\s+verbs?\b/,
  /\bvocabulary\b/,
  /\bwords?\b/,
  /\bexpressions?\b/,
];

const ACTIVITY_VERB_PATTERNS = [
  /\bimpar(?:are|iamo|o|a)\b/,
  /\binsegn(?:ami|aci|are)\b/,
  /\bfacciamo\b/,
  /\bvorrei\b/,
  /\bvoglio\b/,
  /\bpossiamo\b/,
  /\bparlare\b/,
  /\blearn\b/,
  /\bteach\b/,
  /\bpractice\b/,
  /\bpractise\b/,
];

const GENERIC_ACTIVITY_ONLY_PATTERNS = [
  /\bqualcosa\s+di\s+nuovo\b/,
  /\bsomething\s+new\b/,
];

const DISCOURSE_PREFIXES = [
  'ma',
  'e',
  'ecco',
  'allora',
  'praticamente',
  'magari',
  'insomma',
  'ok',
  'okay',
  'beh',
];

const GENERIC_TOPIC_FRAGMENTS = new Set([
  'nuove parole',
  'parole nuove',
  'nuovi vocaboli',
  'vocaboli nuovi',
  'nuove espressioni',
  'espressioni nuove',
  'qualche nuova parola',
  'qualche nuovo vocabolo',
  'qualche nuova espressione',
  'qualcosa di nuovo',
  'new vocabulary',
  'new words',
  'new expressions',
  'something new',
  'questa attivita',
  'questa attività',
  'inglese',
  'english',
]);

function normalizeForAnalysis(text: string): string {
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

function stripLeadingDiscourse(text: string): string {
  let result = text.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of DISCOURSE_PREFIXES) {
      if (result === prefix) return '';
      if (result.startsWith(`${prefix} `)) {
        result = result.slice(prefix.length).trim();
        changed = true;
      }
    }
  }
  return result;
}

function cleanTopicCandidate(candidate: string): string {
  let cleaned = candidate.trim();
  cleaned = cleaned
    .replace(/^(?:su|sul|sulla|sulle|sugli|sui|per|in|nel|nella|nelle|relativ[ei] a|di|del|della|dei|delle|degli|about|for|on)\s+/i, '')
    .replace(/^(?:un po di|qualcosa su|qualcosa di)\s+/i, '')
    .replace(/\b(?:per favore|please)\b$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || GENERIC_TOPIC_FRAGMENTS.has(cleaned)) return '';
  if (/^(?:nuov[aei]|parol[ae]|vocabol[io]|espression[ei]|qualcosa)$/i.test(cleaned)) return '';
  return cleaned;
}

function extractTopicAfterVocabularyLanguage(norm: string): string {
  const connectors = [
    /\b(?:parol(?:a|e)|vocabol(?:o|i|ario)|espression(?:e|i)|termin(?:e|i)|phrasal\s+verbs?|vocabulary|words?|expressions?)\b[\s\w'’-]*?\b(?:su|sul|sulla|sulle|sugli|sui|per|in|nel|nella|nelle|relativ[ei] a|di|del|della|dei|delle|degli|about|for|on)\s+(.+)$/,
    /\b(?:learn|teach|imparare|impariamo|insegnami|facciamo)\b[\s\w'’-]*?\b(?:su|sul|sulla|per|about|for)\s+(.+)$/,
  ];

  for (const pattern of connectors) {
    const match = norm.match(pattern);
    if (match?.[1]) {
      const candidate = cleanTopicCandidate(match[1]);
      if (candidate) return candidate;
    }
  }
  return '';
}

function hasAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Deterministically separates a request for the activity from a topic choice.
 * Bare topics are accepted only while the application is already waiting in select_topic.
 */
export function analyzeNewVocabularyRequest(
  userText: string,
  options: NewVocabularyRequestAnalysisOptions = {}
): NewVocabularyRequestAnalysis {
  const norm = stripLeadingDiscourse(normalizeForAnalysis(userText));
  if (!norm) {
    return {
      requestsActivity: false,
      hasExplicitTopic: false,
      confidence: 0,
    };
  }

  const inTopicSelection = options.currentPhase === 'select_topic';
  const hasVocabularyNoun = hasAnyPattern(norm, VOCABULARY_NOUN_PATTERNS);
  const hasActivityVerb = hasAnyPattern(norm, ACTIVITY_VERB_PATTERNS);
  const isGenericSomethingNew = hasAnyPattern(norm, GENERIC_ACTIVITY_ONLY_PATTERNS);

  const explicitTopic = hasVocabularyNoun ? extractTopicAfterVocabularyLanguage(norm) : '';

  if (hasVocabularyNoun && (hasActivityVerb || /\bnuov[aei]\b/.test(norm) || /\bnew\b/.test(norm))) {
    if (explicitTopic) {
      return {
        requestsActivity: true,
        hasExplicitTopic: true,
        explicitTopicText: explicitTopic,
        confidence: 0.98,
      };
    }

    return {
      requestsActivity: true,
      hasExplicitTopic: false,
      confidence: 0.96,
    };
  }

  if (isGenericSomethingNew && hasActivityVerb) {
    return {
      requestsActivity: true,
      hasExplicitTopic: false,
      confidence: 0.9,
    };
  }

  if (inTopicSelection) {
    const bareTopic = cleanTopicCandidate(norm);
    if (bareTopic && bareTopic.split(' ').length <= 12) {
      return {
        requestsActivity: false,
        hasExplicitTopic: true,
        explicitTopicText: bareTopic,
        confidence: 0.88,
      };
    }
  }

  return {
    requestsActivity: false,
    hasExplicitTopic: false,
    confidence: 0.05,
  };
}

export function normalizeNewVocabularyRequestText(text: string): string {
  return normalizeForAnalysis(text);
}
