import { LearningRuntimeState } from '../types/learningSession';
import { ConversationRuntimeState, createCanonicalRuntimeState, validateConversationRuntime } from './conversationRuntime';
import { learningSessionRepository } from './learningSessionRepository';
import { migrateLearningRuntimeState } from './learningStateMigration';

const ACTIVE_SESSION_POINTER_KEY = 'madrelingua_active_session_pointer_v2';

export interface ActiveSessionPointer {
  appSessionId: string;
  learningMode: string;
  topic?: string;
  updatedAt: string;
}

/**
 * Creates a clean slate session with no conversation history carried over.
 */
export function initializeCleanSessionState(overrides: Partial<ConversationRuntimeState> = {}): ConversationRuntimeState {
  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanState = createCanonicalRuntimeState(newSessionId, 'activity_selection', overrides);

  // Save pointer and state synchronously
  try {
    const pointer: ActiveSessionPointer = {
      appSessionId: newSessionId,
      learningMode: cleanState.learningMode,
      topic: cleanState.topic,
      updatedAt: cleanState.updatedAt,
    };
    localStorage.setItem(ACTIVE_SESSION_POINTER_KEY, JSON.stringify(pointer));
  } catch (e) {
    console.warn('Failed to save active session pointer:', e);
  }

  // Fire and forget save to repository
  learningSessionRepository.saveLearningState(cleanState).catch((err) => {
    console.warn('Async save failed on clean session init:', err);
  });

  return cleanState;
}

export const saveActiveSessionState = persistConversationState;

/**
 * Saves the current conversation runtime state synchronously to LocalStorage

 * and asynchronously to IndexedDB.
 */
export async function persistConversationState(state: ConversationRuntimeState): Promise<void> {
  if (!state || !state.appSessionId) return;

  const validation = validateConversationRuntime(state);
  const stateToPersist = validation.valid
    ? state
    : validation.recoveredState || state;

  stateToPersist.updatedAt = new Date().toISOString();

  try {
    const pointer: ActiveSessionPointer = {
      appSessionId: stateToPersist.appSessionId,
      learningMode: stateToPersist.learningMode,
      topic: stateToPersist.topic,
      updatedAt: stateToPersist.updatedAt,
    };
    localStorage.setItem(ACTIVE_SESSION_POINTER_KEY, JSON.stringify(pointer));
  } catch (e) {}

  await learningSessionRepository.saveLearningState(stateToPersist);
}

/**
 * Completely clears the active session state from storage.
 * Use this when the user clicks "Termina sessione".
 */
export async function clearActiveSessionState(appSessionId?: string): Promise<void> {
  try {
    localStorage.removeItem(ACTIVE_SESSION_POINTER_KEY);
  } catch (e) {}

  if (appSessionId) {
    await learningSessionRepository.deleteLearningState(appSessionId);
  }
}

/**
 * Loads the active session state if available, returning a validated state.
 */
export async function loadActiveSessionState(): Promise<ConversationRuntimeState | null> {
  let targetSessionId: string | null = null;

  try {
    const rawPointer = localStorage.getItem(ACTIVE_SESSION_POINTER_KEY);
    if (rawPointer) {
      const pointer: ActiveSessionPointer = JSON.parse(rawPointer);
      targetSessionId = pointer.appSessionId;
    }
  } catch (e) {}

  if (!targetSessionId) {
    const latestState = await learningSessionRepository.getLatestLearningState();
    if (latestState) {
      targetSessionId = latestState.appSessionId;
    }
  }

  if (!targetSessionId) return null;

  const rawState = await learningSessionRepository.loadLearningState(targetSessionId);
  if (!rawState) return null;

  const migrated = migrateLearningRuntimeState(rawState);
  const validation = validateConversationRuntime(migrated as ConversationRuntimeState);

  return validation.valid
    ? (migrated as ConversationRuntimeState)
    : (validation.recoveredState || (migrated as ConversationRuntimeState));
}
