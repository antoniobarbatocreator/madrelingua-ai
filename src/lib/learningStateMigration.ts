import { LearningRuntimeState, LearningMode, ContentSource, LessonStep } from '../types/learningSession';

export function migrateLearningRuntimeState(rawState: any): LearningRuntimeState {
  if (!rawState || typeof rawState !== 'object') {
    return {
      schemaVersion: 2,
      appSessionId: 'session_' + Date.now(),
      learningMode: 'activity_selection',
      contentSource: 'none',
      activityStatus: 'waiting_for_user',
      exerciseStatus: 'active',
      currentPhase: 'select_activity',
      lessonStep: 'select_activity',
      completedItemCount: 0,
      completedItemIds: [],
      incorrectItemIds: [],
      currentAttempt: 0,
      waitingFor: 'none',
      recentErrors: [],
      sessionVocabulary: [],
      updatedAt: new Date().toISOString(),
    };
  }

  let mode: any = rawState.learningMode;
  // Convert legacy mode 'topic_exploration' or missing mode
  if (mode === 'topic_exploration' || mode === 'topic' || mode === 'explore_topics') {
    mode = 'learn_new_vocabulary';
  } else if (!mode || !['activity_selection', 'free_conversation', 'knowledge_review', 'learn_new_vocabulary', 'learning_games'].includes(mode)) {
    mode = 'activity_selection';
  }

  const learningMode: LearningMode = mode;

  // Derive contentSource
  let contentSource: ContentSource = rawState.contentSource;
  if (!contentSource) {
    if (learningMode === 'knowledge_review') {
      contentSource = 'personal_materials';
    } else if (learningMode === 'learn_new_vocabulary') {
      contentSource = 'internal_topic_curriculum';
    } else {
      contentSource = 'none';
    }
  }

  // Derive lessonStep
  let lessonStep: LessonStep = rawState.lessonStep;
  if (!lessonStep) {
    if (learningMode === 'activity_selection') {
      lessonStep = 'select_activity';
    } else if (learningMode === 'learn_new_vocabulary') {
      if (rawState.activeModuleId || rawState.currentItem) {
        lessonStep = 'present_item';
      } else {
        lessonStep = 'select_topic';
      }
    }
  }

  return {
    ...rawState,
    schemaVersion: 2,
    appSessionId: rawState.appSessionId || 'session_' + Date.now(),
    learningMode,
    contentSource,
    lessonStep,
    activityStatus: rawState.activityStatus || (learningMode === 'activity_selection' ? 'waiting_for_user' : 'not_started'),
    exerciseStatus: rawState.exerciseStatus || 'active',
    currentPhase: rawState.currentPhase || (learningMode === 'activity_selection' ? 'select_activity' : 'initialization'),
    completedItemCount: typeof rawState.completedItemCount === 'number' ? rawState.completedItemCount : 0,
    completedItemIds: Array.isArray(rawState.completedItemIds) ? rawState.completedItemIds : [],
    incorrectItemIds: Array.isArray(rawState.incorrectItemIds) ? rawState.incorrectItemIds : [],
    currentAttempt: typeof rawState.currentAttempt === 'number' ? rawState.currentAttempt : 0,
    waitingFor: rawState.waitingFor || 'none',
    recentErrors: Array.isArray(rawState.recentErrors) ? rawState.recentErrors : [],
    sessionVocabulary: Array.isArray(rawState.sessionVocabulary) ? rawState.sessionVocabulary : [],
    updatedAt: rawState.updatedAt || new Date().toISOString(),
  };
}
