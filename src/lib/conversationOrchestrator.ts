import {
  ConversationRuntimeState,
  validateConversationRuntime,
} from './conversationRuntime';
import {
  CurriculumResolution,
  resolveCurriculumSelection,
} from './curriculumSelectionResolver';
import { detectActivityIntent } from './activityRouter';
import {
  buildCompleteExclusionSet,
  generateCustomTopicItems,
  isValidNewTargetItem,
  selectNewVocabularyItems,
} from './newVocabularySelector';
import { KnowledgeDocument, UserLevel } from '../types';
import { TopicLessonItem } from '../types/learningSession';
import { buildUnifiedMaterialReviewIndex } from './knowledgeReviewIndex';
import {
  getMacroTopicOverview,
  getTopicPack,
  PACK_ITALIAN_LABELS,
} from './topicPacks/registry';
import {
  routeVocabularyLessonTurn,
} from './vocabularyLessonController';

export type TurnOutcome =
  | 'global_command'
  | 'activity_transition'
  | 'curriculum_resolved'
  | 'curriculum_needs_choice'
  | 'exercise_turn'
  | 'control_intent'
  | 'conversational_turn'
  | 'rejected';

export interface TurnRoutingResult {
  turnId: string;
  consumed: boolean;
  outcome: TurnOutcome;
  nextRuntimeState: ConversationRuntimeState;
  /** Private instruction for the teacher model. Never append this directly to visible history. */
  modelActionPrompt?: string;
  /** Complete learner-facing text that may safely be displayed without a model call. */
  userFacingText?: string;
  knowledgeText?: string;
  explanation: string;
}

export interface UserTurnInput {
  turnId: string;
  text: string;
  source: 'voice' | 'text';
  receivedAt: number;
  runtimeState: ConversationRuntimeState;
  knowledgeDocs?: KnowledgeDocument[];
  userLevel?: UserLevel;
}

const processedTurnIds = new Set<string>();

export function resetProcessedTurnIdsForTest(): void {
  processedTurnIds.clear();
}

function normalizeInput(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function activityMenuText(): string {
  return "Ciao! Sono il tuo assistente madrelingua per l’inglese. Oggi possiamo fare una conversazione libera, ripassare le tue parole, imparare nuove parole ed espressioni oppure fare un gioco linguistico. Cosa scegli?";
}

function shortMenuAcknowledgement(): string {
  return 'Ciao! Sono qui. Quale delle quattro attività scegli?';
}

function topicOverviewText(): string {
  return getMacroTopicOverview().formattedPromptPanorama;
}

// userFacingText above is the full written list for the text-mode chat UI, where a
// skimmable list is fine. In voice mode the app tells Gemini to speak userFacingText
// verbatim whenever no modelActionPrompt is supplied — reading an 11-item list aloud
// is unnatural, so every topic-overview outcome must also carry this spoken variant.
const TOPIC_OVERVIEW_ACTION_PROMPT =
  'Fai una breve panoramica naturale e colloquiale, in una o due frasi, di 3 o 4 esempi di aree disponibili (per esempio vita quotidiana, viaggi, lavoro, salute) senza elencarle tutte né numerarle. Poi chiedi da quale preferisce iniziare, oppure se vuole dirti "scegli tu". Menziona anche che può chiedere phrasal verbs, collocations o espressioni specifiche invece di un argomento.';

function moduleOverviewText(resolution: CurriculumResolution): string {
  const packTitle = resolution.pack
    ? (PACK_ITALIAN_LABELS[resolution.pack.id] || resolution.pack.title)
    : 'questo argomento';
  const options = (resolution.candidateOptions || []).map((option) => option.title);
  if (!options.length) {
    return `Hai scelto “${packTitle}”. Quale situazione specifica vuoi approfondire?`;
  }
  const readable = options.length === 1
    ? options[0]
    : `${options.slice(0, -1).join(', ')} oppure ${options[options.length - 1]}`;
  return `Hai scelto “${packTitle}”. Possiamo lavorare su ${readable}. Quale modulo preferisci?`;
}

function clarificationText(resolution: CurriculumResolution): string {
  const options = (resolution.candidateOptions || []).slice(0, 3).map((option) => option.title);
  if (!options.length) {
    return 'Non ho capito bene l’argomento. Puoi indicarmelo con una o due parole?';
  }
  return `Intendi ${options.join(' oppure ')}?`;
}

function toRuntimeItem(item: TopicLessonItem): NonNullable<ConversationRuntimeState['currentItem']> {
  const expression = item.expression || item.english || '';
  const meaning = item.meaning || item.italian || '';
  return {
    id: item.id,
    english: expression,
    expression,
    italian: meaning,
    meaning,
    usage: item.usage,
    example: item.example,
    type: item.type,
    source: item.source || 'topic_seed',
    topicPackId: item.topicPackId,
    moduleId: item.moduleId,
    competencyAreaId: item.competencyAreaId,
  };
}

function clearActiveVocabularyLesson(
  state: ConversationRuntimeState,
  preserveProgress = true
): ConversationRuntimeState {
  return {
    ...state,
    activeTopicPackId: undefined,
    activeModuleId: undefined,
    activeCompetencyAreaId: undefined,
    customTopic: undefined,
    selectedLearningItems: [],
    currentLearningItemIndex: 0,
    currentItem: undefined,
    assignedTranslationExercise: undefined,
    exposedItemIds: [],
    currentAttempt: 0,
    waitingFor: 'none',
    lastTeacherAction: 'none',
    ...(preserveProgress
      ? {}
      : {
          completedItemIds: [],
          completedItemCount: 0,
          incorrectItemIds: [],
          sessionVocabulary: [],
        }),
  };
}

function enterTopicSelection(state: ConversationRuntimeState): ConversationRuntimeState {
  return {
    ...clearActiveVocabularyLesson(state),
    learningMode: 'learn_new_vocabulary',
    contentSource: 'internal_topic_curriculum',
    activityPhase: 'select_topic',
    lessonStep: 'select_topic',
    topic: 'Impara nuove parole',
    activityStatus: 'waiting_for_user',
    exerciseStatus: 'active',
    pendingAction: {
      type: 'awaiting_topic_selection',
      createdAt: Date.now(),
    },
    activityMenuStatus: 'completed',
  };
}

function isSimpleGreeting(normText: string): boolean {
  return [
    'ciao',
    'buongiorno',
    'buonasera',
    'salve',
    'hello',
    'hi',
    'hey',
    'hey ciao',
  ].includes(normText);
}

function isFiveItemPreviewRequest(normText: string): boolean {
  const mentionsList = /\b(elenco|lista|mostra|fammi vedere|quali)\b/.test(normText);
  const mentionsFive = /\b(5|cinque|five)\b/.test(normText);
  const mentionsVocabulary = /\b(parol|vocab|espression|phrasal)\w*/.test(normText);
  return mentionsList && mentionsFive && mentionsVocabulary;
}

async function buildPreviewResult(params: {
  turnId: string;
  state: ConversationRuntimeState;
  knowledgeDocs: KnowledgeDocument[];
  userLevel: UserLevel;
}): Promise<TurnRoutingResult | undefined> {
  const { turnId, state, knowledgeDocs, userLevel } = params;
  if (!state.activeTopicPackId || !state.activeModuleId) return undefined;

  const { excludedExpressionKeys } = await buildCompleteExclusionSet({
    knowledgeDocs,
    learningRuntimeState: state,
    packId: state.activeTopicPackId,
    moduleId: state.activeModuleId,
  });

  let candidates = selectNewVocabularyItems({
    packId: state.activeTopicPackId,
    moduleId: state.activeModuleId,
    competencyAreaId: state.activeCompetencyAreaId,
    cefrLevel: userLevel,
    targetCount: 5,
    excludedExpressionsSet: excludedExpressionKeys,
  }).filter((item) => isValidNewTargetItem(item, excludedExpressionKeys));

  if (candidates.length < 5) {
    const generated = await generateCustomTopicItems({
      topic: state.topic || 'inglese pratico',
      cefrLevel: userLevel,
      targetCount: 5 - candidates.length,
      excludedExpressionsSet: new Set([
        ...excludedExpressionKeys,
        ...candidates.map((item) => (item.expression || item.english || '').toLowerCase()),
      ]),
    });
    candidates = [...candidates, ...generated].slice(0, 5);
  }

  const unique = Array.from(
    new Map(
      candidates
        .filter((item) => item.expression || item.english)
        .map((item) => [(item.expression || item.english || '').toLowerCase(), item])
    ).values()
  ).slice(0, 5);

  if (!unique.length) {
    return {
      turnId,
      consumed: true,
      outcome: 'control_intent',
      nextRuntimeState: state,
      userFacingText: 'Non ho trovato cinque elementi realmente nuovi e già validati per questo modulo. Manteniamo il target attuale senza usare parole presenti nei tuoi materiali.',
      explanation: 'Preview bloccata perché nessun candidato ha superato le esclusioni.',
    };
  }

  const text = unique
    .map((item, index) => `${index + 1}. ${item.expression || item.english}${item.meaning || item.italian ? `, ${item.meaning || item.italian}` : ''}`)
    .join('\n');

  return {
    turnId,
    consumed: true,
    outcome: 'control_intent',
    nextRuntimeState: state,
    userFacingText: `Questi sono cinque possibili elementi futuri, tutti filtrati rispetto ai tuoi materiali:\n${text}`,
    explanation: 'Preview prodotta esclusivamente da candidati selezionati e validati dall’applicazione.',
  };
}

async function startLessonFromResolution(params: {
  turnId: string;
  resolution: CurriculumResolution;
  baseState: ConversationRuntimeState;
  knowledgeDocs: KnowledgeDocument[];
  userLevel: UserLevel;
}): Promise<TurnRoutingResult> {
  const { turnId, resolution, baseState, knowledgeDocs, userLevel } = params;

  if (resolution.type === 'ambiguous') {
    return {
      turnId,
      consumed: true,
      outcome: 'curriculum_needs_choice',
      nextRuntimeState: {
        ...baseState,
        activityPhase: 'select_topic',
        lessonStep: 'select_topic',
        currentItem: undefined,
        pendingAction: {
          type: 'awaiting_topic_selection',
          candidateOptions: (resolution.candidateOptions || []).map((option) => ({ id: option.id, title: option.title })),
          createdAt: Date.now(),
        },
      },
      userFacingText: clarificationText(resolution),
      explanation: resolution.explanation,
    };
  }

  if (resolution.type === 'unclear_choice' || resolution.type === 'activity_only' || resolution.type === 'not_found') {
    const state = enterTopicSelection(baseState);
    return {
      turnId,
      consumed: true,
      outcome: 'curriculum_needs_choice',
      nextRuntimeState: state,
      modelActionPrompt: resolution.type === 'unclear_choice' ? undefined : TOPIC_OVERVIEW_ACTION_PROMPT,
      userFacingText: resolution.type === 'unclear_choice'
        ? 'Possiamo partire da vita quotidiana, conversazioni sociali oppure viaggi. Quale ti ispira di più?'
        : topicOverviewText(),
      explanation: resolution.explanation,
    };
  }

  if (resolution.type === 'needs_module' && resolution.pack) {
    const state: ConversationRuntimeState = {
      ...clearActiveVocabularyLesson(baseState),
      learningMode: 'learn_new_vocabulary',
      contentSource: 'internal_topic_curriculum',
      activityPhase: 'select_module',
      lessonStep: 'select_module',
      activeTopicPackId: resolution.pack.id,
      topic: resolution.pack.title,
      pendingAction: {
        type: 'awaiting_module_selection',
        candidateTopicPackId: resolution.pack.id,
        candidateOptions: (resolution.candidateOptions || []).map((option) => ({ id: option.id, title: option.title })),
        createdAt: Date.now(),
      },
      activityStatus: 'waiting_for_user',
    };
    return {
      turnId,
      consumed: true,
      outcome: 'curriculum_needs_choice',
      nextRuntimeState: state,
      userFacingText: moduleOverviewText(resolution),
      explanation: resolution.explanation,
    };
  }

  if (resolution.type === 'resolved' && resolution.pack && resolution.module) {
    const { pack, module, competencyArea } = resolution;
    const preparedState: ConversationRuntimeState = {
      ...clearActiveVocabularyLesson(baseState),
      learningMode: 'learn_new_vocabulary',
      contentSource: 'internal_topic_curriculum',
      activityPhase: 'preparing_lesson',
      lessonStep: 'present_target',
      activeTopicPackId: pack.id,
      activeModuleId: module.id,
      activeCompetencyAreaId: competencyArea?.id,
      topic: module.title,
      pendingAction: undefined,
      activityStatus: 'introducing',
    };

    const { excludedExpressionKeys } = await buildCompleteExclusionSet({
      knowledgeDocs,
      learningRuntimeState: preparedState,
      packId: pack.id,
      moduleId: module.id,
    });

    let selectedItems = selectNewVocabularyItems({
      packId: pack.id,
      moduleId: module.id,
      competencyAreaId: competencyArea?.id,
      cefrLevel: userLevel,
      excludedExpressionsSet: excludedExpressionKeys,
    }).filter((item) => isValidNewTargetItem(item, excludedExpressionKeys));

    if (!selectedItems.length) {
      selectedItems = (await generateCustomTopicItems({
        topic: module.title,
        cefrLevel: userLevel,
        excludedExpressionsSet: excludedExpressionKeys,
      })).filter((item) => isValidNewTargetItem(item, excludedExpressionKeys));
    }

    const firstItem = selectedItems[0];
    if (!firstItem) {
      return {
        turnId,
        consumed: true,
        outcome: 'rejected',
        nextRuntimeState: {
          ...preparedState,
          activityPhase: 'select_module',
          lessonStep: 'select_module',
          currentItem: undefined,
          selectedLearningItems: [],
          activityStatus: 'waiting_for_user',
        },
        userFacingText: 'Per questo modulo non ho trovato elementi realmente nuovi dopo il controllo dei tuoi materiali. Scegliamo un altro modulo o un argomento diverso.',
        explanation: 'Nessun target ha superato l’exclusion set. Gemini non è autorizzato a inventarne uno.',
      };
    }

    const lessonState: ConversationRuntimeState = {
      ...preparedState,
      selectedLearningItems: selectedItems,
      currentLearningItemIndex: 0,
      currentItem: toRuntimeItem(firstItem),
      lessonStep: 'present_target',
      activityPhase: 'presenting_item',
    };

    const lesson = await routeVocabularyLessonTurn({
      userText: '',
      runtimeState: lessonState,
      knowledgeDocs,
      userLevel,
    });

    return {
      turnId,
      consumed: true,
      outcome: 'curriculum_resolved',
      nextRuntimeState: lesson.nextRuntimeState,
      modelActionPrompt: lesson.action.modelActionPrompt,
      userFacingText: lesson.action.userFacingText,
      explanation: `${resolution.explanation} Primo target validato e affidato al controller didattico.`,
    };
  }

  if (resolution.type === 'custom_topic' && resolution.requestedTopic) {
    const requestedTopic = resolution.requestedTopic.trim();
    const preparedState: ConversationRuntimeState = {
      ...clearActiveVocabularyLesson(baseState),
      learningMode: 'learn_new_vocabulary',
      contentSource: 'controlled_custom_topic',
      activityPhase: 'preparing_lesson',
      lessonStep: 'present_target',
      customTopic: requestedTopic,
      topic: requestedTopic,
      activityStatus: 'introducing',
      pendingAction: undefined,
    };

    const { excludedExpressionKeys } = await buildCompleteExclusionSet({
      knowledgeDocs,
      learningRuntimeState: preparedState,
    });
    const selectedItems = (await generateCustomTopicItems({
      topic: requestedTopic,
      cefrLevel: userLevel,
      excludedExpressionsSet: excludedExpressionKeys,
    })).filter((item) => isValidNewTargetItem(item, excludedExpressionKeys));

    const firstItem = selectedItems[0];
    if (!firstItem) {
      return {
        turnId,
        consumed: true,
        outcome: 'rejected',
        nextRuntimeState: {
          ...preparedState,
          activityPhase: 'select_topic',
          lessonStep: 'select_topic',
          currentItem: undefined,
          selectedLearningItems: [],
          activityStatus: 'waiting_for_user',
        },
        userFacingText: `Non sono riuscito a generare elementi affidabili e realmente nuovi per “${requestedTopic}”. Prova a indicare un argomento più specifico o scegli uno dei Topic Pack disponibili.`,
        explanation: 'Generazione custom vuota o completamente esclusa.',
      };
    }

    const normalizedItems = selectedItems.map((item) => ({
      ...item,
      source: 'controlled_custom_topic' as const,
      topicPackId: 'custom_topic',
      moduleId: requestedTopic,
    }));
    const lessonState: ConversationRuntimeState = {
      ...preparedState,
      selectedLearningItems: normalizedItems,
      currentLearningItemIndex: 0,
      currentItem: toRuntimeItem(normalizedItems[0]),
      activityPhase: 'presenting_item',
      lessonStep: 'present_target',
    };
    const lesson = await routeVocabularyLessonTurn({
      userText: '',
      runtimeState: lessonState,
      knowledgeDocs,
      userLevel,
    });

    return {
      turnId,
      consumed: true,
      outcome: 'curriculum_resolved',
      nextRuntimeState: lesson.nextRuntimeState,
      modelActionPrompt: lesson.action.modelActionPrompt,
      userFacingText: lesson.action.userFacingText,
      explanation: `Argomento personalizzato “${requestedTopic}” avviato con target validato.`,
    };
  }

  return {
    turnId,
    consumed: true,
    outcome: 'rejected',
    nextRuntimeState: enterTopicSelection(baseState),
    modelActionPrompt: TOPIC_OVERVIEW_ACTION_PROMPT,
    userFacingText: topicOverviewText(),
    explanation: 'Risoluzione curricolare non gestita, recupero in select_topic.',
  };
}

export const handleUserTurn = (input: UserTurnInput) => orchestrateCommittedUserTurn(input);

/**
 * One authoritative router for committed voice and text turns.
 * Application state is resolved before any ordinary model send.
 */
export async function orchestrateCommittedUserTurn(input: UserTurnInput): Promise<TurnRoutingResult> {
  const {
    turnId,
    text,
    runtimeState,
    knowledgeDocs = [],
    userLevel = 'B1_B2',
  } = input;
  const normText = normalizeInput(text);

  if (processedTurnIds.has(turnId)) {
    return {
      turnId,
      consumed: true,
      outcome: 'rejected',
      nextRuntimeState: runtimeState,
      explanation: `Turno duplicato “${turnId}” scartato.`,
    };
  }
  processedTurnIds.add(turnId);
  if (processedTurnIds.size > 250) {
    Array.from(processedTurnIds).slice(0, 75).forEach((id) => processedTurnIds.delete(id));
  }

  const validation = validateConversationRuntime(runtimeState);
  const currentState = validation.valid
    ? runtimeState
    : validation.recoveredState || runtimeState;

  let nextState: ConversationRuntimeState = {
    ...currentState,
    currentTurnId: turnId,
    lastCommittedUserTurnId: turnId,
    stateRevision: currentState.stateRevision + 1,
    updatedAt: new Date().toISOString(),
  };

  const intent = detectActivityIntent(text);
  const greeting = isSimpleGreeting(normText);

  if (intent.intent === 'stop') {
    nextState = {
      ...nextState,
      activityStatus: 'paused',
      exerciseStatus: 'stopped',
    };
    return {
      turnId,
      consumed: true,
      outcome: 'global_command',
      nextRuntimeState: nextState,
      userFacingText: 'Ho messo in pausa l’attività. Usa “Termina sessione” per chiuderla senza salvarla oppure scegli un’altra attività.',
      explanation: 'Comando globale di stop consumato senza salvataggio automatico.',
    };
  }

  if (intent.intent === 'show_activity_menu' || intent.intent === 'change_activity') {
    nextState = {
      ...clearActiveVocabularyLesson(nextState),
      learningMode: 'activity_selection',
      contentSource: 'system_preset',
      activityPhase: 'select_activity',
      lessonStep: 'select_activity',
      topic: 'Selezione attività',
      activityStatus: 'waiting_for_user',
      activityMenuStatus: 'waiting_for_choice',
      pendingAction: undefined,
    };
    return {
      turnId,
      consumed: true,
      outcome: 'global_command',
      nextRuntimeState: nextState,
      userFacingText: activityMenuText(),
      explanation: 'Menu attività richiesto esplicitamente.',
    };
  }

  if (currentState.learningMode === 'activity_selection' && greeting) {
    const menuAlreadyPresented = currentState.activityMenuStatus === 'waiting_for_choice';
    nextState.activityMenuStatus = 'waiting_for_choice';
    nextState.activityPhase = 'select_activity';
    nextState.lessonStep = 'select_activity';
    return {
      turnId,
      consumed: true,
      outcome: 'global_command',
      nextRuntimeState: nextState,
      userFacingText: menuAlreadyPresented ? shortMenuAcknowledgement() : activityMenuText(),
      explanation: menuAlreadyPresented
        ? 'Saluto riconosciuto senza duplicare il panorama delle attività.'
        : 'Primo saluto della sessione con panorama attività.',
    };
  }

  if (intent.intent === 'resume_suspended_lesson' && currentState.suspendedLearningState) {
    const suspended = currentState.suspendedLearningState as ConversationRuntimeState;
    nextState = {
      ...suspended,
      appSessionId: currentState.appSessionId,
      stateRevision: nextState.stateRevision,
      currentTurnId: turnId,
      lastCommittedUserTurnId: turnId,
      suspendedLearningState: undefined,
      updatedAt: new Date().toISOString(),
    };
    if (nextState.learningMode === 'learn_new_vocabulary' && nextState.currentItem) {
      const lesson = await routeVocabularyLessonTurn({
        userText: '',
        runtimeState: nextState,
        knowledgeDocs,
        userLevel,
      });
      return {
        turnId,
        consumed: true,
        outcome: 'global_command',
        nextRuntimeState: lesson.nextRuntimeState,
        modelActionPrompt: lesson.action.modelActionPrompt,
        userFacingText: lesson.action.userFacingText,
        explanation: 'Lezione sospesa ripristinata dal controller didattico.',
      };
    }
    return {
      turnId,
      consumed: true,
      outcome: 'global_command',
      nextRuntimeState: nextState,
      userFacingText: 'Riprendiamo da dove ci eravamo fermati.',
      explanation: 'Stato sospeso ripristinato.',
    };
  }

  // Current activity state machine has priority over a generic classifier.
  if (currentState.learningMode === 'learn_new_vocabulary') {
    // An explicit request for new vocabulary with a new topic is a curriculum switch,
    // not an attempted translation of the current Italian sentence.
    if (intent.intent === 'learn_new_vocabulary') {
      const topicSwitchResolution = resolveCurriculumSelection({
        userText: text,
        currentPhase: 'select_topic',
      });
      return startLessonFromResolution({
        turnId,
        resolution: topicSwitchResolution,
        baseState: enterTopicSelection(nextState),
        knowledgeDocs,
        userLevel,
      });
    }

    if (isFiveItemPreviewRequest(normText)) {
      const preview = await buildPreviewResult({
        turnId,
        state: nextState,
        knowledgeDocs,
        userLevel,
      });
      if (preview) return preview;
    }

    if (
      currentState.currentItem &&
      ['presenting_item', 'waiting_for_answer', 'correcting', 'clarifying'].includes(currentState.activityPhase)
    ) {
      const lesson = await routeVocabularyLessonTurn({
        userText: text,
        runtimeState: nextState,
        knowledgeDocs,
        userLevel,
      });
      return {
        turnId,
        consumed: true,
        outcome: 'exercise_turn',
        nextRuntimeState: lesson.nextRuntimeState,
        modelActionPrompt: lesson.action.modelActionPrompt,
        userFacingText: lesson.action.userFacingText,
        explanation: `Turno didattico consumato dal controller: ${lesson.action.type}.`,
      };
    }

    if (currentState.activityPhase === 'select_topic' || currentState.activityPhase === 'select_module' || !currentState.currentItem) {
      const resolution = resolveCurriculumSelection({
        userText: text,
        currentPhase: currentState.activityPhase,
        activeTopicPackId: currentState.activeTopicPackId,
      });
      return startLessonFromResolution({
        turnId,
        resolution,
        baseState: nextState,
        knowledgeDocs,
        userLevel,
      });
    }
  }

  if (intent.intent === 'free_conversation') {
    nextState = {
      ...clearActiveVocabularyLesson(nextState),
      learningMode: 'free_conversation',
      contentSource: 'system_preset',
      activityPhase: 'free_conversation',
      topic: 'Conversazione libera',
      activityStatus: 'waiting_for_user',
      activityMenuStatus: 'completed',
    };
    return {
      turnId,
      consumed: true,
      outcome: 'activity_transition',
      nextRuntimeState: nextState,
      modelActionPrompt: 'Avvia una conversazione libera naturale e fai una sola domanda in inglese, adeguata al livello dello studente.',
      explanation: 'Transizione a conversazione libera.',
    };
  }

  if (intent.intent === 'knowledge_review') {
    nextState = {
      ...clearActiveVocabularyLesson(nextState),
      learningMode: 'knowledge_review',
      contentSource: 'personal_materials',
      activityPhase: 'reviewing_material',
      topic: 'Ripassa le tue parole',
      activityStatus: 'introducing',
      activityMenuStatus: 'completed',
    };
    const { items } = buildUnifiedMaterialReviewIndex(knowledgeDocs);
    const knowledgeText = items
      .map((item) => `- ${item.english}: ${item.italian || ''}`)
      .join('\n');
    return {
      turnId,
      consumed: true,
      outcome: 'activity_transition',
      nextRuntimeState: nextState,
      modelActionPrompt: 'Avvia il ripasso utilizzando esclusivamente gli elementi forniti dall’applicazione nei Materiali.',
      knowledgeText,
      explanation: 'Transizione al ripasso dei Materiali.',
    };
  }

  if (intent.intent === 'learning_games') {
    nextState = {
      ...clearActiveVocabularyLesson(nextState),
      learningMode: 'learning_games',
      contentSource: 'system_preset',
      activityPhase: 'playing_game',
      topic: 'Giochi linguistici',
      activityStatus: 'introducing',
      activityMenuStatus: 'completed',
    };
    return {
      turnId,
      consumed: true,
      outcome: 'activity_transition',
      nextRuntimeState: nextState,
      modelActionPrompt: 'Presenta un gioco linguistico adatto al livello e impartisci una sola istruzione alla volta.',
      explanation: 'Transizione ai giochi linguistici.',
    };
  }

  if (intent.intent === 'learn_new_vocabulary') {
    const entryState = enterTopicSelection(nextState);
    const resolution = resolveCurriculumSelection({
      userText: text,
      currentPhase: 'select_topic',
    });
    if (resolution.type === 'activity_only' || resolution.type === 'not_found') {
      return {
        turnId,
        consumed: true,
        outcome: 'activity_transition',
        nextRuntimeState: entryState,
        modelActionPrompt: TOPIC_OVERVIEW_ACTION_PROMPT,
        userFacingText: topicOverviewText(),
        explanation: 'Modalità nuove parole attivata senza topic: select_topic obbligatorio.',
      };
    }
    return startLessonFromResolution({
      turnId,
      resolution,
      baseState: entryState,
      knowledgeDocs,
      userLevel,
    });
  }

  return {
    turnId,
    consumed: false,
    outcome: 'conversational_turn',
    nextRuntimeState: nextState,
    explanation: 'Turno ordinario: può essere inviato al modello attivo una sola volta.',
  };
}
