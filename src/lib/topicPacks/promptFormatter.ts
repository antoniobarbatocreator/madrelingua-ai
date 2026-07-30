import { LearningRuntimeState } from '../../types/learningSession';
import { getMacroTopicOverview, PACK_ITALIAN_LABELS } from './registry';

export function formatTopicPackMenuPrompt(): string {
  const { formattedPromptPanorama } = getMacroTopicOverview();
  return `SELEZIONE ARGOMENTO (TOPIC SELECTION PHASE):
Presenta i Topic Pack disponibili all'studente in italiano naturale:
${formattedPromptPanorama}

Chiedi all'utente quale argomento o situazione preferisce affrontare.`;
}

export function formatActiveTopicLessonPrompt(state: LearningRuntimeState): string {
  const packTitle = state.activeTopicPackId
    ? (PACK_ITALIAN_LABELS[state.activeTopicPackId] || state.topic || 'questo argomento')
    : (state.topic || 'Inglese pratico');

  const moduleTitle = state.activeModuleId || state.topic || 'Modulo attivo';
  const currentItem = state.currentItem;

  if (!currentItem) {
    return `TOPIC PACK E MODULO ATTIVI:
- Topic Pack: ${packTitle}
- Modulo: ${moduleTitle}
- Stato didattico: in preparazione del primo elemento target.`;
  }

  const target = currentItem.expression || currentItem.english || '';
  const meaning = currentItem.meaning || currentItem.italian || '';

  return `CONTESTO DIDATTICO ATTIVO DAL CONTROLLER:
- Topic Pack: ${packTitle}
- Modulo: ${moduleTitle}
- Target da insegnare: "${target}" (${meaning})
- Tipo: ${currentItem.type || 'expression'}
- Frase esercizio assegnata: "${state.assignedTranslationExercise || 'In preparazione'}"
- Tentativo corrente: ${state.currentAttempt || 0}`;
}
