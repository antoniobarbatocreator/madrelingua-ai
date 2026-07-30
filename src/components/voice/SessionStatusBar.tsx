import React from 'react';
import { LiveStatus } from '../../lib/geminiLiveEngine';
import { Wifi, WifiOff, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

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
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'connecting':
      case 'reconnecting':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'error':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  const getStatusLabel = () => {
    switch (voiceSessionState) {
      case 'listening':
        return 'Ascolto in corso...';
      case 'thinking':
        return 'Coach sta elaborando...';
      case 'speaking':
        return 'Coach sta parlando...';
      case 'connecting':
        return 'Connessione in corso...';
      case 'reconnecting':
        return 'Riconnessione...';
      default:
        return 'In attesa di avvio';
    }
  };

  return (
    <div
      className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border text-xs font-semibold shadow-sm transition-all ${getStatusColor()}`}
    >
      {liveStatus === 'connected' ? (
        <Wifi className="w-3.5 h-3.5 animate-pulse" />
      ) : liveStatus === 'connecting' || liveStatus === 'reconnecting' ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <WifiOff className="w-3.5 h-3.5" />
      )}
      <span>{getStatusLabel()}</span>
    </div>
  );
};
