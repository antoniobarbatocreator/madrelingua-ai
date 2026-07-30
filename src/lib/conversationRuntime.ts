import { LearningMode, ContentSource, LessonStep, TopicLessonItem, LearningRuntimeState } from '../types/learningSession';

export type ConversationActivityPhase =
  | 'select_activity'
  | 'select_topic'
  | 'select_module'
  | 'select_competency'
  | 'preparing_lesson'
  | 'presenting_item'
  | 'waiting_for_answer'
  | 'correcting'
  | 'clarifying'
  | 'playing_game'
  | 'free_conversation'
  | 'reviewing_material'
  | 'switching_activity'
  | 'recovering';

export type PendingActionType =
  | 'confirm_topic'
  | 'confirm_module'
  | 'confirm_competency'
  | 'confirm_switch'
  | 'confirm_resume'
  | 'confirm_stop'
  | 'awaiting_answer'
  | 'awaiting_clarification'
  | 'awaiting_topic_selection'
  | 'awaiting_module_selection';

export interface PendingConversationAction {
  type: PendingActionType;
  promptText?: string;
  candidateTopicPackId?: string;
  candidateModuleId?: string;
  candidateCompetencyAreaId?: string;
  candidateOptions?: Array<{ id: string; title: string }>;
  createdAt: number;
}

export interface ConversationRuntimeState extends LearningRuntimeState {
  activityPhase: ConversationActivityPhase;
  stateRevision: number;
  modeChangedAt: number;
  selectedLearningItems: TopicLessonItem[];
  currentLearningItemIndex: number;
  completedItemIds: string[];
  completedItemCount: number;
}

/**
 * Creates a clean, validated canonical ConversationRuntimeState.
 */
export function createCanonicalRuntimeState(
  appSessionId: string,
  mode: LearningMode = 'activity_selection',
  overrides: Partial<ConversationRuntimeState> = {}
): ConversationRuntimeState {
  const now = Date.now();
  const defaultPhase: ConversationActivityPhase =
    mode === 'activity_selection'
      ? 'select_activity'
      : mode === 'free_conversation'
      ? 'free_conversation'
      : mode === 'knowledge_review'
      ? 'reviewing_material'
      : mode === 'learning_games'
      ? 'playing_game'
      : 'select_topic';

  return {
    schemaVersion: 2,
    appSessionId: appSessionId || `session_${now}`,
    learningMode: mode,
    contentSource: mode === 'knowledge_review' ? 'personal_materials' : mode === 'learn_new_vocabulary' ? 'internal_topic_curriculum' : 'system_preset',
    activityPhase: overrides.activityPhase || defaultPhase,
    lessonStep: overrides.lessonStep,
    activeTopicPackId: overrides.activeTopicPackId,
    activeModuleId: overrides.activeModuleId,
    activeCompetencyAreaId: overrides.activeCompetencyAreaId,
    topic: overrides.topic || (mode === 'activity_selection' ? 'Selezione attività' : 'Conversazione'),
    selectedLearningItems: overrides.selectedLearningItems || [],
    currentLearningItemIndex: overrides.currentLearningItemIndex || 0,
    currentItem: overrides.currentItem,
    assignedTranslationExercise: overrides.assignedTranslationExercise,
    lastTeacherAction: overrides.lastTeacherAction || 'none',
    exposedItemIds: overrides.exposedItemIds || [],
    activityMenuStatus: overrides.activityMenuStatus || (mode === 'activity_selection' ? 'not_presented' : 'completed'),
    completedItemIds: overrides.completedItemIds || [],
    completedItemCount: overrides.completedItemCount || 0,
    incorrectItemIds: overrides.incorrectItemIds || [],
    currentAttempt: overrides.currentAttempt || 0,
    currentTurnId: overrides.currentTurnId,
    lastCommittedUserTurnId: overrides.lastCommittedUserTurnId,
    modeChangedAt: overrides.modeChangedAt || now,
    stateRevision: overrides.stateRevision || 1,
    pendingAction: overrides.pendingAction,
    suspendedLearningState: overrides.suspendedLearningState,
    activityStatus: overrides.activityStatus || 'not_started',
    exerciseStatus: overrides.exerciseStatus || 'active',
    waitingFor: overrides.waitingFor || 'none',
    currentPhase: overrides.currentPhase || 'introduction',
    recentErrors: overrides.recentErrors || [],
    sessionVocabulary: overrides.sessionVocabulary || [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Structural validation and recovery of ConversationRuntimeState.
 * Guarantees that active modes have valid phases and required fields.
 */
export function validateConversationRuntime(state: ConversationRuntimeState): {
  valid: boolean;
  errors: string[];
  recoveredState?: ConversationRuntimeState;
} {
  const errors: string[] = [];

  if (!state.appSessionId) {
    errors.push('Missing appSessionId');
  }
  if (!state.learningMode) {
    errors.push('Missing learningMode');
  }

  // Validate phase coherence with learningMode
  if (state.learningMode === 'activity_selection' && state.activityPhase !== 'select_activity') {
    errors.push(`Incompatible phase '${state.activityPhase}' for activity_selection mode`);
  }

  if (state.learningMode === 'learn_new_vocabulary') {
    if (state.activityPhase === 'presenting_item' || state.activityPhase === 'waiting_for_answer') {
      if (!state.currentItem && (!state.selectedLearningItems || state.selectedLearningItems.length === 0)) {
        errors.push("Phase requires currentItem or selectedLearningItems in learn_new_vocabulary mode");
      }
    }
  }

  if (errors.length === 0) {
    return { valid: true, errors: [] };
  }

  // Recover state structurally if errors are present
  const recoveredState: ConversationRuntimeState = {
    ...state,
    activityPhase:
      state.learningMode === 'activity_selection'
        ? 'select_activity'
        : state.learningMode === 'learn_new_vocabulary' && (!state.activeModuleId || !state.currentItem)
        ? 'select_topic'
        : state.activityPhase || 'select_activity',
    stateRevision: (state.stateRevision || 0) + 1,
    updatedAt: new Date().toISOString(),
  };

  return { valid: false, errors, recoveredState };
}
