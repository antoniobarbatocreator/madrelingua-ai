import React from 'react';
import { Mic, RefreshCw, Volume2, Loader2, Pause } from 'lucide-react';
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

  const volumeScale = 1 + Math.min(micVolume * 1.2, 0.3);

  const orbSize = 200;
  const btnSize = 120;

  return (
    <div className="relative flex items-center justify-center" style={{ width: orbSize, height: orbSize }}>

      {/* Outermost volumetric glow */}
      {isActive && (
        <div
          className="absolute rounded-full transition-all duration-700"
          style={{
            width: orbSize + 40,
            height: orbSize + 40,
            left: -20,
            top: -20,
            background: isSpeaking
              ? 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)'
              : isThinking
              ? 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)',
            transform: isListening ? `scale(${volumeScale})` : 'scale(1)',
            transition: 'transform 120ms ease-out, background 500ms ease',
          }}
        />
      )}

      {/* Outer conic gradient ring */}
      {isActive && (
        <div
          className={`absolute rounded-full ${isThinking ? 'animate-thinkingOrbit' : 'animate-orbGradientSpin'} ${isSpeaking ? 'animate-orbAuroraShift' : ''}`}
          style={{ width: 168, height: 168 }}
        >
          <div
            className="w-full h-full rounded-full"
            style={{
              background: isSpeaking
                ? 'conic-gradient(from 0deg, #f59e0b, #ef4444, #f59e0b, transparent 40%, #f59e0b)'
                : isThinking
                ? 'conic-gradient(from 0deg, #14b8a6, #06b6d4, #14b8a6, transparent 40%, #14b8a6)'
                : 'conic-gradient(from 0deg, #f59e0b, transparent 30%, #f59e0b 50%, transparent 80%)',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
              opacity: isSpeaking ? 0.85 : 0.5,
            }}
          />
        </div>
      )}

      {/* Breathing pulse ring */}
      {isSpeaking && (
        <div
          className="absolute rounded-full border border-amber-400/25 animate-speakingWave"
          style={{ width: 178, height: 178 }}
        />
      )}

      {/* Second subtle ring for speaking depth */}
      {isSpeaking && (
        <div
          className="absolute rounded-full border border-amber-500/10 animate-orbPulseRing"
          style={{ width: 190, height: 190 }}
        />
      )}

      {/* Inner radial ambient */}
      {isActive && (
        <div
          className="absolute rounded-full"
          style={{
            width: 150,
            height: 150,
            background: isSpeaking
              ? 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)'
              : isThinking
              ? 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Main button */}
      <button
        onClick={() => {
          if (isSpeaking && onInterrupt) onInterrupt();
          else onClick();
        }}
        type="button"
        className={`relative z-10 rounded-full flex flex-col items-center justify-center transition-all duration-300 cursor-pointer active:scale-[0.96] ${
          isActive
            ? isSpeaking
              ? 'text-slate-950'
              : isThinking
              ? 'text-white'
              : 'text-slate-950'
            : 'bg-slate-900/60 border border-slate-700/50 text-slate-400 hover:text-amber-400 hover:border-amber-500/30'
        }`}
        style={{
          width: btnSize,
          height: btnSize,
          ...(isActive
            ? {
                background: isSpeaking
                  ? 'linear-gradient(145deg, #fbbf24, #f59e0b, #d97706)'
                  : isThinking
                  ? 'linear-gradient(145deg, #2dd4bf, #14b8a6, #0d9488)'
                  : 'linear-gradient(145deg, #fbbf24, #f59e0b, #d97706)',
                boxShadow: isSpeaking
                  ? '0 0 50px rgba(245,158,11,0.3), 0 4px 24px rgba(245,158,11,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                  : isThinking
                  ? '0 0 50px rgba(20,184,166,0.25), 0 4px 24px rgba(20,184,166,0.15), inset 0 1px 0 rgba(255,255,255,0.15)'
                  : '0 0 40px rgba(245,158,11,0.15), 0 4px 20px rgba(245,158,11,0.1), inset 0 1px 0 rgba(255,255,255,0.15)',
              }
            : {}),
        }}
        title={isSpeaking ? 'Interrompi il coach e parla' : isActive ? 'Gestisci il tuo turno vocale' : 'Inizia la sessione vocale'}
      >
        <div className={isActive && !isConnecting ? 'animate-orbBreath' : ''}>
          {isConnecting ? (
            <RefreshCw className="w-7 h-7 animate-spin" />
          ) : isSpeaking ? (
            <Volume2 className="w-7 h-7" />
          ) : isThinking ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : (
            <Mic className="w-7 h-7" />
          )}
        </div>

        <span className={`text-[10px] font-bold mt-1.5 uppercase tracking-[0.15em] ${
          !isActive ? 'text-slate-500' : ''
        }`}>
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

      {/* Interrupt floating pill */}
      {isSpeaking && onInterrupt && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInterrupt();
          }}
          type="button"
          className="absolute -bottom-10 z-20 px-4 py-2 rounded-full bg-slate-900/90 backdrop-blur-xl border border-amber-500/25 text-amber-300 hover:bg-slate-800/90 hover:border-amber-400/40 text-[11px] font-bold flex items-center gap-1.5 shadow-xl cursor-pointer animate-fadeIn transition-all"
        >
          <Pause className="w-3 h-3 fill-current" />
          <span>Interrompi</span>
        </button>
      )}
    </div>
  );
};
