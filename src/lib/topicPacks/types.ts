export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'A1_A2' | 'A2_B1' | 'B1_B2' | 'B2_C1' | 'C1_C2';

export type TopicItemType =
  | 'word'
  | 'phrasal_verb'
  | 'collocation'
  | 'chunk'
  | 'idiom'
  | 'grammar_pattern'
  | 'expression';

export interface SeedItem {
  id?: string;
  expression: string;
  meaning: string;
  usage?: string;
  example?: string;
  type?: TopicItemType;
  difficulty?: CEFRLevel;
}

export interface LearningItem extends SeedItem {
  id: string;
  source?: 'topic_seed' | 'controlled_custom_topic' | 'personal_materials';
  topicPackId?: string;
  moduleId?: string;
  competencyAreaId?: string;
}

export interface CompetencyArea {
  id: string;
  title: string;
  description: string;
  cefrLevel: CEFRLevel;
  learningObjectives?: string[];
  realLifeSituations?: string[];
}

export interface TopicModule {
  id: string;
  title: string;
  description: string;
  competencyAreas: CompetencyArea[];
  seedItems: SeedItem[];
}

export interface TopicPack {
  id: string;
  title: string;
  description: string;
  version: string;
  targetAudience: string;
  cefrRange: CEFRLevel[];
  modules: TopicModule[];
}

export interface TopicProgressRecord {
  packId: string;
  moduleId: string;
  itemKey: string;
  exposureCount: number;
  lastExposedAt: string;
  masteryStatus?: 'new' | 'learning' | 'mastered';
}
