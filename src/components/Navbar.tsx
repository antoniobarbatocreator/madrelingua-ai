import React from 'react';
import { UserLevel, ActiveTab, VoiceSettings } from '../types';
import { Mic, BookOpen, Compass, RotateCcw, Sliders, Download, History, Share2 } from 'lucide-react';
import { LEVEL_PROFILES } from '../lib/levelProfiles';
import { SettingsDrawer } from './SettingsDrawer';
import { geminiLiveEngine } from '../lib/geminiLiveEngine';
import { AppLogo } from './AppLogo';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  userLevel: UserLevel;
  knowledgeCount: number;
  voiceSettings: VoiceSettings;
  onSaveAppSettings: (voiceSettings: VoiceSettings, userLevel: UserLevel) => boolean;
}

const desktopTabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
  { id: 'studio', label: 'Studio', icon: Mic },
  { id: 'knowledge', label: 'Materiali', icon: BookOpen },
  { id: 'method', label: 'Metodo', icon: Compass },
  { id: 'review', label: 'Ripasso', icon: RotateCcw },
  { id: 'history', label: 'Sessioni', icon: History },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  userLevel,
  knowledgeCount,
  voiceSettings,
  onSaveAppSettings,
}) => {
  const [showSettings, setShowSettings] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [showPwaHelp, setShowPwaHelp] = React.useState(false);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsStandalone(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowPwaHelp(!showPwaHelp);
    }
  };

  const isSessionConnected = geminiLiveEngine.getStatus() !== 'disconnected';

  return (
    <>
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-2xl border-b border-white/[0.05] text-slate-100 pt-safe">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-[60px]">
            <AppLogo size="md" />

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.04]">
              {desktopTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative min-h-[36px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'tab-active text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 transition-colors ${isActive ? 'text-amber-400' : ''}`} />
                    <span>{tab.label}</span>
                    {tab.id === 'knowledge' && knowledgeCount > 0 && (
                      <span className="ml-0.5 px-1.5 min-w-[18px] text-center rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 leading-4">
                        {knowledgeCount}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right controls */}
            <div className="flex items-center gap-1.5">
              {!isStandalone && (
                <button
                  onClick={handleInstallClick}
                  className="flex items-center gap-1.5 min-h-[36px] px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 text-xs font-medium transition-all shrink-0 cursor-pointer"
                  title="Installa applicazione"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Installa</span>
                </button>
              )}

              <button
                onClick={() => setShowSettings(true)}
                className="hidden sm:flex min-h-[36px] px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 hover:text-white transition-all items-center gap-2 shrink-0 text-xs font-medium cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.4)]" />
                <span>{((LEVEL_PROFILES[userLevel] || LEVEL_PROFILES.B1_B2).label || (LEVEL_PROFILES[userLevel] || LEVEL_PROFILES.B1_B2).name || '').split(/[·•]/)[0].trim()}</span>
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="min-h-[36px] min-w-[36px] sm:w-auto sm:px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2 shrink-0 text-xs font-medium cursor-pointer"
                title="Impostazioni"
              >
                <Sliders className="w-4 h-4" />
                <span className="hidden lg:inline">Impostazioni</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        voiceSettings={voiceSettings}
        userLevel={userLevel}
        onSaveSettings={onSaveAppSettings}
        isSessionActive={isSessionConnected}
      />

      {/* PWA help modal */}
      {showPwaHelp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-white/[0.06] rounded-2xl max-w-sm w-full p-5 text-slate-100 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center space-x-2 font-bold text-amber-400 text-sm">
                <Download className="w-4 h-4" />
                <span>Installa Madrelingua</span>
              </div>
              <button onClick={() => setShowPwaHelp(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer transition-colors">
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs leading-relaxed text-slate-200">
              <div className="p-3.5 rounded-xl glass-card space-y-1.5">
                <strong className="text-amber-300 block font-semibold">iOS (Safari)</strong>
                <p>1. Tocca il pulsante <strong>Condividi <Share2 className="w-3.5 h-3.5 inline text-amber-400" /></strong>.</p>
                <p>2. Seleziona <strong>"Aggiungi alla schermata Home"</strong>.</p>
              </div>
              <div className="p-3.5 rounded-xl glass-card space-y-1.5">
                <strong className="text-emerald-300 block font-semibold">Android (Chrome)</strong>
                <p>1. Apri il menu del browser (3 puntini).</p>
                <p>2. Seleziona <strong>"Installa applicazione"</strong>.</p>
              </div>
            </div>
            <button
              onClick={() => setShowPwaHelp(false)}
              className="w-full min-h-[44px] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer transition-all shadow-lg shadow-amber-500/10"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/85 backdrop-blur-2xl border-t border-white/[0.05] pb-safe px-2 py-1.5 flex items-center justify-around h-[62px]">
        {desktopTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
                isActive
                  ? 'text-amber-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className="relative">
                <Icon className={`w-[18px] h-[18px] mb-0.5 transition-colors ${isActive ? 'text-amber-400' : ''}`} />
                {tab.id === 'knowledge' && knowledgeCount > 0 && (
                  <span className="absolute -top-1 -right-2.5 px-1 rounded-full text-[8px] font-bold bg-amber-400 text-slate-950 leading-3">
                    {knowledgeCount}
                  </span>
                )}
              </div>
              <span>{tab.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-amber-400 mt-0.5 shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
