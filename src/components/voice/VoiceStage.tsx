import React from 'react';
import { LiveStatus } from '../../lib/geminiLiveEngine';
import { UserLevel, VoiceSettings } from '../../types';
import { VoiceOrb } from './VoiceOrb';
import { SessionStatusBar } from './SessionStatusBar';
import { Sparkles, Shield, PhoneOff } from 'lucide-react';

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

  return (
    <div className="w-full md:w-[340px] lg:w-[380px] bg-slate-900/90 border-b md:border-b-0 md:border-r border-slate-800 p-4 sm:p-6 flex flex-col justify-between items-center shrink-0 relative overflow-hidden">
      {/* Background Decorative Blur Gradients */}
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Session Status */}
      <div className="w-full space-y-3 text-center z-10">
        <SessionStatusBar liveStatus={liveStatus} voiceSessionState={voiceSessionState} />

        <div className="space-y-0.5">
          <h3 className="font-extrabold text-white text-base tracking-tight">
            Madrelingua Coach
          </h3>
          <p className="text-xs text-slate-400 font-medium">
            Voce: <span className="text-amber-300 font-bold">{voiceSettings.voiceName || 'Achird'}</span> · Livello {userLevel}
          </p>
        </div>
      </div>

      {/* Central Interactive Voice Orb */}
      <div className="my-6 z-10">
        <VoiceOrb
          liveStatus={liveStatus}
          voiceSessionState={voiceSessionState}
          micVolume={micVolume}
          onClick={onOrbClick}
          onInterrupt={onInterrupt}
        />
      </div>

      {/* Bottom Session Info & Terminate Controls */}
      <div className="w-full space-y-3 z-10 text-center">
        {showTerminateControl && (
          <button
            onClick={onTerminateSession}
            type="button"
            className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
            title="Termina senza salvare e cancella la trascrizione corrente"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Termina sessione</span>
          </button>
        )}

        <div className="flex items-center justify-center space-x-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-3">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            Voci native Gemini
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            Metodo Neuro
          </span>
        </div>
      </div>
    </div>
  );
};
