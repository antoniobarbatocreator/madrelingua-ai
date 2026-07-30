import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  getAllTopicPacks,
  getMacroTopicOverview,
  getPackSelectionAliases,
  PACK_ITALIAN_LABELS,
} from '../src/lib/topicPacks/registry';
import { analyzeNewVocabularyRequest } from '../src/lib/newVocabularyRequestAnalyzer';
import { resolveCurriculumSelection } from '../src/lib/curriculumSelectionResolver';
import {
  buildCompleteExclusionSet,
  buildCurrentMaterialExclusionSet,
  getCurrentSessionTargetKeys,
  normalizeExpressionKey,
  selectNewVocabularyItems,
} from '../src/lib/newVocabularySelector';
import { createCanonicalRuntimeState } from '../src/lib/conversationRuntime';
import {
  orchestrateCommittedUserTurn,
  resetProcessedTurnIdsForTest,
} from '../src/lib/conversationOrchestrator';
import {
  evaluateTranslationLocally,
  routeVocabularyLessonTurn,
} from '../src/lib/vocabularyLessonController';
import { checkModelOutputCompliance } from '../src/lib/modelActionCompliance';
import type { KnowledgeDocument } from '../src/types/index';
import type { TopicLessonItem } from '../src/types/learningSession';
import { DEFAULT_KNOWLEDGE_DOCS } from '../src/data/defaultKnowledge';

const results: string[] = [];
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      results.push(`PASS ${name}`);
      console.log(`PASS ${name}`);
    });
}

const memory = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, String(value)),
  removeItem: (key: string) => memory.delete(key),
  clear: () => memory.clear(),
};

const knowledgeDocs: KnowledgeDocument[] = [
  {
    id: 'fixture-material',
    fileName: 'fixture.txt',
    fileSize: 120,
    uploadedAt: new Date(0).toISOString(),
    extractedText: 'unwind = rilassarsi\nlocal spot = posto frequentato dai locali\ngrocery = spesa\namenities = servizi',
    type: 'text',
    vocabularyCount: 4,
    updatedAt: new Date(0).toISOString(),
    extractedChunks: [
      { id: 'm1', phrase: 'unwind', translation: 'rilassarsi', context: 'fixture' },
      { id: 'm2', phrase: 'local spot', translation: 'posto frequentato dai locali', context: 'fixture' },
      { id: 'm3', phrase: 'grocery', translation: 'spesa', context: 'fixture' },
      { id: 'm4', phrase: 'amenities', translation: 'servizi', context: 'fixture' },
    ],
  },
];

async function main(): Promise<void> {
await check('registry exposes exactly 11 Italian-labelled packs and aliases', () => {
  const packs = getAllTopicPacks();
  assert.equal(packs.length, 11);
  for (const pack of packs) {
    assert.ok(PACK_ITALIAN_LABELS[pack.id], `Missing Italian label for ${pack.id}`);
    assert.ok(getPackSelectionAliases(pack.id).length > 0, `Missing aliases for ${pack.id}`);
  }
  const overview = getMacroTopicOverview();
  assert.equal(overview.packs.length, 11);
  assert.match(overview.formattedPromptPanorama, /Puoi anche propormi un argomento diverso/i);
  assert.ok(!overview.formattedPromptPanorama.includes('Everyday Life & Daily English'));
});

await check('every registered pack is selectable through registry-owned aliases', () => {
  for (const pack of getAllTopicPacks()) {
    const alias = getPackSelectionAliases(pack.id)[0];
    const resolution = resolveCurriculumSelection({ userText: alias, currentPhase: 'select_topic' });
    assert.ok(['resolved', 'needs_module'].includes(resolution.type), `${pack.id}: ${resolution.type}`);
    assert.equal(resolution.pack?.id, pack.id, alias);
  }
});

await check('request analyser distinguishes activity-only, explicit topic and ordinary requests', () => {
  const activityOnly = [
    'Voglio imparare nuove parole.',
    'Ma vorrei parlare delle nuove parole.',
    'Ecco, vorrei imparare qualche nuova espressione.',
    'Possiamo fare dei vocaboli nuovi?',
    'Mi piacerebbe imparare qualcosa di nuovo.',
  ];
  for (const text of activityOnly) {
    const result = analyzeNewVocabularyRequest(text);
    assert.equal(result.requestsActivity, true, text);
    assert.equal(result.hasExplicitTopic, false, text);
    assert.equal(result.explicitTopicText, undefined, text);
  }

  const topics = new Map([
    ['Vorrei imparare nuove parole sulla fotografia.', 'fotografia'],
    ['Facciamo vocaboli per viaggiare.', 'viaggiare'],
    ['Vorrei espressioni utili sul lavoro.', 'lavoro'],
    ['Teach me vocabulary for social situations.', 'social situations'],
  ]);
  for (const [text, expected] of topics) {
    const result = analyzeNewVocabularyRequest(text);
    assert.equal(result.requestsActivity, true, text);
    assert.equal(result.hasExplicitTopic, true, text);
    assert.equal(result.explicitTopicText, expected, text);
  }

  for (const text of [
    'Voglio imparare a cucinare.',
    'Insegnami a usare Excel.',
    'Vorrei parlare del mio lavoro.',
    'Mi interessa la fotografia.',
  ]) {
    assert.equal(analyzeNewVocabularyRequest(text).requestsActivity, false, text);
  }
  const bare = analyzeNewVocabularyRequest('fotografia', { currentPhase: 'select_topic' });
  assert.equal(bare.hasExplicitTopic, true);
  assert.equal(bare.explicitTopicText, 'fotografia');
});

await check('curriculum resolver handles activity, registered pack/module and custom topic', () => {
  assert.equal(resolveCurriculumSelection({ userText: 'Voglio imparare nuove parole.' }).type, 'activity_only');
  const broad = resolveCurriculumSelection({ userText: 'vita quotidiana', currentPhase: 'select_topic' });
  assert.equal(broad.type, 'needs_module');
  assert.equal(broad.pack?.id, 'everyday_life_and_daily_english');
  const specific = resolveCurriculumSelection({ userText: 'aeroporto e check-in', currentPhase: 'select_topic' });
  assert.equal(specific.type, 'resolved');
  assert.equal(specific.pack?.id, 'travel_essentials');
  assert.ok(specific.module?.id);
  const custom = resolveCurriculumSelection({ userText: 'fotografia', currentPhase: 'select_topic' });
  assert.equal(custom.type, 'custom_topic');
  assert.equal(custom.requestedTopic, 'fotografia');
  const ordinary = resolveCurriculumSelection({ userText: 'Vorrei parlare del mio lavoro.', currentPhase: 'free_conversation' });
  assert.equal(ordinary.type, 'not_found');
});

await check('normalization preserves meaningful apostrophes and multi-word distinctions', () => {
  assert.equal(normalizeExpressionKey('don’t'), "don't");
  assert.equal(normalizeExpressionKey("don't"), "don't");
  assert.equal(normalizeExpressionKey('we’ll'), "we'll");
  assert.notEqual(normalizeExpressionKey("we'll"), normalizeExpressionKey('well'));
  assert.notEqual(normalizeExpressionKey('catch'), normalizeExpressionKey('catch up'));
  assert.notEqual(normalizeExpressionKey('catch up'), normalizeExpressionKey('catch up with'));
});

await check('Materials are absolute exclusions', async () => {
  const set = await buildCurrentMaterialExclusionSet(knowledgeDocs);
  for (const expression of ['unwind', 'local spot', 'grocery', 'amenities']) {
    assert.ok(set.has(normalizeExpressionKey(expression)), `Missing Material exclusion: ${expression}`);
  }

  const travel = getAllTopicPacks().find((pack) => pack.id === 'travel_essentials');
  assert.ok(travel);
  const module = travel!.modules[0];
  const everySeedExcluded = new Set(
    module.seedItems.flatMap((item) => String(item.expression).split(/\s+vs\.?\s+/i)).map(normalizeExpressionKey)
  );
  const selected = selectNewVocabularyItems({
    packId: travel!.id,
    moduleId: module.id,
    excludedExpressionsSet: everySeedExcluded,
    targetCount: 5,
  });
  assert.equal(selected.length, 0, 'Selector relaxed hard exclusions when all seeds were excluded');
});


await check('default Materials remain absolute across every registered curriculum module', async () => {
  const exclusions = await buildCurrentMaterialExclusionSet(DEFAULT_KNOWLEDGE_DOCS);
  for (const expected of ['baggage claim area', 'could i have the check please', 'touch base', "let's call it a day"]) {
    assert.ok(exclusions.has(normalizeExpressionKey(expected)), `Default Material missing from exclusions: ${expected}`);
  }
  for (const pack of getAllTopicPacks()) {
    for (const module of pack.modules) {
      const selected = selectNewVocabularyItems({
        packId: pack.id,
        moduleId: module.id,
        targetCount: 12,
        excludedExpressionsSet: exclusions,
      });
      for (const item of selected) {
        const key = normalizeExpressionKey(item.expression || item.english || '');
        assert.ok(!exclusions.has(key), `${pack.id}/${module.id} selected Material target: ${key}`);
      }
    }
  }
});

await check('unseen queued targets remain eligible', () => {
  const state = createCanonicalRuntimeState('queue-test', 'learn_new_vocabulary', {
    activeTopicPackId: 'workplace_and_business_communication',
    activeModuleId: 'meetings_and_discussions',
    selectedLearningItems: [
      { id: 'a', expression: 'make the most of', meaning: 'sfruttare al massimo' },
      { id: 'b', expression: 'get ahead on work', meaning: 'portarsi avanti col lavoro' },
      { id: 'c', expression: 'call it a day', meaning: 'chiudere per oggi' },
    ],
    currentLearningItemIndex: 0,
    currentItem: { id: 'a', expression: 'make the most of', meaning: 'sfruttare al massimo' },
    exposedItemIds: ['a'],
  });
  const keys = getCurrentSessionTargetKeys(state, state.activeTopicPackId, state.activeModuleId);
  assert.ok(keys.has('make the most of'));
  assert.ok(!keys.has('get ahead on work'));
  assert.ok(!keys.has('call it a day'));
});

await check('orchestrator presents topic overview and does not duplicate the initial menu', async () => {
  resetProcessedTurnIdsForTest();
  const initial = createCanonicalRuntimeState('orch-menu', 'activity_selection', {
    activityMenuStatus: 'not_presented',
  });
  const firstGreeting = await orchestrateCommittedUserTurn({
    turnId: 'g1', text: 'Ciao', source: 'text', receivedAt: 1, runtimeState: initial,
  });
  assert.match(firstGreeting.userFacingText || '', /conversazione libera/i);
  const secondGreeting = await orchestrateCommittedUserTurn({
    turnId: 'g2', text: 'Hey, ciao', source: 'text', receivedAt: 2, runtimeState: firstGreeting.nextRuntimeState,
  });
  assert.ok(!(secondGreeting.userFacingText || '').includes('ripassare le tue parole'));

  const activity = await orchestrateCommittedUserTurn({
    turnId: 'g3', text: 'Voglio imparare nuove parole.', source: 'text', receivedAt: 3,
    runtimeState: secondGreeting.nextRuntimeState, knowledgeDocs,
  });
  assert.equal(activity.nextRuntimeState.activityPhase, 'select_topic');
  assert.equal(activity.nextRuntimeState.currentItem, undefined);
  assert.match(activity.userFacingText || '', /viaggi e aeroporto/i);
  assert.match(activity.userFacingText || '', /phrasal verbs/i);
});

let activeLessonState = createCanonicalRuntimeState('lesson-flow', 'learn_new_vocabulary', {
  activityPhase: 'select_topic',
  lessonStep: 'select_topic',
  activityMenuStatus: 'completed',
});

await check('registered lesson creates one app-owned target and exact assigned exercise', async () => {
  resetProcessedTurnIdsForTest();
  const packChoice = await orchestrateCommittedUserTurn({
    turnId: 'l1', text: 'vita quotidiana', source: 'text', receivedAt: 1,
    runtimeState: activeLessonState, knowledgeDocs, userLevel: 'B1_B2',
  });
  assert.equal(packChoice.nextRuntimeState.activityPhase, 'select_module');
  const moduleChoice = await orchestrateCommittedUserTurn({
    turnId: 'l2', text: 'routine quotidiana', source: 'text', receivedAt: 2,
    runtimeState: packChoice.nextRuntimeState, knowledgeDocs, userLevel: 'B1_B2',
  });
  activeLessonState = moduleChoice.nextRuntimeState;
  assert.ok(activeLessonState.currentItem?.id);
  assert.ok(activeLessonState.assignedTranslationExercise?.italianSentence);
  assert.equal(activeLessonState.assignedTranslationExercise?.targetItemId, activeLessonState.currentItem?.id);
  assert.equal(activeLessonState.lessonStep, 'awaiting_guided_translation');
  assert.equal(activeLessonState.activityPhase, 'waiting_for_answer');
  assert.equal(activeLessonState.lastTeacherAction, 'present_target_and_ask_translation');
  const target = normalizeExpressionKey(activeLessonState.currentItem?.expression || '');
  const materialSet = await buildCurrentMaterialExclusionSet(knowledgeDocs);
  assert.ok(!materialSet.has(target), `Selected target collides with Materials: ${target}`);
});

await check('Dimmi tu keeps the same target, reveals answer and assigns a different sentence', async () => {
  const originalItem = activeLessonState.currentItem!;
  const originalExercise = activeLessonState.assignedTranslationExercise!;
  const result = await routeVocabularyLessonTurn({
    userText: 'Dimmi tu',
    runtimeState: activeLessonState,
    knowledgeDocs,
    userLevel: 'B1_B2',
  });
  assert.equal(result.nextRuntimeState.currentItem?.id, originalItem.id);
  assert.equal(result.action.type, 'give_hint_and_retry');
  assert.notEqual(result.nextRuntimeState.assignedTranslationExercise?.italianSentence, originalExercise.italianSentence);
  assert.equal(result.nextRuntimeState.completedItemIds.includes(originalItem.id), false);
  assert.equal(result.nextRuntimeState.lessonStep, 'awaiting_independent_retry');
  activeLessonState = result.nextRuntimeState;
});

await check('correct independent retry acquires the target and advances to the next filtered item', async () => {
  const currentId = activeLessonState.currentItem!.id;
  const exercise = activeLessonState.assignedTranslationExercise!;
  const result = await routeVocabularyLessonTurn({
    userText: exercise.expectedEnglish,
    runtimeState: activeLessonState,
    knowledgeDocs,
    userLevel: 'B1_B2',
  });
  assert.equal(result.action.type, 'confirm_and_advance');
  assert.ok(result.nextRuntimeState.completedItemIds.includes(currentId));
  assert.notEqual(result.nextRuntimeState.currentItem?.id, currentId);
  assert.ok(result.nextRuntimeState.assignedTranslationExercise?.italianSentence);
  assert.equal(result.nextRuntimeState.lastTeacherAction, 'confirm_and_advance');
  activeLessonState = result.nextRuntimeState;
});

await check('local evaluator rejects unrelated target-containing nonsense and revealed-answer acquisition', () => {
  const item: TopicLessonItem = {
    id: 'semantic-target',
    expression: 'make the most of',
    meaning: 'sfruttare al massimo',
    example: 'We should make the most of this opportunity.',
  };
  const nonsense = evaluateTranslationLocally({
    userText: 'I love pizza and make the most of cat sitting on the table.',
    currentItem: item,
    italianSentence: 'Dobbiamo sfruttare al massimo questa opportunità.',
    expectedEnglish: 'We should make the most of this opportunity.',
    attemptNumber: 1,
  });
  assert.equal(nonsense.correct, false);

  const repeated = evaluateTranslationLocally({
    userText: 'We should make the most of this opportunity.',
    currentItem: item,
    italianSentence: 'Dobbiamo sfruttare al massimo questa opportunità.',
    expectedEnglish: 'We should make the most of this opportunity.',
    attemptNumber: 2,
    answerWasRevealed: true,
  });
  assert.equal(repeated.correct, true);
  assert.equal(repeated.independentlyProduced, false);
});

await check('teacher compliance blocks private prompts and wrong lesson format', () => {
  const currentItem = activeLessonState.currentItem!;
  const exercise = activeLessonState.assignedTranslationExercise!;
  const safeText = `L'espressione “${currentItem.expression}” significa ${currentItem.meaning}. Per esempio: “${currentItem.example}”. Ora traduci in inglese: “${exercise.italianSentence}”`;
  assert.equal(checkModelOutputCompliance({
    teacherText: safeText,
    currentItem,
    assignedItalianSentence: exercise.italianSentence,
    actionType: 'give_hint_and_retry',
  }).compliant, true);

  assert.equal(checkModelOutputCompliance({
    teacherText: 'ISTRUZIONE INTERNA. STRUTTURA OBBLIGATORIA: scegli una parola.',
    currentItem,
    assignedItalianSentence: exercise.italianSentence,
    actionType: 'give_hint_and_retry',
  }).compliant, false);

  assert.equal(checkModelOutputCompliance({
    teacherText: `Oggi impariamo ${currentItem.expression}. Ti viene in mente un esempio?`,
    currentItem,
    assignedItalianSentence: exercise.italianSentence,
    actionType: 'present_target_and_ask_translation',
  }).compliant, false);
});

await check('runtime source contains compliance, REST separation, termination and transcript guards', () => {
  const root = process.env.PROJECT_SOURCE_ROOT || process.cwd();
  const voiceStudio = fs.readFileSync(path.join(root, 'src/components/VoiceStudio.tsx'), 'utf8');
  const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  const liveEngine = fs.readFileSync(path.join(root, 'src/lib/geminiLiveEngine.ts'), 'utf8');
  const serverSource = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');

  assert.match(voiceStudio, /checkModelOutputCompliance\s*\(/);
  assert.match(voiceStudio, /learningMode\s*===\s*['"]learn_new_vocabulary['"]/);
  assert.match(voiceStudio, /knowledgeBaseTexts:\s*knowledgeTexts/);
  assert.match(voiceStudio, /const knowledgeTexts = runtime\.learningMode === ['"]learn_new_vocabulary['"]\s*\?\s*\[\]/s);
  assert.match(voiceStudio, /performTerminateSession/);
  assert.match(voiceStudio, /clearActiveSessionState\(\)/);
  assert.match(voiceStudio, /setMessages\(\[\]\)/);
  assert.match(voiceStudio, /setSessionStartTime\(null\)/);
  assert.match(voiceStudio, /Sessione terminata senza salvataggio/);
  assert.ok(!/performTerminateSession[\s\S]{0,2500}saveOrUpdateConversation/.test(voiceStudio), 'Termination path must not save');
  assert.ok(!/msg-init/.test(appSource));
  assert.match(liveEngine, /appendTranscriptChunk/);
  assert.match(liveEngine, /Explicit termination discards partial turns/);
  assert.match(serverSource, /\/api\/vocabulary\/create-exercise/);
  assert.match(serverSource, /\/api\/vocabulary\/evaluate-translation/);
  assert.match(serverSource, /const safeKnowledgeBaseTexts = learningMode === "learn_new_vocabulary"\s*\?\s*\[\]/s);
});


await check('natural daily-life request, delegation and mid-lesson topic switch are structural', async () => {
  const natural = analyzeNewVocabularyRequest('E mi piacerebbe imparare nuove parole in situazioni di vita quotidiana.');
  assert.equal(natural.requestsActivity, true);
  assert.equal(natural.hasExplicitTopic, true);
  assert.match(natural.explicitTopicText || '', /vita quotidiana|situazioni di vita quotidiana/i);

  const daily = resolveCurriculumSelection({
    userText: natural.explicitTopicText || '',
    currentPhase: 'select_topic',
  });
  assert.ok(['resolved', 'needs_module'].includes(daily.type));
  assert.equal(daily.pack?.id, 'everyday_life_and_daily_english');

  const delegated = resolveCurriculumSelection({
    userText: 'scegli tu',
    currentPhase: 'select_module',
    activeTopicPackId: 'everyday_life_and_daily_english',
  });
  assert.equal(delegated.type, 'resolved');
  assert.equal(delegated.pack?.id, 'everyday_life_and_daily_english');
  assert.ok(delegated.module?.id);

  resetProcessedTurnIdsForTest();
  const midLesson = createCanonicalRuntimeState('switch-test', 'learn_new_vocabulary', {
    activityPhase: 'waiting_for_answer',
    lessonStep: 'awaiting_guided_translation',
    activeTopicPackId: 'everyday_life_and_daily_english',
    activeModuleId: 'daily_routine',
    currentItem: { id: 'old', expression: 'wind down', meaning: 'rilassarsi gradualmente' },
    assignedTranslationExercise: {
      id: 'ex-old', italianSentence: 'La sera mi rilasso gradualmente.',
      expectedEnglish: 'I wind down in the evening.', targetItemId: 'old', attemptNumber: 1,
      answerWasRevealed: false, createdAt: 1,
    },
  });
  const switched = await orchestrateCommittedUserTurn({
    turnId: 'switch-1', text: 'Voglio imparare adesso vocaboli per cavarmela in viaggio.', source: 'text', receivedAt: 1,
    runtimeState: midLesson, knowledgeDocs, userLevel: 'A1_A2',
  });
  assert.equal(switched.consumed, true);
  assert.notEqual(switched.outcome, 'exercise_turn');
  assert.equal(switched.nextRuntimeState.activeTopicPackId, 'travel_essentials');
});


await check('CEFR filtering never selects above the configured learner ceiling', () => {
  const everyday = getAllTopicPacks().find((pack) => pack.id === 'everyday_life_and_daily_english')!;
  const module = everyday.modules.find((item) => item.id === 'daily_routine')!;
  const selected = selectNewVocabularyItems({
    packId: everyday.id,
    moduleId: module.id,
    cefrLevel: 'A1_A2',
    targetCount: 12,
    excludedExpressionsSet: new Set(),
  });
  assert.ok(selected.length > 0);
  for (const item of selected) {
    assert.ok(['A1', 'A2'].includes(String(item.difficulty)), `A1_A2 received ${item.expression} (${item.difficulty})`);
  }
});

await check('fallback exercises are contextual translations rather than repetition drills', async () => {
  const state = createCanonicalRuntimeState('fallback-quality', 'learn_new_vocabulary', {
    activityPhase: 'presenting_item',
    lessonStep: 'present_target',
    currentItem: {
      id: 'oversleep', expression: 'oversleep', meaning: 'dormire troppo / svegliarsi in ritardo',
      usage: 'Verb meaning to sleep past the intended time.', example: 'I overslept this morning.', type: 'word',
    },
  });
  const result = await routeVocabularyLessonTurn({ userText: '', runtimeState: state, userLevel: 'A1_A2' });
  const sentence = result.nextRuntimeState.assignedTranslationExercise?.italianSentence || '';
  assert.ok(sentence.length >= 8);
  assert.ok(!/devo usare|ripeti|vuoi ripetere/i.test(sentence));
  assert.ok(!/^Oggi devo dormire troppo/i.test(sentence));
  assert.equal(result.action.type, 'present_target_and_ask_translation');

  const beAssessment = evaluateTranslationLocally({
    userText: "I'm in a hurry today.",
    currentItem: { id: 'hurry', expression: 'be in a hurry', meaning: 'essere di fretta' },
    italianSentence: 'Oggi sono di fretta.',
    expectedEnglish: "I'm in a hurry today.",
    attemptNumber: 1,
  });
  assert.equal(beAssessment.targetUsedCorrectly, true);
});

await check('new-target selection prioritizes lexical items and never asks for repetition', () => {
  const travel = getAllTopicPacks().find((pack) => pack.id === 'travel_essentials')!;
  const module = travel.modules[0];
  const selected = selectNewVocabularyItems({
    packId: travel.id,
    moduleId: module.id,
    targetCount: 6,
    excludedExpressionsSet: new Set(),
  });
  assert.ok(selected.length > 0);
  const allowed = new Set(['word', 'phrasal_verb', 'collocation', 'chunk', 'idiom', 'grammar_pattern']);
  for (const item of selected) {
    assert.ok(allowed.has(String(item.type || 'chunk')), `Unexpected target type: ${item.type}`);
    const expr = String(item.expression || item.english || '');
    assert.ok(expr.split(/\s+/).length <= 9, `Sentence-like target selected: ${expr}`);
  }

  const sample = selected[0];
  const compliance = checkModelOutputCompliance({
    teacherText: `Oggi impariamo “${sample.expression}”. Vuoi ripetere questa espressione?`,
    currentItem: sample,
    assignedItalianSentence: 'Questa è una frase italiana da tradurre.',
    actionType: 'present_target_and_ask_translation',
  });
  assert.equal(compliance.compliant, false);
});

await check('session termination control is persistent and saving remains explicitly manual', () => {
  const root = process.env.PROJECT_SOURCE_ROOT || process.cwd();
  const voiceStage = fs.readFileSync(path.join(root, 'src/components/voice/VoiceStage.tsx'), 'utf8');
  const voiceStudio = fs.readFileSync(path.join(root, 'src/components/VoiceStudio.tsx'), 'utf8');
  assert.match(voiceStage, /isSessionStarted/);
  assert.match(voiceStage, /Termina sessione/);
  assert.match(voiceStage, /isSessionStarted\s*\|\|\s*liveStatus\s*!==\s*['"]disconnected['"]/s);
  const start = voiceStudio.indexOf('const performTerminateSession');
  const end = voiceStudio.indexOf('// Termina sempre', start);
  const terminationBlock = voiceStudio.slice(start, end);
  assert.match(terminationBlock, /geminiLiveEngine\.terminateSession\(\)/);
  assert.match(terminationBlock, /setMessages\(\[\]\)/);
  assert.match(terminationBlock, /setLiveTeacherTranscript\(['"]['"]\)/);
  assert.match(terminationBlock, /setLiveUserTranscript\(['"]['"]\)/);
  assert.match(terminationBlock, /setSessionStartTime\(null\)/);
  assert.ok(!terminationBlock.includes('saveOrUpdateConversation'));
  assert.match(voiceStudio, /const handleManualSave/);
  assert.match(voiceStudio, /saveOrUpdateConversation/);
});

await check('complete exclusion set is rebuilt from current Materials and current state', async () => {
  const complete = await buildCompleteExclusionSet({
    knowledgeDocs,
    learningRuntimeState: activeLessonState,
    packId: activeLessonState.activeTopicPackId,
    moduleId: activeLessonState.activeModuleId,
  });
  assert.ok(complete.excludedExpressionKeys.has('unwind'));
  assert.ok(complete.excludedExpressionKeys.has(normalizeExpressionKey(activeLessonState.currentItem?.expression || '')));
  assert.ok(complete.diagnostics.totalExclusionCount >= 5);
});

console.log(`\nCore verification completed: ${results.length} checks passed.`);
}

main().catch((error) => {
  console.error('CORE VERIFICATION FAILED');
  console.error(error);
  process.exitCode = 1;
});
