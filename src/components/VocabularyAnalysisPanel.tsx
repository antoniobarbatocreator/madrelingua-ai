import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Bookmark,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Volume2,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Check,
} from 'lucide-react';
import { VocabularyAnalysisResult } from '../lib/vocabularyAnalysisCache';
import { PersonalVocabularyItem, personalVocabularyRepository } from '../lib/personalVocabularyRepository';

interface VocabularyAnalysisPanelProps {
  selectedWord: string;
  fullSentence: string;
  messageId: string;
  userLevel?: string;
  onClose: () => void;
  onSavedToast?: (msg: string) => void;
}

export const VocabularyAnalysisPanel: React.FC<VocabularyAnalysisPanelProps> = ({
  selectedWord,
  fullSentence,
  messageId,
  userLevel = 'B1_B2',
  onClose,
  onSavedToast,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimit, setIsRateLimit] = useState(false);
  const [analysis, setAnalysis] = useState<VocabularyAnalysisResult | null>(null);
  const [activeSelectionText, setActiveSelectionText] = useState<string>(selectedWord);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fetchAnalysis = async (textToAnalyze: string) => {
    setLoading(true);
    setError(null);
    setIsRateLimit(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch('/api/vocabulary/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          selectedText: textToAnalyze,
          fullSentence,
          cefrLevel: userLevel,
          interfaceLanguage: 'it',
        }),
      });

      clearTimeout(timeoutId);

      const json = await res.json();

      if (!res.ok || json.ok === false) {
        if (res.status === 429 || json.error?.code === 'RATE_LIMIT') {
          setIsRateLimit(true);
          throw new Error('Analisi temporaneamente non disponibile.');
        }
        throw new Error('Non sono riuscito ad analizzare questa espressione.');
      }

      const data: VocabularyAnalysisResult = json.data || json;
      setAnalysis(data);

      const norm = textToAnalyze.toLowerCase().trim();
      const existing = await personalVocabularyRepository.getItemByNormalized(norm);
      setIsSaved(!!existing);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Vocabulary analysis error:', err);
      if (err.name === 'AbortError') {
        setError("L'analisi sta richiedendo più tempo del previsto.");
      } else if (!isRateLimit) {
        setError(err.message || 'Non sono riuscito ad analizzare questa espressione.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveSelectionText(selectedWord);
    fetchAnalysis(selectedWord);
  }, [selectedWord, fullSentence]);

  const handleSaveToVocabulary = async (fallbackSave = false) => {
    if (saving) return;
    setSaving(true);
    try {
      const expressionToSave = analysis?.recommendedExpression || activeSelectionText;
      const res = await personalVocabularyRepository.saveOrUpdateItem({
        expression: expressionToSave,
        translationIt: analysis?.translationIt || 'Definizione personale',
        lemma: analysis?.lemma,
        type: analysis?.type || 'word',
        contextualMeaningIt: analysis?.contextualMeaningIt,
        pronunciationIpa: analysis?.pronunciationIpa,
        sourceSentence: fullSentence,
        exampleEnglish: analysis?.exampleEnglish,
        exampleItalian: analysis?.exampleItalian,
        cefrEstimate: analysis?.cefrEstimate,
        tags: analysis?.tags,
        sourceMessageId: messageId,
      });

      setIsSaved(true);
      if (onSavedToast) {
        onSavedToast(`"${expressionToSave}" salvato nel tuo vocabolario!`);
      }
    } catch (e: any) {
      console.error('Failed to save to vocabulary:', e);
    } finally {
      setSaving(false);
    }
  };

  const getTypeBadgeStyle = (type?: string) => {
    switch (type) {
      case 'phrasal_verb':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'chunk':
      case 'collocation':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'idiom':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col justify-end md:justify-center md:items-end p-0 md:p-6 animate-fadeIn">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Sheet / Drawer Container */}
      <div className="relative w-full md:max-w-md bg-slate-900 border-t md:border border-slate-800 rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100 z-10 animate-slideUp">
        {/* Top Handle for mobile */}
        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-2.5 md:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Vocabolario contestuale
            </span>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-200">
                Analizzo "{activeSelectionText}" nel contesto...
              </p>
            </div>
          ) : isRateLimit ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>Analisi temporaneamente non disponibile</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Potrai riprovare tra poco oppure salvare subito l'espressione nel tuo vocabolario.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleSaveToVocabulary(true)}
                  className="flex-1 min-h-[40px] py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  Salva comunque
                </button>
                <button
                  onClick={() => fetchAnalysis(activeSelectionText)}
                  className="px-3.5 min-h-[40px] py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 cursor-pointer"
                >
                  Riprova
                </button>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 text-center">
              <p className="text-slate-300">{error}</p>
              <button
                onClick={() => fetchAnalysis(activeSelectionText)}
                className="min-h-[40px] px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl cursor-pointer"
              >
                Riprova
              </button>
            </div>
          ) : analysis ? (
            <>
              {/* Word Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {analysis.recommendedExpression || activeSelectionText}
                    </h3>
                    {analysis.lemma && (
                      <span className="text-[11px] text-slate-400 block font-mono">
                        Forma base: {analysis.lemma}
                      </span>
                    )}
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${getTypeBadgeStyle(
                      analysis.type
                    )}`}
                  >
                    {analysis.type || 'Espressione'}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <div className="text-sm font-bold text-emerald-400">
                    {analysis.translationIt}
                  </div>
                  {analysis.contextualMeaningIt && (
                    <p className="text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      {analysis.contextualMeaningIt}
                    </p>
                  )}
                </div>
              </div>

              {/* Context Sentence */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Frase dalla conversazione:
                </span>
                <div className="p-3 bg-slate-950 border-l-2 border-amber-500 rounded-xl text-slate-200">
                  "{fullSentence}"
                </div>
              </div>

              {/* Example */}
              {analysis.exampleEnglish && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Esempio pratico:
                  </span>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                    <p className="font-semibold text-amber-200">"{analysis.exampleEnglish}"</p>
                    {analysis.exampleItalian && (
                      <p className="text-slate-400">"{analysis.exampleItalian}"</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Sticky Footer Action */}
        {!loading && !isRateLimit && !error && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
            <button
              onClick={() => handleSaveToVocabulary(false)}
              disabled={isSaved || saving}
              className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                isSaved
                  ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/10'
              }`}
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Salvato nel tuo Vocabolario</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" />
                  <span>{saving ? 'Salvataggio...' : 'Salva nel vocabolario'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
