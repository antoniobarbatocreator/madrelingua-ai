export type ActiveTab = 'studio' | 'knowledge' | 'method' | 'review' | 'history';

export type UserLevel = 'A1_A2' | 'B1_B2' | 'C1_C2';

export type CefrLearningLevel = UserLevel | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'A2_B1' | 'B2_C1';

export interface LevelProfile {
  id: UserLevel;
  name?: string;
  label: string;
  cefrRange: string;
  description: string;
}

export type TurnMode = 'automatic' | 'noise_resistant' | 'tap_to_talk';

export type CorrectionMode = 'immediate' | 'end_of_turn' | 'summary_only';

export interface VoiceSettings {
  voiceName: string;
  speed: number;
  pauseToleranceSeconds: number;
  turnMode: TurnMode;
  correctionMode: CorrectionMode;
  keepScreenAwake?: boolean;
}

export type TopicFocus = 'FREE_TALK' | 'BUSINESS' | 'TRAVEL' | 'GRAMMAR' | string;

export interface CorrectionItem {
  hasMistake: boolean;
  originalText?: string;
  correctedTextEnglishPhrase?: string;
  correctedTextItalianExplanation?: string;
}

export interface VocabularyChunk {
  id?: string;
  phrase: string;
  translation: string;
  context?: string;
  category?: string;
}

export interface SavedPersonalVocabularyItem {
  id: string;
  expression: string;
  meaning?: string;
  normalizedExpression: string;
  savedAt: string;
  translationIt?: string;
  contextualMeaningIt?: string;
  lemma?: string;
  pronunciationIpa?: string;
  sourceSentence?: string;
  exampleEnglish?: string;
  exampleItalian?: string;
  cefrEstimate?: string;
  tags?: string[];
  sourceMessageId?: string;
  source?: string;
  type?: string;
  example?: string;
  usage?: string;
}

export interface KnowledgeDocument {
  id: string;
  title?: string;
  content?: string;
  category?: string;
  createdAt?: string;
  updatedAt: string;
  extractedChunks: VocabularyChunk[];
  vocabularyCount?: number;
  indexedItemCount?: number;
  indexingStatus?: 'ready' | 'processing' | 'error';
  type?: 'text' | 'pdf';
  fileName?: string;
  rawText?: string;
  extractedText?: string;
  fileSize?: number;
  uploadedAt?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'coach' | 'system';
  text: string;
  timestamp: string;
  audioBase64?: string;
  correction?: CorrectionItem;
  vocabularyUsed?: VocabularyChunk[];
}

export type VoiceSessionState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'reconnecting' | 'paused' | 'error';
