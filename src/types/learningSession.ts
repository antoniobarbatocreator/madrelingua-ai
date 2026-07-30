export type SessionStartReason =
  | 'fresh_session'
  | 'explicit_resume'
  | 'technical_reconnect'
  | 'activity_switch';

export type LearningMode =
  | 'activity_selection'
  | 'learn_new_vocabulary'
  | 'knowledge_review'
  | 'learning_games'
  | 'free_conversation'
  | 'topic_exploration';

export type ContentSource =
  | 'system_preset'
  | 'internal_topic_curriculum'
  | 'controlled_custom_topic'
  | 'personal_materials'
  | 'none';

export type LessonStep =
  | 'select_activity'
  | 'select_topic'
  | 'select_module'
  | 'present_target'
  | 'await_translation'
  | 'awaiting_guided_translation'
  | 'awaiting_independent_retry'
  | 'present_item'
  | 'in_progress'
  | 'completed';

export type TeacherActionType =
  | 'none'
  | 'present_target_and_ask_translation'
  | 'confirm_and_advance'
  | 'give_hint_and_retry'
  | 'correct_and_retry'
  | 'handle_dont_know_or_tell_me'
  | 'handle_out_of_bounds'
  | 'end_module';

export type ReviewSource = 'all_materials' | 'specific_material';

export interface TopicLessonItem {
  id: string;
  expression: string;
  meaning: string;
  english?: string;
  italian?: string;
  usage?: string;
  example?: string;
  type?: string;
  difficulty?: string;
  source?: 'topic_seed' | 'controlled_custom_topic' | 'personal_materials';
  topicPackId?: string;
  moduleId?: string;
  competencyAreaId?: string;
}

export interface VocabularyItem {
  id: string;
  english: string;
  italian: string;
  sourceDocumentId?: string;
  sourceDocumentTitle?: string;
  extractedAt?: string;
  lastReviewedAt?: string;
  currentMastery?: 'new' | 'learning' | 'familiar' | 'mastered';
  correctFirstTryCount?: number;
  correctAfterHintCount?: number;
  incorrectCount?: number;
  example?: string;
  type?: string;
}

export interface UnifiedReviewItem {
  id: string;
  english: string;
  italian: string;
  example?: string;
  type?: string;
  sourceMaterialId: string;
  sourceMaterialTitle: string;
  sourceType: 'pdf' | 'note' | 'migrated_note';
  sources?: Array<{ id: string; title: string; sourceType: 'pdf' | 'note' | 'migrated_note' }>;
  errorCount?: number;
  lastReviewedAt?: string;
  recalledWithHint?: boolean;
}

export interface AssignedTranslationExercise {
  id: string;
  italianSentence: string;
  expectedEnglish: string;
  targetItemId: string;
  attemptNumber: number;
  answerWasRevealed: boolean;
  createdAt: number;
}

export interface GameType {
  id: string;
  title: string;
}

export interface GameRuntimeState {
  gameType?: string;
  roundNumber?: number;
  targetRounds?: number;
  score?: number;
  currentPrompt?: string;
  expectedAnswer?: string;
}

export type VoiceConversationPhase =
  | 'idle'
  | 'listening'
  | 'routing_user_turn'
  | 'switching_activity_context'
  | 'waiting_for_setup'
  | 'requesting_teacher_turn'
  | 'receiving_teacher_output'
  | 'speaking'
  | 'error';

export interface TargetVocabularyItem {
  id: string;
  expression: string;
  meaning: string;
  english?: string;
  italian?: string;
  translationIt?: string;
  type?: string;
  contextualMeaningIt?: string;
  exampleEnglish?: string;
  example?: string;
  usage?: string;
  source?: 'controlled_custom_topic' | 'personal_materials' | 'topic_seed';
  topicPackId?: string;
  moduleId?: string;
  competencyAreaId?: string;
}

export interface LearningRuntimeState {
  schemaVersion?: number;
  appSessionId?: string;
  sessionId?: string;
  learningMode: LearningMode;
  contentSource?: ContentSource;
  topic?: string;
  activeTopicPackId?: string;
  activeModuleId?: string;
  activeCompetencyAreaId?: string;
  customTopic?: string;
  activityPhase?: string;
  lessonStep?: LessonStep;
  completedItemCount?: number;
  completedItemIds?: string[];
  incorrectItemIds?: string[];
  exposedItemIds?: string[];
  currentItem?: TargetVocabularyItem | null;
  selectedLearningItems?: TopicLessonItem[];
  currentLearningItemIndex?: number;
  assignedTranslationExercise?: AssignedTranslationExercise;
  lastTeacherAction?: TeacherActionType;
  currentAttempt?: number;
  currentTurnId?: string;
  lastCommittedUserTurnId?: string;
  activityMenuStatus?: string;
  activityStatus?: string;
  exerciseStatus?: string;
  waitingFor?: string;
  currentPhase?: string;
  recentErrors?: string[];
  sessionVocabulary?: VocabularyItem[];
  reviewSource?: ReviewSource;
  selectedMaterialTitle?: string;
  sessionExpectedActive?: boolean;
  pendingAction?: any;
  suspendedLearningState?: any;
  updatedAt?: string;
}

export function createInitialRuntimeState(
  mode: LearningMode = 'activity_selection',
  topic = 'Selezione attività'
): LearningRuntimeState {
  return {
    schemaVersion: 2,
    appSessionId: `session_${Date.now()}`,
    learningMode: mode,
    topic,
    activityPhase: 'select_activity',
    lessonStep: 'select_activity',
    completedItemCount: 0,
    currentItem: null,
    selectedLearningItems: [],
  };
}
