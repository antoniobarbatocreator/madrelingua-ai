import React from 'react';
import { LiveStatus } from '../../lib/geminiLiveEngine';
import { RefreshCw } from 'lucide-react';

interface SessionStatusBarProps {
  liveStatus: LiveStatus;
  voiceSessionState: string;
}

export const SessionStatusBar: React.FC<SessionStatusBarProps> = ({
  liveStatus,
  voiceSessionState,
}) => {
  const getStatusColor = () => {
    switch (liveStatus) {
      case 'connected':
        return 'text-emerald-400/90 bg-emerald-500/8 border-emerald-500/12';
      case 'connecting':
      case 'reconnecting':
        return 'text-amber-400/90 bg-amber-500/8 border-amber-500/12';
      case 'error':
        return 'text-red-400/90 bg-red-500/8 border-red-500/12';
      default:
        return 'text-slate-500 bg-white/[0.03] border-white/[0.05]';
    }
  };

  const getStatusLabel = () => {
    switch (voiceSessionState) {
      case 'listening': return 'Ascolto in corso...';
      case 'thinking': return 'Coach sta elaborando...';
      case 'speaking': return 'Coach sta parlando...';
      case 'connecting': return 'Connessione in corso...';
      case 'reconnecting': return 'Riconnessione...';
      default: return 'In attesa di avvio';
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[11px] font-semibold tracking-wide transition-all backdrop-blur-sm ${getStatusColor()}`}>
      {liveStatus === 'connected' ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
        </span>
      ) : liveStatus === 'connecting' || liveStatus === 'reconnecting' ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : (
        <span className="w-2 h-2 rounded-full bg-slate-600" />
      )}
      <span>{getStatusLabel()}</span>
    </div>
  );
};
