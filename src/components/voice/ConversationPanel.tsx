import React from 'react';
import { ChatMessage } from '../../types';
import { LearningRuntimeState } from '../../types/learningSession';
import { MessageBubble } from './MessageBubble';
import { TextComposer } from './TextComposer';
import { Sparkles, Save, Bookmark } from 'lucide-react';
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

  // Dynamic subtitle based on activity or context
  const getSubtitle = () => {
    if (messages.length === 0) {
      return 'Trascrizione in tempo reale';
    }
    return 'Tocca una parola del coach per scoprirne il significato';
  };

  const getHeaderTitle = () => {
    if (!learningRuntimeState || learningRuntimeState.learningMode === 'activity_selection') {
      return 'Scegli attività';
    }
    if (learningRuntimeState.learningMode === 'learn_new_vocabulary' || learningRuntimeState.learningMode === 'topic_exploration') {
      const packId = learningRuntimeState.activeTopicPackId;
      const moduleId = learningRuntimeState.activeModuleId;
      if (packId) {
        const pack = getTopicPack(packId);
        const mod = moduleId ? getModule(packId, moduleId) : undefined;
        const packTitle = pack?.title || packId;
        const modTitle = mod?.title ? ` (${mod.title})` : '';
        return `Impara nuove parole · ${packTitle}${modTitle}`;
      }
      return 'Impara nuove parole';
    }
    if (learningRuntimeState.learningMode === 'knowledge_review') {
      return 'Ripassa le tue parole';
    }
    if (learningRuntimeState.learningMode === 'learning_games') {
      return 'Giochi linguistici';
    }
    if (learningRuntimeState.learningMode === 'free_conversation') {
      return 'Conversazione libera';
    }
    return 'Scegli attività';
  };

  const getBadgeLabel = () => {
    if (!learningRuntimeState || learningRuntimeState.learningMode === 'activity_selection') {
      return 'Scegli attività';
    }
    if (learningRuntimeState.learningMode === 'free_conversation') {
      return 'Conversazione libera';
    }
    if (learningRuntimeState.learningMode === 'knowledge_review') {
      return `Ripasso · ${learningRuntimeState.completedItemCount || 0} completati`;
    }
    if (learningRuntimeState.learningMode === 'learn_new_vocabulary' || learningRuntimeState.learningMode === 'topic_exploration') {
      const packId = learningRuntimeState.activeTopicPackId;
      if (packId) {
        const pack = getTopicPack(packId);
        return `Impara nuove parole · ${pack?.title || packId}`;
      }
      return 'Impara nuove parole';
    }
    if (learningRuntimeState.learningMode === 'learning_games') {
      const gameType = learningRuntimeState.gameRuntimeState?.gameType;
      const roundNum = learningRuntimeState.gameRuntimeState?.roundNumber || 1;
      const targetRounds = learningRuntimeState.gameRuntimeState?.targetRounds || 5;
      const gameName =
        gameType === 'quick_translation' ? 'Traduzione lampo' :
        gameType === 'complete_sentence' ? 'Completa la frase' :
        gameType === 'find_the_error' ? 'Trova l’errore' :
        gameType === 'most_natural' ? 'Più naturale' :
        gameType === 'guess_expression' ? 'Indovina la parola' :
        gameType === 'language_taboo' ? 'Taboo linguistico' :
        gameType === 'chain_story' ? 'Storia a catena' :
        gameType === 'phrasal_verb_challenge' ? 'Sfida phrasal verb' :
        'Giochi linguistici';
      return `${gameName} · Round ${roundNum}/${targetRounds}`;
    }
    return 'Scegli attività';
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden min-h-0 relative">
      
      {/* Resumed Session Banner if present */}
      {resumedTitle && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-300 font-semibold flex items-center gap-2 shrink-0">
          <Bookmark className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate">Ripresa da: <strong className="text-white">{resumedTitle}</strong></span>
        </div>
      )}

      {/* Conversation Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold text-white tracking-tight truncate max-w-[280px] sm:max-w-md">
              {getHeaderTitle()}
            </h2>
            
            {/* Activity Badge */}
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/80 text-[11px] text-slate-300 font-medium truncate max-w-[180px] sm:max-w-none">
              {getBadgeLabel()}
            </span>

            {/* Score during games */}
            {learningRuntimeState?.learningMode === 'learning_games' && learningRuntimeState.gameRuntimeState?.score !== undefined && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                {learningRuntimeState.gameRuntimeState.score} pt
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 font-normal">
            {getSubtitle()}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRequestChangeActivity}
            type="button"
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer min-h-[32px]"
            title="Scegli a voce la nuova attività"
          >
            <span>Scegli attività</span>
          </button>

          <button
            onClick={onManualSave}
            disabled={!hasUserMessages}
            type="button"
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-slate-700 disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer min-h-[32px]"
            title="Salva la conversazione nello storico"
          >
            <Save className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Salva</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 scrollbar-none">
        
        {/* Welcome State Card when empty */}
        {messages.length === 0 && !liveUserTranscript && !liveTeacherTranscript && (
          <div className="max-w-md mx-auto my-6 sm:my-10 p-6 bg-slate-900/90 border border-slate-800/80 rounded-2xl text-center space-y-3.5 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Il tuo spazio per la lingua inglese
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Puoi avviare una conversazione vocale oppure scrivere direttamente in chat senza attivare il microfono.
            </p>
            <div className="pt-2 border-t border-slate-800/60">
              <span className="text-[11px] text-amber-300 font-medium">
                Tocca "Inizia" in alto per la voce o scrivi un messaggio qui sotto.
              </span>
            </div>
          </div>
        )}

        {/* Finalized Chat Messages */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            activePlayingMsgId={activePlayingMsgId}
            onSpeakMessage={onSpeakMessage}
            onSelectWord={onSelectWord}
          />
        ))}

        {/* Text Chat Sending Loading Indicator */}
        {isSendingText && (
          <div className="flex items-center space-x-2 my-2 p-3.5 bg-slate-900/90 border border-amber-500/30 rounded-2xl max-w-xs text-xs text-amber-300 font-medium animate-pulse shadow-md">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            <span>Il coach sta elaborando la risposta…</span>
          </div>
        )}

        {/* Real-time Streaming User Speech Bubble */}
        {liveUserTranscript && (
          <div className="flex flex-col items-end space-y-1 my-1.5 animate-fadeIn">
            <div className="flex items-center space-x-2 text-[11px] text-amber-400 font-bold px-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Tu (In corso…)</span>
            </div>
            <div className="max-w-[88%] sm:max-w-2xl rounded-2xl p-3.5 bg-amber-500/90 text-slate-950 rounded-tr-none font-medium shadow-lg border border-amber-400/50">
              <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap italic">
                {liveUserTranscript}
              </div>
            </div>
          </div>
        )}

        {/* Real-time Streaming Coach Speech Bubble */}
        {liveTeacherTranscript && (
          <div className="flex flex-col items-start space-y-1 my-1.5 animate-fadeIn">
            <div className="flex items-center space-x-2 text-[11px] text-teal-400 font-bold px-1">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>Madrelingua Coach (Risposta in corso…)</span>
            </div>
            <div className="max-w-[88%] sm:max-w-2xl rounded-2xl p-3.5 sm:p-4.5 bg-slate-900 border border-teal-500/40 text-slate-100 rounded-tl-none shadow-lg space-y-2">
              <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                {liveTeacherTranscript}
              </div>
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Sticky Text Composer */}
      <TextComposer onSendMessage={onSendTextMessage} />
    </div>
  );
};
