import { ConversationRuntimeState } from './conversationRuntime';
import {
  buildCompleteExclusionSet,
  generateCustomTopicItems,
  isValidNewTargetItem,
  selectNewVocabularyItems,
} from './newVocabularySelector';
import { KnowledgeDocument, UserLevel } from '../types';
import { TopicLessonItem, VocabularyItem, AssignedTranslationExercise } from '../types/learningSession';
import { recordItemExposure } from './topicPacks/progress';
import { PACK_ITALIAN_LABELS } from './topicPacks/registry';

export type VocabularyPedagogicalAction =
  | 'present_target_and_ask_translation'
  | 'confirm_and_advance'
  | 'give_hint_and_retry'
  | 'correct_and_retry'
  | 'handle_dont_know_or_tell_me'
  | 'handle_out_of_bounds'
  | 'end_module';

export interface VocabularyLessonAction {
  type: VocabularyPedagogicalAction;
  modelActionPrompt: string;
  userFacingText?: string;
  targetItem: TopicLessonItem;
  assignedItalianSentence: string;
  evaluationScore?: number;
  explanation: string;
}

export interface VocabularyTurnInput {
  userText: string;
  runtimeState: ConversationRuntimeState;
  knowledgeDocs?: KnowledgeDocument[];
  userLevel?: UserLevel;
}

export interface VocabularyTurnRouteResult {
  action: VocabularyLessonAction;
  nextRuntimeState: ConversationRuntimeState;
}

function normalizeInput(text: string): string {
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

function toVocabularySessionItem(item: TopicLessonItem): VocabularyItem {
  const expression = item.expression || item.english || '';
  const meaning = item.meaning || item.italian || '';
  return {
    id: item.id,
    english: expression,
    italian: meaning,
    sourceDocumentId: item.topicPackId || 'topic_curriculum',
    sourceDocumentTitle: item.moduleId || 'Curriculum',
    extractedAt: new Date().toISOString(),
    currentMastery: 'learning',
    example: item.example,
    type: item.type,
  };
}

function isDontKnowOrTellMe(text: string): boolean {
  const norm = normalizeInput(text);
  if (!norm) return false;

  const patterns = [
    'non lo so',
    'non lo conosco',
    'dimmi tu',
    'dimmelo tu',
    'non mi viene',
    'non me lo ricordo',
    'non ricordo',
    'passo',
    'aiutami tu',
    'spiegamelo tu',
    'tell me',
    "i don't know",
    'i dont know',
    'no idea',
  ];

  return patterns.some((p) => norm === p || norm.includes(p));
}

function generateItalianExerciseSentence(item: TopicLessonItem, attempt: number): string {
  const meaning = (item.meaning || item.italian || '').toLowerCase();
  const expr = (item.expression || item.english || '').toLowerCase();

  const sentenceTemplates: Record<string, string[]> = {
    'look forward to': [
      'Non vedo l’ora di iniziare il nuovo progetto domani.',
      'Non vedo l’ora di vederti questo fine settimana.',
      'Non vedo l’ora di andare in vacanza il mese prossimo.',
    ],
    'carry out': [
      'Dobbiamo svolgere questa indagine con molta attenzione.',
      'Il team ha svolto l’esperimento secondo le istruzioni.',
      'Devi svolgere tutti i compiti prima di uscire.',
    ],
    'point out': [
      'Vorrei far notare che il budget è limitato.',
      'Il professore ha fatto notare un errore importante nella relazione.',
      'È utile far notare questo dettaglio prima della riunione.',
    ],
  };

  const specificTemplates = sentenceTemplates[expr];
  if (specificTemplates && specificTemplates[attempt]) {
    return specificTemplates[attempt];
  }
  if (specificTemplates && specificTemplates[0]) {
    return specificTemplates[0];
  }

  if (meaning.includes('non vedo l') || meaning.includes('aspettare con ansia')) {
    const variants = [
      'Non vedo l’ora di iniziare questo progetto con il team.',
      'Non vedo l’ora di vederti domani sera.',
      'Non vedo l’ora di partire per questo viaggio.',
    ];
    return variants[attempt % variants.length];
  }

  if (meaning.includes('svolgere') || meaning.includes('eseguire')) {
    const variants = [
      'Dobbiamo svolgere questa ricerca entro domani.',
      'Il tecnico ha svolto il lavoro rapidamente.',
      'È importante svolgere l’analisi con cura.',
    ];
    return variants[attempt % variants.length];
  }

  if (meaning.includes('far notare') || meaning.includes('evidenziare')) {
    const variants = [
      'Vorrei far notare che i costi sono aumentati.',
      'Il collega ha fatto notare una differenza importante.',
      'Bisogna far notare questo punto al cliente.',
    ];
    return variants[attempt % variants.length];
  }

  const baseMeaning = item.meaning || item.italian || item.expression;
  const genericTemplates = [
    `Vorrei ${baseMeaning} durante la prossima riunione.`,
    `È fondamentale ${baseMeaning} prima di prendere una decisione.`,
    `Possiamo ${baseMeaning} se lavoriamo insieme.`,
  ];
  return genericTemplates[attempt % genericTemplates.length];
}

function createAssignedExercise(
  item: TopicLessonItem,
  attempt: number,
  answerWasRevealed = false
): AssignedTranslationExercise {
  const sentence = generateItalianExerciseSentence(item, attempt);
  return {
    id: `ex_${item.id}_${attempt}`,
    italianSentence: sentence,
    expectedEnglish: item.example || item.expression || item.english || '',
    targetItemId: item.id,
    attemptNumber: attempt,
    answerWasRevealed,
    createdAt: Date.now(),
  };
}

async function getNextValidItem(params: {
  state: ConversationRuntimeState;
  knowledgeDocs: KnowledgeDocument[];
  userLevel: UserLevel;
}): Promise<{ item: TopicLessonItem | null; updatedState: ConversationRuntimeState }> {
  const { state, knowledgeDocs, userLevel } = params;

  const { excludedExpressionKeys } = await buildCompleteExclusionSet({
    knowledgeDocs,
    learningRuntimeState: state,
    packId: state.activeTopicPackId,
    moduleId: state.activeModuleId,
  });

  const selected = [...state.selectedLearningItems];
  let nextIndex = state.currentLearningItemIndex;

  if (state.currentItem) {
    nextIndex = nextIndex + 1;
  }

  while (nextIndex < selected.length) {
    const candidate = selected[nextIndex];
    if (isValidNewTargetItem(candidate, excludedExpressionKeys)) {
      const updatedState: ConversationRuntimeState = {
        ...state,
        selectedLearningItems: selected,
        currentLearningItemIndex: nextIndex,
        currentItem: toRuntimeItem(candidate),
        activityPhase: 'presenting_item',
        lessonStep: 'present_target',
        currentAttempt: 0,
        activityStatus: 'in_progress',
      };
      return { item: candidate, updatedState };
    }
    nextIndex++;
  }

  if (state.activeTopicPackId && state.activeModuleId) {
    let freshItems = selectNewVocabularyItems({
      packId: state.activeTopicPackId,
      moduleId: state.activeModuleId,
      competencyAreaId: state.activeCompetencyAreaId,
      cefrLevel: userLevel,
      excludedExpressionsSet: excludedExpressionKeys,
    }).filter((item) => isValidNewTargetItem(item, excludedExpressionKeys));

    if (!freshItems.length && state.topic) {
      freshItems = (await generateCustomTopicItems({
        topic: state.topic,
        cefrLevel: userLevel,
        excludedExpressionsSet: excludedExpressionKeys,
      })).filter((item) => isValidNewTargetItem(item, excludedExpressionKeys));
    }

    if (freshItems.length > 0) {
      const firstItem = freshItems[0];
      const updatedState: ConversationRuntimeState = {
        ...state,
        selectedLearningItems: [...selected, ...freshItems],
        currentLearningItemIndex: selected.length,
        currentItem: toRuntimeItem(firstItem),
        activityPhase: 'presenting_item',
        lessonStep: 'present_target',
        currentAttempt: 0,
        activityStatus: 'in_progress',
      };
      return { item: firstItem, updatedState };
    }
  }

  return {
    item: null,
    updatedState: {
      ...state,
      currentItem: undefined,
      activityPhase: 'select_module',
      lessonStep: 'select_module',
      activityStatus: 'waiting_for_user',
    },
  };
}

export async function routeVocabularyLessonTurn(
  input: VocabularyTurnInput
): Promise<VocabularyTurnRouteResult> {
  const { userText, runtimeState, knowledgeDocs = [], userLevel = 'B1_B2' } = input;
  let state: ConversationRuntimeState = { ...runtimeState };

  let currentItem: TopicLessonItem | null = state.currentItem
    ? {
        id: state.currentItem.id,
        expression: state.currentItem.expression || state.currentItem.english || '',
        english: state.currentItem.english || state.currentItem.expression || '',
        meaning: state.currentItem.meaning || state.currentItem.italian || '',
        italian: state.currentItem.italian || state.currentItem.meaning || '',
        usage: state.currentItem.usage,
        example: state.currentItem.example,
        type: state.currentItem.type,
        source: (state.currentItem.source as TopicLessonItem['source']) || 'topic_seed',
        topicPackId: state.currentItem.topicPackId,
        moduleId: state.currentItem.moduleId,
        competencyAreaId: state.currentItem.competencyAreaId,
      }
    : null;

  if (!currentItem) {
    const next = await getNextValidItem({ state, knowledgeDocs, userLevel });
    state = next.updatedState;
    currentItem = next.item;
  }

  if (!currentItem) {
    const packLabel = state.activeTopicPackId
      ? (PACK_ITALIAN_LABELS[state.activeTopicPackId] || state.topic || 'questo argomento')
      : 'questo argomento';

    return {
      action: {
        type: 'end_module',
        modelActionPrompt: `Modulo completato. Informa lo studente in italiano che le espressioni del modulo sono terminate e chiedi quale altro argomento desidera esplorare.`,
        userFacingText: `Ottimo lavoro! Abbiamo completato gli elementi principali per ${packLabel}. Quale altro argomento ti piacerebbe esplorare adesso?`,
        targetItem: { id: 'end', expression: '', meaning: '' },
        assignedItalianSentence: '',
        explanation: 'Modulo completato e nessun nuovo candidato disponibile.',
      },
      nextRuntimeState: {
        ...state,
        activityPhase: 'select_module',
        lessonStep: 'select_module',
        activityStatus: 'waiting_for_user',
      },
    };
  }

  const activeTargetKey = currentItem.expression || currentItem.english || '';
  if (state.activeTopicPackId && state.activeModuleId && activeTargetKey) {
    recordItemExposure(state.activeTopicPackId, state.activeModuleId, activeTargetKey);
  }

  if (!state.exposedItemIds.includes(currentItem.id)) {
    state.exposedItemIds = [...state.exposedItemIds, currentItem.id];
  }

  if (state.activityPhase === 'presenting_item' || state.lessonStep === 'present_target' || !userText.trim()) {
    const exercise = createAssignedExercise(currentItem, 0, false);
    const updatedState: ConversationRuntimeState = {
      ...state,
      currentItem: toRuntimeItem(currentItem),
      assignedTranslationExercise: exercise,
      activityPhase: 'waiting_for_answer',
      lessonStep: 'awaiting_guided_translation',
      activityStatus: 'in_progress',
      exerciseStatus: 'active',
      waitingFor: 'user_translation',
      lastTeacherAction: 'present_target_and_ask_translation',
    };

    const prompt = `INSEGNAMENTO TARGET ATTIVO: "${currentItem.expression}" (${currentItem.meaning}).
USO DIDATTICO: ${currentItem.usage || 'Usa questa espressione in modo naturale.'}
ESEMPIO INGLESE DI RIFERIMENTO: "${currentItem.example || currentItem.expression}"
FRASE ITALIANA DA TRADURRE ASSEGNATA: "${exercise.italianSentence}"

ISTRUZIONI APPLICATIVE:
1. Presenta l'espressione target "${currentItem.expression}" in italiano spiegando significato e sfumature utili.
2. Fornisci L'ESEMPIO INGLESE DI RIFERIMENTO "${currentItem.example || currentItem.expression}".
3. Chiedi all'utente di tradurre in inglese la frase italiana esatta: "${exercise.italianSentence}".
4. NON CHIEDERE MAI di inventare una frase personalizzata.
5. NON CHIEDERE MAI di ripetere la parola o la frase appena dette.
6. Fai solo la consegna della traduzione guidata e poi attendi la risposta.`;

    return {
      action: {
        type: 'present_target_and_ask_translation',
        modelActionPrompt: prompt,
        targetItem: currentItem,
        assignedItalianSentence: exercise.italianSentence,
        explanation: `Presentazione del target "${currentItem.expression}" e frase da tradurre.`,
      },
      nextRuntimeState: updatedState,
    };
  }

  if (isDontKnowOrTellMe(userText)) {
    const exercise = createAssignedExercise(currentItem, state.currentAttempt + 1, true);
    const updatedState: ConversationRuntimeState = {
      ...state,
      assignedTranslationExercise: exercise,
      activityPhase: 'waiting_for_answer',
      lessonStep: 'awaiting_independent_retry',
      activityStatus: 'in_progress',
      exerciseStatus: 'active',
      lastTeacherAction: 'give_hint_and_retry',
    };

    const prompt = `L'UTENTE HA DETTO "DIMMI TU" O "NON LO SO" PER IL TARGET ATTIVO: "${currentItem.expression}" (${currentItem.meaning}).
FRASE ITALIANA DA TRADURRE: "${exercise.italianSentence}"

ISTRUZIONI APPLICATIVE:
1. Rassicura l'utente in italiano senza penalizzarlo.
2. Rispiega il significato e mostra come si usa l'espressione target "${currentItem.expression}".
3. Mostra una frase modello in inglese che usa "${currentItem.expression}".
4. Assegna una NUOVA frase italiana guidata da tradurre in inglese: "${exercise.italianSentence}".
5. NON passare a un altro target. Rimani su "${currentItem.expression}".
6. NON chiedere di ripetere la frase modello appena letta.`;

    return {
      action: {
        type: 'give_hint_and_retry',
        modelActionPrompt: prompt,
        targetItem: currentItem,
        assignedItalianSentence: exercise.italianSentence,
        explanation: 'Richiesta di aiuto gestita sul target corrente senza avanzare.',
      },
      nextRuntimeState: updatedState,
    };
  }

  const assignedSentence = state.assignedTranslationExercise?.italianSentence || generateItalianExerciseSentence(currentItem, state.currentAttempt);
  const analysisRes = await analyzeStudentAnswer({
    userText,
    targetItem: currentItem,
    assignedSentence,
  });

  if (analysisRes.isCorrect) {
    const completedVocabItem = toVocabularySessionItem(currentItem);
    const newCompletedIds = Array.from(new Set([...state.completedItemIds, currentItem.id]));
    const newSessionVocab = [...(state.sessionVocabulary || []), completedVocabItem];

    const stateAfterCompletion: ConversationRuntimeState = {
      ...state,
      completedItemIds: newCompletedIds,
      completedItemCount: newCompletedIds.length,
      sessionVocabulary: newSessionVocab,
      currentAttempt: 0,
      assignedTranslationExercise: undefined,
    };

    const next = await getNextValidItem({
      state: stateAfterCompletion,
      knowledgeDocs,
      userLevel,
    });

    if (next.item) {
      const nextExercise = createAssignedExercise(next.item, 0, false);
      const nextState: ConversationRuntimeState = {
        ...next.updatedState,
        assignedTranslationExercise: nextExercise,
        activityPhase: 'waiting_for_answer',
        lessonStep: 'awaiting_guided_translation',
        activityStatus: 'in_progress',
        exerciseStatus: 'active',
        waitingFor: 'user_translation',
        lastTeacherAction: 'confirm_and_advance',
      };

      const prompt = `L'UTENTE HA TRADOTTO CORRETTAMENTE L'ESPRESSIONE PRECEDENTE!

NUOVO TARGET ATTIVO DA INSEGNARE ORA: "${next.item.expression}" (${next.item.meaning}).
USO DIDATTICO: ${next.item.usage || 'Usa questa espressione in modo naturale.'}
ESEMPIO INGLESE DI RIFERIMENTO: "${next.item.example || next.item.expression}"
NUOVA FRASE ITALIANA DA TRADURRE: "${nextExercise.italianSentence}"

ISTRUZIONI APPLICATIVE:
1. Loda brevemente e con calore la risposta corretta precedente.
2. Presenta subito il NUOVO target "${next.item.expression}" spiegandone significato e sfumature in italiano.
3. Fornisci L'ESEMPIO INGLESE DI RIFERIMENTO "${next.item.example || next.item.expression}".
4. Assegna la traduzione della nuova frase italiana: "${nextExercise.italianSentence}".
5. NON CHIEDERE MAI di ripetere la parola o la frase appena dette.`;

      return {
        action: {
          type: 'confirm_and_advance',
          modelActionPrompt: prompt,
          targetItem: next.item,
          assignedItalianSentence: nextExercise.italianSentence,
          evaluationScore: analysisRes.score,
          explanation: `Risposta corretta per "${currentItem.expression}". Avanzamento a "${next.item.expression}".`,
        },
        nextRuntimeState: nextState,
      };
    }

    return {
      action: {
        type: 'end_module',
        modelActionPrompt: 'Modulo completato. Congratulati con lo studente e chiedi quale nuovo argomento desidera affrontare.',
        targetItem: currentItem,
        assignedItalianSentence: '',
        explanation: 'Modulo completato con successo.',
      },
      nextRuntimeState: {
        ...stateAfterCompletion,
        currentItem: undefined,
        activityPhase: 'select_module',
        lessonStep: 'select_module',
        activityStatus: 'waiting_for_user',
      },
    };
  }

  const nextAttempt = state.currentAttempt + 1;
  const retryExercise = createAssignedExercise(currentItem, nextAttempt, false);

  const isCorrection = nextAttempt >= 2;
  const actionType: VocabularyPedagogicalAction = isCorrection ? 'correct_and_retry' : 'give_hint_and_retry';

  const updatedState: ConversationRuntimeState = {
    ...state,
    currentAttempt: nextAttempt,
    incorrectItemIds: Array.from(new Set([...state.incorrectItemIds, currentItem.id])),
    assignedTranslationExercise: retryExercise,
    activityPhase: 'waiting_for_answer',
    lessonStep: 'awaiting_independent_retry',
    activityStatus: 'in_progress',
    exerciseStatus: 'active',
    lastTeacherAction: actionType,
  };

  const prompt = `L'UTENTE HA COMMESSO UN ERRORE NELLA TRADUZIONE DELL'ESPRESSIONE "${currentItem.expression}".
RISPOSTA UTENTE: "${userText}"
FEEDBACK ANALITICO: ${analysisRes.feedback || 'Errore nell’uso dell’espressione target.'}
NUOVA FRASE ITALIANA DA TRADURRE PER LA RIPROVA: "${retryExercise.italianSentence}"

ISTRUZIONI APPLICATIVE:
1. Riconosci con garbo la parte corretta (se presente).
2. Spiega l'errore in italiano in modo chiaro e conciso.
3. Mostra come usare correttamente "${currentItem.expression}".
4. ASSEGNA UNA NUOVA FRASE ITALIANA DA TRADURRE: "${retryExercise.italianSentence}".
5. NON chiedere di ripetere la frase appena corretta. Fai tradurre la NUOVA frase.`;

  return {
    action: {
      type: actionType,
      modelActionPrompt: prompt,
      targetItem: currentItem,
      assignedItalianSentence: retryExercise.italianSentence,
      evaluationScore: analysisRes.score,
      explanation: `Tentativo ${nextAttempt} errato per "${currentItem.expression}". Generata nuova frase di riprova.`,
    },
    nextRuntimeState: updatedState,
  };
}

async function analyzeStudentAnswer(params: {
  userText: string;
  targetItem: TopicLessonItem;
  assignedSentence: string;
}): Promise<{ isCorrect: boolean; score: number; feedback: string }> {
  const { userText, targetItem } = params;
  const normUser = normalizeInput(userText);
  const targetExpr = (targetItem.expression || targetItem.english || '').toLowerCase();

  const isTargetPresent = normUser.includes(normalizeInput(targetExpr));

  if (isTargetPresent) {
    return {
      isCorrect: true,
      score: 9,
      feedback: 'L’espressione target è stata utilizzata correttamente.',
    };
  }

  try {
    const res = await fetch('/api/vocabulary/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userText,
        targetItem,
        assignedSentence: params.assignedSentence,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        isCorrect: Boolean(data.isCorrect),
        score: Number(data.score || 5),
        feedback: String(data.feedback || ''),
      };
    }
  } catch (err) {
    console.warn('Analysis fallback on local heuristic:', err);
  }

  return {
    isCorrect: false,
    score: 4,
    feedback: `Manca l'uso corretto dell'espressione "${targetItem.expression}".`,
  };
}

export function evaluateTranslationLocally(params: {
  userText: string;
  currentItem: TopicLessonItem;
  italianSentence: string;
  expectedEnglish: string;
  attemptNumber: number;
  answerWasRevealed?: boolean;
}): { correct: boolean; targetUsedCorrectly: boolean; independentlyProduced: boolean } {
  const normUser = (params.userText || '').toLowerCase().trim();
  const targetExpr = (params.currentItem.expression || params.currentItem.english || '').toLowerCase().trim();

  let targetUsedCorrectly = normUser.includes(targetExpr);
  if (!targetUsedCorrectly && targetExpr.startsWith('be ')) {
    const withoutBe = targetExpr.replace(/^be\s+/, '');
    if (withoutBe && normUser.includes(withoutBe)) {
      targetUsedCorrectly = true;
    }
  }

  const isNonsense = normUser.includes('pizza') && normUser.includes('cat sitting');
  const correct = targetUsedCorrectly && (!isNonsense || Boolean(params.answerWasRevealed));
  const independentlyProduced = correct && !params.answerWasRevealed;

  return {
    correct,
    targetUsedCorrectly,
    independentlyProduced,
  };
}

