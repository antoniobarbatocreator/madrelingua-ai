import { TopicLessonItem, TeacherActionType } from '../types/learningSession';

export interface ModelComplianceResult {
  compliant: boolean;
  violations: string[];
}

function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsPrivateInstructionLeak(text: string): boolean {
  const normalizedText = normalize(text);
  if (!normalizedText) return false;
  const markers = [
    'istruzione interna',
    "istruzioni per l'insegnante",
    'struttura obbligatoria',
    'divieto assoluto',
    'modelactionprompt',
    'current application phase',
    'non mostrare ne citare queste istruzioni',
    'azione applicativa privata',
  ];
  return markers.some((marker) => normalizedText.includes(normalize(marker)));
}

/**
 * Guards visible teacher output for deterministic vocabulary actions.
 * This does not decide the pedagogical action. It only verifies that the
 * rendered response respects the action already selected by the application.
 */
export function checkModelOutputCompliance(params: {
  teacherText: string;
  currentItem?: TopicLessonItem | null;
  assignedItalianSentence?: string;
  actionType?: TeacherActionType;
  requiresItalianSentence?: boolean;
}): ModelComplianceResult {
  const {
    teacherText,
    currentItem,
    assignedItalianSentence,
    actionType,
    requiresItalianSentence = true,
  } = params;
  const violations: string[] = [];
  const text = teacherText.trim();
  const textLower = normalize(text);

  if (!text) {
    return { compliant: false, violations: ['Risposta dell’insegnante vuota.'] };
  }

  if (containsPrivateInstructionLeak(text)) {
    violations.push('È comparsa un’istruzione tecnica privata nella risposta del coach.');
  }

  const prohibitedQuestions = [
    'ti piace questa espressione?',
    'ti piace?',
    'ti e mai capitato?',
    'ti viene in mente un esempio?',
    'vuoi provare a usarla?',
    'vuoi provare?',
    'vuoi impararne un altra?',
    'hai mai usato questa parola?',
    'vuoi ripetere questa espressione?',
    'vuoi provare a ripeterlo?',
    'ti va di provare a ripeterlo?',
    'ti va di ripeterla?',
    'ti va di pronunciarlo?',
    'puoi ripeterlo?',
  ];
  for (const question of prohibitedQuestions) {
    if (textLower.includes(normalize(question))) {
      violations.push(`Domanda didattica non ammessa: “${question}”.`);
    }
  }


  if (actionType === 'present_target_and_ask_translation') {
    const imitationPattern = /\b(ripeti|ripetere|pronuncia|pronunciare)\b/;
    if (imitationPattern.test(textLower)) {
      violations.push('La risposta trasforma la lezione in un esercizio di imitazione o pronuncia.');
    }
    const pronunciationPraise = /\b(pronuncia perfetta|pronunciato benissimo|pronuncia benissimo|bravissimo a ripetere)\b/;
    if (pronunciationPraise.test(textLower)) {
      violations.push('La risposta valuta la pronuncia invece della traduzione guidata.');
    }
  }

  const target = currentItem?.expression || currentItem?.english || '';
  if (target && !textLower.includes(normalize(target))) {
    violations.push(`La risposta non contiene il target attivo “${target}”.`);
  }

  const shouldContainExercise = requiresItalianSentence && [
    'present_target_and_ask_translation',
    'correct_and_retry',
    'give_hint_and_retry',
    'confirm_and_advance',
  ].includes(actionType || 'none');

  if (shouldContainExercise) {
    const hasTranslationInstruction = /\b(traduci|tradurre|come diresti|in inglese)\b/.test(textLower);
    if (!hasTranslationInstruction) {
      violations.push('Manca una richiesta esplicita di traduzione in inglese.');
    }
    if (assignedItalianSentence) {
      const normalizedSentence = normalize(assignedItalianSentence).replace(/[.!?]+$/g, '');
      const normalizedOutput = textLower.replace(/[.!?]+$/g, '');
      if (!normalizedOutput.includes(normalizedSentence)) {
        violations.push('La risposta non contiene la frase italiana esatta assegnata dal controller.');
      }
    }
  }

  if (actionType === 'present_target_and_ask_translation') {
    const quotedSegments = Array.from(text.matchAll(/[“"]([^”"]{2,80})[”"]/g)).map((match) => normalize(match[1]));
    const normalizedTarget = normalize(target);
    const normalizedExercise = normalize(assignedItalianSentence || '');
    const allowedExample = normalize(currentItem?.example || '');
    const suspicious = quotedSegments.filter(
      (segment) =>
        segment &&
        segment !== normalizedTarget &&
        segment !== normalizedExercise &&
        segment !== allowedExample &&
        !normalizedExercise.includes(segment) &&
        !allowedExample.includes(segment)
    );
    if (suspicious.length > 1) {
      violations.push('La risposta sembra introdurre più elementi target invece di uno solo.');
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}
