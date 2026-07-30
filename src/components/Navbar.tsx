import React from 'react';
import { UserLevel, ActiveTab, VoiceSettings } from '../types';
import { Mic, BookOpen, Brain, Sparkles, Sliders, Download, History, Share2 } from 'lucide-react';
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
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 text-slate-100 pt-safe">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo & Brand */}
            <AppLogo size="md" />

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/60 backdrop-blur-sm">
              <button
                onClick={() => setActiveTab('studio')}
                className={`min-h-[36px] flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'studio'
                    ? 'bg-slate-800/90 text-amber-300 font-bold border-b-2 border-amber-400 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                <span>Studio</span>
              </button>

              <button
                onClick={() => setActiveTab('knowledge')}
                className={`min-h-[36px] flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'knowledge'
                    ? 'bg-slate-800/90 text-amber-300 font-bold border-b-2 border-amber-400 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Materiali</span>
                {knowledgeCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                    {knowledgeCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('method')}
                className={`min-h-[36px] flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'method'
                    ? 'bg-slate-800/90 text-amber-300 font-bold border-b-2 border-amber-400 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-amber-400" />
                <span>Metodo</span>
              </button>

              <button
                onClick={() => setActiveTab('review')}
                className={`min-h-[36px] flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'review'
                    ? 'bg-slate-800/90 text-amber-300 font-bold border-b-2 border-amber-400 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Ripasso</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`min-h-[36px] flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-slate-800/90 text-amber-300 font-bold border-b-2 border-amber-400 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>Sessioni</span>
              </button>
            </nav>

            {/* Level & Settings Controls */}
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              {!isStandalone && (
                <button
                  onClick={handleInstallClick}
                  className="flex items-center space-x-1 min-h-[36px] px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-xs font-semibold transition-all shrink-0 cursor-pointer"
                  title="Installa applicazione"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Installa</span>
                </button>
              )}

              {/* CEFR Level Pill */}
              <button
                onClick={() => setShowSettings(true)}
                className="hidden sm:flex min-h-[36px] px-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all items-center gap-1.5 shrink-0 text-xs font-semibold cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>{((LEVEL_PROFILES[userLevel] || LEVEL_PROFILES.B1_B2).label || (LEVEL_PROFILES[userLevel] || LEVEL_PROFILES.B1_B2).name || '').split(/[·•]/)[0].trim()}</span>
              </button>

              {/* Settings Trigger */}
              <button
                onClick={() => setShowSettings(true)}
                className="min-h-[36px] min-w-[36px] sm:w-auto sm:px-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white transition-all flex items-center justify-center gap-1.5 shrink-0 text-xs font-semibold cursor-pointer"
                title="Impostazioni"
              >
                <Sliders className="w-4 h-4 text-amber-400" />
                <span className="hidden lg:inline text-slate-300 font-medium">Impostazioni</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        voiceSettings={voiceSettings}
        userLevel={userLevel}
        onSaveSettings={onSaveAppSettings}
        isSessionActive={isSessionConnected}
      />

      {/* PWA Instructions Modal */}
      {showPwaHelp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 text-slate-100 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 font-bold text-amber-400 text-sm">
                <Download className="w-4 h-4" />
                <span>Installa Madrelingua AI</span>
              </div>
              <button
                onClick={() => setShowPwaHelp(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-200">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                <strong className="text-amber-300 block font-semibold">📱 iOS (Safari)</strong>
                <p>
                  1. Tocca il pulsante <strong>Condividi <Share2 className="w-3.5 h-3.5 inline text-amber-400" /></strong>.
                </p>
                <p>2. Seleziona <strong>"Aggiungi alla schermata Home"</strong>.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                <strong className="text-emerald-300 block font-semibold">🤖 Android (Chrome)</strong>
                <p>1. Apri il menu del browser (3 puntini).</p>
                <p>2. Seleziona <strong>"Installa applicazione"</strong>.</p>
              </div>
            </div>

            <button
              onClick={() => setShowPwaHelp(false)}
              className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-2xl border-t border-slate-800/80 pb-safe px-2 py-1 flex items-center justify-around h-16 shadow-2xl">
        <button
          onClick={() => setActiveTab('studio')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
            activeTab === 'studio'
              ? 'text-amber-300 font-bold bg-amber-500/15 border border-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mic className="w-4 h-4 mb-0.5" />
          <span>Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[11px] font-medium transition-all relative cursor-pointer ${
            activeTab === 'knowledge'
              ? 'text-amber-300 font-bold bg-amber-500/15 border border-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <BookOpen className="w-4 h-4 mb-0.5" />
            {knowledgeCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full text-[9px] font-bold bg-amber-400 text-slate-950">
                {knowledgeCount}
              </span>
            )}
          </div>
          <span>Materiali</span>
        </button>

        <button
          onClick={() => setActiveTab('method')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
            activeTab === 'method'
              ? 'text-amber-300 font-bold bg-amber-500/15 border border-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-4 h-4 mb-0.5" />
          <span>Metodo</span>
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
            activeTab === 'review'
              ? 'text-amber-300 font-bold bg-amber-500/15 border border-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 mb-0.5" />
          <span>Ripasso</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'text-amber-300 font-bold bg-amber-500/15 border border-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4 mb-0.5" />
          <span>Sessioni</span>
        </button>
      </nav>
    </>
  );
};
