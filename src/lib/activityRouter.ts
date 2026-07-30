import { analyzeNewVocabularyRequest } from './newVocabularyRequestAnalyzer';
export type ActivityIntent =
  | 'show_activity_menu'
  | 'free_conversation'
  | 'knowledge_review'
  | 'learn_new_vocabulary'
  | 'learning_games'
  | 'change_activity'
  | 'resume_suspended_lesson'
  | 'stop'
  | 'unknown';

export interface ActivityRouteResult {
  intent: ActivityIntent;
  confidence: number;
  matchedPhrase?: string;
  reason: string;
}

function normalizeInput(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/['’`]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectActivityIntent(text: string): ActivityRouteResult {
  const norm = normalizeInput(text);
  if (!norm) {
    return { intent: 'unknown', confidence: 0, reason: 'Input vuoto' };
  }

  // 1. RESUME SUSPENDED LESSON
  const resumePhrases = [
    'torniamo alla lezione',
    'riprendiamo le nuove parole',
    'riprendiamo la lezione',
    'continuiamo da dove eravamo',
    'continuiamo la lezione',
    'resume the lesson',
    'resume lesson',
    'torniamo all esercizio',
    'riprendere la lezione',
  ];
  for (const phrase of resumePhrases) {
    if (norm.includes(phrase)) {
      return {
        intent: 'resume_suspended_lesson',
        confidence: 0.95,
        matchedPhrase: phrase,
        reason: 'Riconosciuta richiesta di riprendere la lezione in sospeso',
      };
    }
  }

  // 2. SHOW ACTIVITY MENU / CAPABILITIES
  const menuPhrases = [
    'che cosa possiamo fare',
    'che cosa si puo fare',
    'quali attivita possiamo fare',
    'che tipo di esercizi possiamo fare',
    'cosa sei in grado di fare',
    'quali esercizi sai fare',
    'mi dici tutte le attivita',
    'mi dici le attivita',
    'what can we do',
    'what activities are available',
    'what kind of exercises can we do',
    'what can you help me with',
    'cosa possiamo fare',
    'quali sono le attivita',
    'quali attivita ci sono',
    'che attivita possiamo fare',
    'quali modalita ci sono',
    'mostra le attivita',
    'mostra menu',
  ];
  for (const phrase of menuPhrases) {
    if (norm.includes(phrase)) {
      return {
        intent: 'show_activity_menu',
        confidence: 0.95,
        matchedPhrase: phrase,
        reason: 'Riconosciuta richiesta di visualizzazione del menu delle quattro attività',
      };
    }
  }

  // 1. CHANGE ACTIVITY
  const changePhrases = [
    'cambiamo attivita',
    'cambia attivita',
    'cambiamo esercizio',
    'voglio fare altro',
    'torna al menu',
    'torna al menu principale',
    'scegliiamo un altro esercizio',
    'change activity',
    'switch activity',
    'cambia modalita',
    'scegliere un altra attivita',
  ];
  for (const phrase of changePhrases) {
    if (norm.includes(phrase)) {
      return {
        intent: 'change_activity',
        confidence: 0.95,
        matchedPhrase: phrase,
        reason: 'Riconosciuta richiesta di cambio attività',
      };
    }
  }

  // 2. STOP
  const stopPhrases = [
    'stop',
    'basta',
    'terminiamo',
    'chiudi la sessione',
    'fermiamoci',
    'end session',
    'stop session',
    'finito per oggi',
  ];
  for (const phrase of stopPhrases) {
    if (norm === phrase || norm.startsWith(phrase + ' ') || norm.endsWith(' ' + phrase)) {
      return {
        intent: 'stop',
        confidence: 0.95,
        matchedPhrase: phrase,
        reason: 'Riconosciuto comando di stop sessione',
      };
    }
  }

  // 3. KNOWLEDGE REVIEW (Check before learn_new_vocabulary due to "parole" overlap!)
  // Verbs/Qualifiers: ripassare, ripasso, salvate, lista, miei materiali, mia lista
  const reviewPhrases = [
    'ripassiamo',
    'voglio ripassare',
    'ripasso vocaboli',
    'ripassa le mie parole',
    'parole della lista',
    'parole salvate',
    'vocaboli dei materiali',
    'ripassiamo i materiali',
    'vocabulary review',
    'review my vocabulary',
    'review my saved words',
    'ripassare le parole',
    'ripassa i vocaboli',
    'ripasso delle parole',
    'ripassare',
    'ripasso',
    'della mia lista',
    'miei materiali',
  ];
  for (const phrase of reviewPhrases) {
    if (norm.includes(phrase)) {
      return {
        intent: 'knowledge_review',
        confidence: 0.9,
        matchedPhrase: phrase,
        reason: 'Riconosciuta intenzione di ripassare parole o materiali salvati',
      };
    }
  }

  // 4. LEARN NEW VOCABULARY
  // Use the canonical analyzer instead of a second, over-broad phrase list.
  const newVocabularyAnalysis = analyzeNewVocabularyRequest(text);
  if (newVocabularyAnalysis.requestsActivity) {
    return {
      intent: 'learn_new_vocabulary',
      confidence: newVocabularyAnalysis.confidence,
      matchedPhrase: newVocabularyAnalysis.explicitTopicText || norm,
      reason: newVocabularyAnalysis.hasExplicitTopic
        ? 'Riconosciuta richiesta di nuove parole con argomento esplicito'
        : 'Riconosciuta richiesta della modalità nuove parole senza argomento',
    };
  }

  // 5. FREE CONVERSATION
  const freeTalkPhrases = [
    'conversazione libera',
    'voglio conversare',
    'vorrei parlare',
    'parliamo un po',
    'facciamo conversazione',
    'chiacchieriamo',
    'free conversation',
    "let's talk",
    'lets talk',
    'i want to practise speaking',
    'i want to practice speaking',
    'farsi una chiacchierata',
    'parlare un po',
    'parliamo in inglese',
  ];
  for (const phrase of freeTalkPhrases) {
    if (norm.includes(phrase)) {
      return {
        intent: 'free_conversation',
        confidence: 0.9,
        matchedPhrase: phrase,
        reason: 'Riconosciuta intenzione di fare una conversazione libera',
      };
    }
  }

  // 6. LEARNING GAMES
  const gamePhrases = [
    'facciamo un gioco',
    'voglio giocare',
    'gioco linguistico',
    'quiz',
    'esercizio a punti',
    'language game',
    "let's play",
    'lets play',
    'vocabulary game',
    'giochi linguistici',
    'facciamo un quiz',
  ];
  for (const phrase of gamePhrases) {
    if (norm.includes(phrase)) {
      return {
        intent: 'learning_games',
        confidence: 0.9,
        matchedPhrase: phrase,
        reason: 'Riconosciuta intenzione di fare un gioco linguistico',
      };
    }
  }

  return {
    intent: 'unknown',
    confidence: 0,
    reason: 'Nessuna corrispondenza euristica diretta trovata',
  };
}
