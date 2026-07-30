export interface VocabularyAnalysisResult {
  recommendedExpression?: string;
  translationIt?: string;
  lemma?: string;
  type?: 'word' | 'chunk' | 'phrasal_verb' | 'idiom' | 'collocation' | string;
  contextualMeaningIt?: string;
  pronunciationIpa?: string;
  exampleEnglish?: string;
  exampleItalian?: string;
  cefrEstimate?: string;
  tags?: string[];
}
