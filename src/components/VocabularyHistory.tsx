import React, { useState } from 'react';
import { ChatMessage, CorrectionItem, KnowledgeDocument, VocabularyChunk, VoiceSettings } from '../types';
import { playPcmAudio } from '../lib/speech';
import {
  Sparkles,
  Volume2,
  RotateCcw,
  Brain,
  Filter,
  BookOpen,
  Check,
  RotateCw,
  Loader2,
} from 'lucide-react';
import { PersonalVocabularyView } from './PersonalVocabularyView';
import { SectionHeader } from './common/SectionHeader';
import { EmptyState } from './common/EmptyState';

interface VocabularyHistoryProps {
  messages: ChatMessage[];
  knowledgeDocs: KnowledgeDocument[];
  voiceSettings: VoiceSettings;
  onGoToStudio?: () => void;
}

export const VocabularyHistory: React.FC<VocabularyHistoryProps> = ({
  messages,
  knowledgeDocs,
  voiceSettings,
  onGoToStudio,
}) => {
  const [activeTab, setActiveTab] = useState<'personal_vocab' | 'corrections' | 'flashcards'>('personal_vocab');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [audioLoadingText, setAudioLoadingText] = useState<string | null>(null);

  const speakPhraseWithGemini = async (textToSpeak: string) => {
    if (!textToSpeak) return;
    setAudioLoadingText(textToSpeak);
    try {
      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceName: voiceSettings.voiceName || 'Achird',
          text: textToSpeak,
        }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        playPcmAudio(data.audioBase64, 24000);
      }
    } catch (e) {
      console.error('TTS preview error:', e);
    } finally {
      setAudioLoadingText(null);
    }
  };

  const correctionsHistory = messages
    .filter((m) => m.sender === 'coach' && m.correction && m.correction.hasMistake)
    .map((m) => ({
      id: m.id,
      timestamp: m.timestamp,
      correction: m.correction as CorrectionItem,
    }));

  const allChunks: VocabularyChunk[] = [
    ...knowledgeDocs.flatMap((d) => d.extractedChunks),
    ...messages
      .filter((m) => m.vocabularyUsed && m.vocabularyUsed.length > 0)
      .flatMap((m) => m.vocabularyUsed || []),
  ];

  const categories = ['ALL', ...Array.from(new Set(allChunks.map((c) => c.category || 'Generale')))];

  const filteredChunks =
    selectedCategory === 'ALL'
      ? allChunks
      : allChunks.filter((c) => (c.category || 'Generale') === selectedCategory);

  const currentChunk = filteredChunks[currentFlashcardIndex % (filteredChunks.length || 1)];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 text-slate-100 space-y-6">
      {/* Section Header */}
      <SectionHeader
        icon={<Sparkles className="w-6 h-6 text-amber-400" />}
        title="Ripasso"
        description="Ritrova le espressioni salvate, le correzioni ricevute e gli elementi da consolidare."
      />

      {/* Compact Tab Switcher */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800/80 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('personal_vocab')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'personal_vocab'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Vocabolario</span>
        </button>

        <button
          onClick={() => setActiveTab('corrections')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'corrections'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Correzioni</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-950/40 text-[10px]">
            {correctionsHistory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('flashcards')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'flashcards'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Flashcard</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-950/40 text-[10px]">
            {allChunks.length}
          </span>
        </button>
      </div>

      {/* Tab 0: Vocabolario Personale */}
      {activeTab === 'personal_vocab' && (
        <PersonalVocabularyView onGoToStudio={onGoToStudio} voiceSettings={voiceSettings} />
      )}

      {/* Tab 1: Correzioni */}
      {activeTab === 'corrections' && (
        <div className="space-y-4">
          {correctionsHistory.length === 0 ? (
            <EmptyState
              icon={<Brain className="w-6 h-6 text-amber-400" />}
              title="Nessuna correzione ancora"
              description="Le correzioni ricevute durante le sessioni vocali appariranno qui."
            />
          ) : (
            <div className="space-y-3">
              {correctionsHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2.5 transition-all"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/60 pb-2">
                    <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5" />
                      Correzione nel contesto
                    </span>
                    <span>{item.timestamp}</span>
                  </div>

                  {item.correction.originalText && (
                    <div className="text-xs text-slate-300 flex items-baseline gap-2">
                      <span className="font-bold text-slate-400 text-[11px]">Hai detto:</span>
                      <span className="text-red-400 line-through font-mono">
                        {item.correction.originalText}
                      </span>
                    </div>
                  )}

                  {item.correction.correctedTextEnglishPhrase && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">
                          Forma naturale:
                        </span>
                        <span className="font-bold text-sm text-emerald-300">
                          {item.correction.correctedTextEnglishPhrase}
                        </span>
                      </div>

                      <button
                        onClick={() =>
                          speakPhraseWithGemini(item.correction.correctedTextEnglishPhrase || '')
                        }
                        disabled={audioLoadingText === item.correction.correctedTextEnglishPhrase}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        {audioLoadingText === item.correction.correctedTextEnglishPhrase ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                        <span>Ascolta</span>
                      </button>
                    </div>
                  )}

                  {item.correction.correctedTextItalianExplanation && (
                    <div className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
                      <strong className="text-amber-300 block mb-0.5 font-semibold">
                        Spiegazione:
                      </strong>
                      {item.correction.correctedTextItalianExplanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Flashcard */}
      {activeTab === 'flashcards' && (
        <div className="space-y-6">
          {/* Categories Horizontal Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar">
            <span className="text-xs text-slate-400 font-medium shrink-0 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Categoria:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentFlashcardIndex(0);
                  setIsFlipped(false);
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {filteredChunks.length === 0 ? (
            <EmptyState
              icon={<RotateCw className="w-6 h-6 text-amber-400" />}
              title="Nessuna flashcard disponibile"
              description="Aggiungi materiale nei tuoi materiali per generare flashcard."
            />
          ) : (
            <div className="max-w-md mx-auto space-y-4">
              {/* Card */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full min-h-[220px] bg-slate-900 border-2 border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 flex flex-col justify-between cursor-pointer shadow-xl transition-all"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold text-amber-400 uppercase tracking-wider">
                    {currentChunk.category || 'Generale'}
                  </span>
                  <span>Tocco per girare 🔄</span>
                </div>

                <div className="text-center my-4">
                  {!isFlipped ? (
                    <div className="text-xl sm:text-2xl font-bold text-white">
                      {currentChunk.phrase}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-lg font-bold text-emerald-300">
                        🇮🇹 {currentChunk.translation}
                      </div>
                      {currentChunk.context && (
                        <p className="text-xs text-slate-400 italic">
                          "{currentChunk.context}"
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      speakPhraseWithGemini(currentChunk.phrase);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700 flex items-center gap-1 font-semibold"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Pronuncia</span>
                  </button>

                  <span className="text-slate-500">
                    {currentFlashcardIndex + 1} / {filteredChunks.length}
                  </span>
                </div>
              </div>

              {/* Card Nav Controls */}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentFlashcardIndex((prev) =>
                      prev > 0 ? prev - 1 : filteredChunks.length - 1
                    );
                  }}
                  className="flex-1 min-h-[44px] py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer"
                >
                  ← Precedente
                </button>

                <button
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentFlashcardIndex((prev) => (prev + 1) % filteredChunks.length);
                  }}
                  className="flex-1 min-h-[44px] py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Prossima →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
