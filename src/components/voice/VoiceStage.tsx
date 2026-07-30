import React from 'react';
import { LiveStatus } from '../../lib/geminiLiveEngine';
import { UserLevel, VoiceSettings } from '../../types';
import { VoiceOrb } from './VoiceOrb';
import { SessionStatusBar } from './SessionStatusBar';
import { PhoneOff } from 'lucide-react';

interface VoiceStageProps {
  liveStatus: LiveStatus;
  voiceSessionState: string;
  voiceSettings: VoiceSettings;
  userLevel: UserLevel;
  micVolume: number;
  isSessionStarted?: boolean;
  onOrbClick: () => void;
  onInterrupt: () => void;
  onTerminateSession: () => void;
}

export const VoiceStage: React.FC<VoiceStageProps> = ({
  liveStatus,
  voiceSessionState,
  voiceSettings,
  userLevel,
  micVolume,
  isSessionStarted = false,
  onOrbClick,
  onInterrupt,
  onTerminateSession,
}) => {
  const showTerminateControl =
    isSessionStarted || liveStatus !== 'disconnected' || voiceSessionState !== 'idle';

  const isActive = voiceSessionState !== 'idle';

  return (
    <div className="w-full md:w-[360px] lg:w-[420px] bg-gradient-to-b from-slate-900 to-slate-950 border-b md:border-b-0 md:border-r border-white/[0.04] p-5 sm:p-6 flex flex-col justify-between items-center shrink-0 relative overflow-hidden">

      {/* Ambient top glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)' }}
      />

      {/* Ambient bottom glow */}
      <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.03) 0%, transparent 70%)' }}
      />

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.012] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Top: status + identity */}
      <div className="w-full space-y-4 text-center z-10">
        <SessionStatusBar liveStatus={liveStatus} voiceSessionState={voiceSessionState} />

        <div className="space-y-1.5">
          <h3 className="font-bold text-white text-base tracking-tight">
            Madrelingua Coach
          </h3>
          <div className="flex items-center justify-center gap-2.5 text-xs">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]' : 'bg-slate-600'}`} />
              <span className="text-slate-400 font-medium">{voiceSettings.voiceName || 'Achird'}</span>
            </span>
            <span className="w-px h-3 bg-slate-800" />
            <span className="text-slate-500 font-semibold tracking-wide">{userLevel}</span>
          </div>
        </div>
      </div>

      {/* Center: Orb */}
      <div className="my-6 z-10 flex items-center justify-center">
        <VoiceOrb
          liveStatus={liveStatus}
          voiceSessionState={voiceSessionState}
          micVolume={micVolume}
          onClick={onOrbClick}
          onInterrupt={onInterrupt}
        />
      </div>

      {/* Bottom: controls */}
      <div className="w-full space-y-3 z-10 text-center">
        {showTerminateControl && (
          <button
            onClick={onTerminateSession}
            type="button"
            className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 hover:border-red-500/25 text-red-400/80 hover:text-red-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            title="Termina senza salvare"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>Termina sessione</span>
          </button>
        )}

        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600 pt-1">
          <span className="px-2 py-0.5 rounded-full bg-white/[0.02] border border-white/[0.03]">Conversazione naturale</span>
          <span className="px-2 py-0.5 rounded-full bg-white/[0.02] border border-white/[0.03]">Apprendimento attivo</span>
        </div>
      </div>
    </div>
  );
};
