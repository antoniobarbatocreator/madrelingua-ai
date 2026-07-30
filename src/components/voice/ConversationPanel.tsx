import React from 'react';
import { ChatMessage } from '../../types';
import { LearningRuntimeState } from '../../types/learningSession';
import { MessageBubble } from './MessageBubble';
import { TextComposer } from './TextComposer';
import { MessageCircle, Save, Bookmark, Loader2, Mic } from 'lucide-react';
import { getTopicPack, getModule } from '../../lib/topicPacks/registry';

interface ConversationPanelProps {
  messages: ChatMessage[];
  liveUserTranscript: string;
  liveTeacherTranscript: string;
  learningRuntimeState: LearningRuntimeState | null;
  resumedTitle?: string | null;
  activePlayingMsgId: string | null;
  isSendingText?: boolean;
  onSpeakMessage: (msgText: string, msgId: string) => void;
  onSelectWord: (word: string, sentence: string, messageId: string) => void;
  onSendTextMessage: (text: string) => void;
  onRequestChangeActivity: () => void;
  onManualSave: () => void;
  transcriptEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  messages,
  liveUserTranscript,
  liveTeacherTranscript,
  learningRuntimeState,
  resumedTitle,
  activePlayingMsgId,
  isSendingText = false,
  onSpeakMessage,
  onSelectWord,
  onSendTextMessage,
  onRequestChangeActivity,
  onManualSave,
  transcriptEndRef,
}) => {
  const hasUserMessages = messages.some((m) => m.sender === 'user');

  const getSubtitle = () => {
    if (messages.length === 0) return 'Trascrizione in tempo reale';
    return 'Tocca una parola del coach per scoprirne il significato';
  };

  const getHeaderTitle = () => {
    if (!learningRuntimeState || learningRuntimeState.learningMode === 'activity_selection') return 'Scegli attività';
    if (learningRuntimeState.learningMode === 'learn_new_vocabulary' || learningRuntimeState.learningMode === 'topic_exploration') {
      const packId = learningRuntimeState.activeTopicPackId;
      const moduleId = learningRuntimeState.activeModuleId;
      if (packId) {
        const pack = getTopicPack(packId);
        const mod = moduleId ? getModule(packId, moduleId) : undefined;
        return `Impara nuove parole · ${pack?.title || packId}${mod?.title ? ` (${mod.title})` : ''}`;
      }
      return 'Impara nuove parole';
    }
    if (learningRuntimeState.learningMode === 'knowledge_review') return 'Ripassa le tue parole';
    if (learningRuntimeState.learningMode === 'learning_games') return 'Giochi linguistici';
    if (learningRuntimeState.learningMode === 'free_conversation') return 'Conversazione libera';
    return 'Scegli attività';
  };

  const getBadgeLabel = () => {
    if (!learningRuntimeState || learningRuntimeState.learningMode === 'activity_selection') return 'Scegli attività';
    if (learningRuntimeState.learningMode === 'free_conversation') return 'Conversazione libera';
    if (learningRuntimeState.learningMode === 'knowledge_review') return `Ripasso · ${learningRuntimeState.completedItemCount || 0} completati`;
    if (learningRuntimeState.learningMode === 'learn_new_vocabulary' || learningRuntimeState.learningMode === 'topic_exploration') {
      const packId = learningRuntimeState.activeTopicPackId;
      if (packId) { const pack = getTopicPack(packId); return `Impara nuove parole · ${pack?.title || packId}`; }
      return 'Impara nuove parole';
    }
    if (learningRuntimeState.learningMode === 'learning_games') {
      const gs = learningRuntimeState.gameRuntimeState;
      const gameName = gs?.gameType === 'quick_translation' ? 'Traduzione lampo' : gs?.gameType === 'complete_sentence' ? 'Completa la frase' : gs?.gameType === 'find_the_error' ? 'Trova l\'errore' : gs?.gameType === 'most_natural' ? 'Più naturale' : gs?.gameType === 'guess_expression' ? 'Indovina la parola' : gs?.gameType === 'language_taboo' ? 'Taboo linguistico' : gs?.gameType === 'chain_story' ? 'Storia a catena' : gs?.gameType === 'phrasal_verb_challenge' ? 'Sfida phrasal verb' : 'Giochi linguistici';
      return `${gameName} · Round ${gs?.roundNumber || 1}/${gs?.targetRounds || 5}`;
    }
    return 'Scegli attività';
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden min-h-0 relative">

      {/* Resumed session banner */}
      {resumedTitle && (
        <div className="bg-amber-500/8 border-b border-amber-500/15 px-4 py-2.5 text-xs text-amber-300/80 font-medium flex items-center gap-2 shrink-0">
          <Bookmark className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
          <span className="truncate">Ripresa da: <strong className="text-white">{resumedTitle}</strong></span>
        </div>
      )}

      {/* Header */}
      <div className="glass-surface border-b border-white/[0.04] px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-tight truncate max-w-[280px] sm:max-w-md">
              {getHeaderTitle()}
            </h2>
            <span className="px-2 py-0.5 rounded-lg bg-white/[0.05] border border-white/[0.06] text-[11px] text-slate-400 font-medium truncate max-w-[180px] sm:max-w-none">
              {getBadgeLabel()}
            </span>
            {learningRuntimeState?.learningMode === 'learning_games' && learningRuntimeState.gameRuntimeState?.score !== undefined && (
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold">
                {learningRuntimeState.gameRuntimeState.score} pt
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">{getSubtitle()}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onRequestChangeActivity}
            type="button"
            className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.06] text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer min-h-[32px]"
          >
            Scegli attività
          </button>
          <button
            onClick={onManualSave}
            disabled={!hasUserMessages}
            type="button"
            className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-amber-400/80 text-xs font-semibold border border-white/[0.06] disabled:opacity-30 flex items-center gap-1.5 transition-all cursor-pointer min-h-[32px]"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salva</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0">

        {/* Welcome card */}
        {messages.length === 0 && !liveUserTranscript && !liveTeacherTranscript && (
          <div className="max-w-sm mx-auto my-10 sm:my-16 text-center space-y-6 animate-fadeIn">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-600/5 animate-subtleGlow" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/15 text-amber-400/80 flex items-center justify-center">
                <MessageCircle className="w-7 h-7" />
              </div>
            </div>
            <div className="space-y-2.5">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Il tuo spazio per la lingua inglese
              </h3>
              <p className="text-[13px] text-slate-400 leading-relaxed max-w-[260px] mx-auto">
                Avvia una conversazione vocale oppure scrivi un messaggio qui sotto.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="h-px flex-1 max-w-[50px] bg-gradient-to-r from-transparent to-slate-800" />
              <span className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
                <Mic className="w-3 h-3" />
                Tocca "Inizia" per la voce
              </span>
              <span className="h-px flex-1 max-w-[50px] bg-gradient-to-l from-transparent to-slate-800" />
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            activePlayingMsgId={activePlayingMsgId}
            onSpeakMessage={onSpeakMessage}
            onSelectWord={onSelectWord}
          />
        ))}

        {/* Sending indicator */}
        {isSendingText && (
          <div className="flex items-center gap-2 my-2 p-3.5 glass-card rounded-xl max-w-xs text-xs text-slate-400 font-medium animate-pulse">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            <span>Il coach sta elaborando la risposta…</span>
          </div>
        )}

        {/* Live user transcript */}
        {liveUserTranscript && (
          <div className="flex flex-col items-end space-y-1 my-1.5 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80 font-medium px-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
              </span>
              <span>Tu (In corso…)</span>
            </div>
            <div className="max-w-[85%] sm:max-w-xl rounded-2xl rounded-tr-sm p-3.5 bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-medium shadow-lg shadow-amber-500/10">
              <div className="text-sm leading-relaxed whitespace-pre-wrap italic">{liveUserTranscript}</div>
            </div>
          </div>
        )}

        {/* Live coach transcript */}
        {liveTeacherTranscript && (
          <div className="flex flex-col items-start space-y-1 my-1.5 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-[11px] text-teal-400/80 font-medium px-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-400" />
              </span>
              <span>Coach (Risposta in corso…)</span>
            </div>
            <div className="max-w-[85%] sm:max-w-xl rounded-2xl rounded-tl-sm p-3.5 glass-card text-slate-100 shadow-lg">
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{liveTeacherTranscript}</div>
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      <TextComposer onSendMessage={onSendTextMessage} />
    </div>
  );
};
