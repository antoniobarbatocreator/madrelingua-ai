import React from 'react';
import { Mic, PhoneOff, RefreshCw, Volume2, Sparkles, Pause } from 'lucide-react';
import { LiveStatus } from '../../lib/geminiLiveEngine';

interface VoiceOrbProps {
  liveStatus: LiveStatus;
  voiceSessionState: string;
  micVolume: number;
  onClick: () => void;
  onInterrupt?: () => void;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  liveStatus,
  voiceSessionState,
  micVolume,
  onClick,
  onInterrupt,
}) => {
  const isListening = voiceSessionState === 'listening';
  const isSpeaking = voiceSessionState === 'speaking';
  const isThinking = voiceSessionState === 'thinking';
  const isConnecting = voiceSessionState === 'connecting' || voiceSessionState === 'reconnecting';
  const isActive = isListening || isSpeaking || isThinking || isConnecting;

  // Scale calculations for reactive orb animations
  const volumeScale = 1 + Math.min(micVolume * 1.5, 0.4);

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer Glow Ring */}
      {isActive && (
        <div
          className={`absolute rounded-full transition-all duration-150 ${
            isSpeaking
              ? 'w-36 h-36 bg-amber-500/20 border border-amber-500/40 animate-pulse'
              : isThinking
              ? 'w-36 h-36 bg-teal-500/20 border border-teal-500/40 animate-spin'
              : 'w-36 h-36 bg-amber-500/10 border border-amber-500/20'
          }`}
          style={{
            transform: isListening ? `scale(${volumeScale})` : 'scale(1)',
          }}
        />
      )}

      {/* Main Interactive Button */}
      <button
        onClick={() => {
          if (isSpeaking && onInterrupt) onInterrupt();
          else onClick();
        }}
        type="button"
        className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer shadow-2xl active:scale-95 ${
          isActive
            ? isSpeaking
              ? 'bg-amber-500 text-slate-950 shadow-amber-500/30'
              : isThinking
              ? 'bg-teal-600 text-white shadow-teal-500/30'
              : 'bg-amber-500 text-slate-950 shadow-amber-500/20'
            : 'bg-slate-900 border-2 border-slate-700 hover:border-amber-500/80 text-amber-400 hover:bg-slate-800'
        }`}
        title={isSpeaking ? 'Interrompi il coach e parla' : isActive ? 'Gestisci il tuo turno vocale' : 'Inizia la sessione vocale'}
      >
        {isConnecting ? (
          <RefreshCw className="w-8 h-8 animate-spin" />
        ) : isSpeaking ? (
          <Volume2 className="w-8 h-8 animate-bounce" />
        ) : isThinking ? (
          <Sparkles className="w-8 h-8 animate-spin" />
        ) : isActive ? (
          <Mic className="w-8 h-8 animate-pulse" />
        ) : (
          <Mic className="w-8 h-8" />
        )}

        <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">
          {isConnecting
            ? 'Connetto'
            : isSpeaking
            ? 'Parla'
            : isThinking
            ? 'Elabora'
            : isActive
            ? 'Ascolta'
            : 'Inizia'}
        </span>
      </button>

      {/* Interrupt Coach Floating Button when speaking */}
      {isSpeaking && onInterrupt && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInterrupt();
          }}
          type="button"
          className="absolute -bottom-10 z-20 px-3 py-1.5 rounded-full bg-slate-900 border border-amber-500/50 text-amber-300 hover:bg-slate-800 text-[11px] font-bold flex items-center space-x-1 shadow-lg cursor-pointer animate-fadeIn"
        >
          <Pause className="w-3 h-3 fill-current" />
          <span>Interrompi</span>
        </button>
      )}
    </div>
  );
};
