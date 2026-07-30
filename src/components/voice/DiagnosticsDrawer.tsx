import React from 'react';
import { LiveDiagnostics, LiveStatus } from '../../lib/geminiLiveEngine';
import { LearningRuntimeState } from '../../types/learningSession';
import { ReviewIndexDiagnostics } from '../../lib/knowledgeReviewIndex';
import { X, Activity, RefreshCw, Database, Terminal, ShieldAlert } from 'lucide-react';

interface DiagnosticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: LiveDiagnostics | null;
  liveStatus: LiveStatus;
  voiceSessionState: string;
  learningRuntimeState: LearningRuntimeState | null;
  reviewIndexDiagnostics?: ReviewIndexDiagnostics | null;
}

export const DiagnosticsDrawer: React.FC<DiagnosticsDrawerProps> = ({
  isOpen,
  onClose,
  diagnostics,
  liveStatus,
  voiceSessionState,
  learningRuntimeState,
  reviewIndexDiagnostics,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-slate-950/95 border-l border-slate-800 backdrop-blur-md shadow-2xl flex flex-col text-xs text-slate-200 animate-slideLeft">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2 text-amber-400 font-bold">
          <Activity className="w-4 h-4" />
          <span>Diagnostica di Sistema</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono">
        {/* Connection status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 text-sky-400" />
            Stato Connessione Live
          </div>
          <div className="text-sm font-bold text-emerald-400">{liveStatus}</div>
          <div className="text-xs text-slate-300">Stato Voce: <span className="text-amber-300">{voiceSessionState}</span></div>
        </div>

        {/* Learning Session State */}
        {learningRuntimeState && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-amber-400" />
              Runtime Attività
            </div>
            <div className="text-xs text-amber-300 font-bold">
              Modalità: {learningRuntimeState.learningMode}
            </div>
            {learningRuntimeState.topic && (
              <div className="text-xs text-slate-300">
                Argomento: {learningRuntimeState.topic}
              </div>
            )}
            {learningRuntimeState.activityPhase && (
              <div className="text-xs text-slate-400">
                Fase: {learningRuntimeState.activityPhase}
              </div>
            )}
            {learningRuntimeState.lessonStep && (
              <div className="text-xs text-slate-400">
                Passo lezione: {learningRuntimeState.lessonStep}
              </div>
            )}
            {learningRuntimeState.currentItem && (
              <div className="mt-1 pt-1 border-t border-slate-800 text-[11px] text-emerald-300">
                Target: {learningRuntimeState.currentItem.expression} ({learningRuntimeState.currentItem.translationIt})
              </div>
            )}
          </div>
        )}

        {/* Index Review Diagnostics */}
        {reviewIndexDiagnostics && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <Database className="w-3 h-3 text-purple-400" />
              Indice di Ripasso
            </div>
            <div className="text-xs text-slate-300">
              Chnk estratti: <strong className="text-white">{reviewIndexDiagnostics.extractedChunksCount}</strong>
            </div>
            <div className="text-xs text-slate-300">
              Lunghezza testo: <strong className="text-white">{reviewIndexDiagnostics.formattedTextCharLength} car.</strong>
            </div>
          </div>
        )}

        {/* Engine Diagnostics */}
        {diagnostics && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400">Metriche Basso Livello</div>
            <div className="text-xs text-slate-300">Audio In Buffer: {diagnostics.audioInputBufferSize || 0}</div>
            <div className="text-xs text-slate-300">Audio Out Chunks: {diagnostics.audioOutputChunkCount || 0}</div>
            {diagnostics.lastError && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-[11px] flex items-start gap-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{diagnostics.lastError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
