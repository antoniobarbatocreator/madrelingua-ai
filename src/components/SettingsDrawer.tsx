import React, { useState, useEffect } from 'react';
import { VoiceSettings, UserLevel, TurnMode, CorrectionMode } from '../types';
import {
  X,
  User,
  Sliders,
  Volume2,
  Mic,
  Smartphone,
  Save,
  Check,
  Play,
  GraduationCap,
  Info,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { playPcmAudio } from '../lib/speech';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  voiceSettings: VoiceSettings;
  userLevel: UserLevel;
  onSaveSettings: (newSettings: VoiceSettings, newLevel: UserLevel) => boolean;
  isSessionActive?: boolean;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  voiceSettings,
  userLevel,
  onSaveSettings,
  isSessionActive = false,
}) => {
  const [draftVoiceSettings, setDraftVoiceSettings] = useState<VoiceSettings>(() => ({
    ...voiceSettings,
  }));
  const [draftUserLevel, setDraftUserLevel] = useState<UserLevel>(userLevel);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Synchronize draft state when drawer opens or parent props change
  useEffect(() => {
    if (!isOpen) return;

    setDraftVoiceSettings({ ...voiceSettings });
    setDraftUserLevel(userLevel);
    setSavedSuccess(false);
    setSaveError(null);
    setIsSaving(false);
  }, [isOpen, voiceSettings, userLevel]);

  if (!isOpen) return null;

  const handleVoicePreview = async () => {
    setIsPlayingPreview(true);
    try {
      const sampleText =
        draftVoiceSettings.voiceName === 'Puck' || draftVoiceSettings.voiceName === 'Kore'
          ? "Hello! I'm your English coach. Great to meet you!"
          : "Hi there! I'm looking forward to practicing English together.";

      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceName: draftVoiceSettings.voiceName,
          text: sampleText,
        }),
      });

      const data = await res.json();
      if (data.audioBase64) {
        playPcmAudio(data.audioBase64, 24000);
      }
    } catch (err) {
      console.error('Voice preview failed:', err);
    } finally {
      setIsPlayingPreview(false);
    }
  };

  const handleCancelAndClose = () => {
    setDraftVoiceSettings({ ...voiceSettings });
    setDraftUserLevel(userLevel);
    setSavedSuccess(false);
    setSaveError(null);
    setIsSaving(false);
    onClose();
  };

  const handleSave = () => {
    setIsSaving(true);
    setSaveError(null);

    const success = onSaveSettings(draftVoiceSettings, draftUserLevel);

    setIsSaving(false);

    if (!success) {
      setSaveError('Impossibile salvare le impostazioni nel dispositivo.');
      return;
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-end animate-fadeIn">
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={handleCancelAndClose} aria-hidden="true" />

      {/* Drawer Container */}
      <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl z-10 text-slate-100 overflow-hidden animate-slideLeft">
        {/* Top Handle bar for mobile */}
        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-2 sm:hidden shrink-0" />

        {/* Drawer Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-base text-white">Impostazioni App</h2>
          </div>
          <button
            onClick={handleCancelAndClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Chiudi impostazioni"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active session warning banner */}
        {isSessionActive && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 text-xs text-amber-300 flex items-center gap-2 shrink-0">
            <Info className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Le modifiche saranno applicate alla prossima sessione.</span>
          </div>
        )}

        {/* Save error banner */}
        {saveError && (
          <div className="bg-red-500/15 border-b border-red-500/30 px-5 py-2.5 text-xs text-red-300 flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* Section 1: Coach & Voice */}
          <div className="space-y-3">
            <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Coach & Voce</span>
            </div>

            <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Voce del Coach
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Achird', label: 'Achird', gender: 'Uomo · Neutro' },
                    { id: 'Sulafat', label: 'Sulafat', gender: 'Donna · Espressiva' },
                    { id: 'Despina', label: 'Despina', gender: 'Donna · Naturale' },
                    { id: 'Aoede', label: 'Aoede', gender: 'Donna · Calda' },
                    { id: 'Puck', label: 'Puck', gender: 'Uomo · Dinamico' },
                    { id: 'Charon', label: 'Charon', gender: 'Uomo · Calmo' },
                    { id: 'Kore', label: 'Kore', gender: 'Donna · Rilassante' },
                    { id: 'Fenrir', label: 'Fenrir', gender: 'Uomo · Profondo' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() =>
                        setDraftVoiceSettings({ ...draftVoiceSettings, voiceName: v.id })
                      }
                      className={`min-h-[44px] p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        draftVoiceSettings.voiceName === v.id
                          ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold">{v.label}</div>
                      <div className="text-[10px] text-slate-500">{v.gender}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Button */}
              <button
                type="button"
                onClick={handleVoicePreview}
                disabled={isPlayingPreview}
                className="w-full min-h-[40px] py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isPlayingPreview ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <Play className="w-4 h-4 text-amber-400" />
                )}
                <span>Ascolta anteprima voce ({draftVoiceSettings.voiceName})</span>
              </button>
            </div>
          </div>

          {/* Section 2: Livello CEFR */}
          <div className="space-y-3">
            <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Livello di Inglese (CEFR)</span>
            </div>

            <div className="grid grid-cols-1 gap-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              {[
                {
                  id: 'A1_A2',
                  title: 'A1-A2 • Base / Elementare',
                  desc: 'Vocabolario semplice, ritmo disteso, spiegazioni in italiano chiare.',
                },
                {
                  id: 'B1_B2',
                  title: 'B1-B2 • Intermedio',
                  desc: 'Conversazione naturale, correzione delle sfumature e dei phrasal verbs.',
                },
                {
                  id: 'C1_C2',
                  title: 'C1-C2 • Avanzato',
                  desc: 'Rifinitura della fluidità, registro formale, espressioni idiomatiche complesse.',
                },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setDraftUserLevel(lvl.id as UserLevel)}
                  className={`min-h-[44px] p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    draftUserLevel === lvl.id
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-xs">{lvl.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{lvl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Modalità di Conversazione */}
          <div className="space-y-3">
            <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" />
              <span>Conversazione & Turni</span>
            </div>

            <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Modalità di gestione turni
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    {
                      id: 'automatic',
                      title: 'Automatica (Consigliata)',
                      desc: 'Conversazione fluida con interruzione naturale mentre il coach parla.',
                    },
                    {
                      id: 'noise_resistant',
                      title: 'Ambiente Rumoroso / In Movimento 🚗',
                      desc: 'Filtra meglio i rumori brevi, ma consente comunque di interrompere intenzionalmente il coach.',
                    },
                    {
                      id: 'tap_to_talk',
                      title: 'Tocca per parlare (Manuale)',
                      desc: 'Premi il pulsante per parlare e ricliccalo per inviare il tuo turno.',
                    },
                  ].map((mode) => {
                    const isSelected = draftVoiceSettings.turnMode === mode.id;

                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() =>
                          setDraftVoiceSettings({
                            ...draftVoiceSettings,
                            turnMode: mode.id as TurnMode,
                          })
                        }
                        className={`min-h-[48px] p-3 rounded-xl text-left border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>{mode.title}</span>
                          {mode.id === 'automatic' && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                              Consigliata
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{mode.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pause Sensitivity / Tolerance */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Tolleranza Pause di Riflessione
                </label>
                <select
                  value={draftVoiceSettings.pauseToleranceSeconds}
                  onChange={(e) =>
                    setDraftVoiceSettings({
                      ...draftVoiceSettings,
                      pauseToleranceSeconds: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-900 text-slate-200 text-xs p-2.5 rounded-xl border border-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value={8}>Paziente (8 sec)</option>
                  <option value={5}>Standard (5 sec - Consigliata)</option>
                  <option value={3}>Veloce (3 sec)</option>
                </select>
              </div>

              {/* Correction Style */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Modalità Correzioni
                </label>
                <select
                  value={draftVoiceSettings.correctionMode}
                  onChange={(e) =>
                    setDraftVoiceSettings({
                      ...draftVoiceSettings,
                      correctionMode: e.target.value as CorrectionMode,
                    })
                  }
                  className="w-full bg-slate-900 text-slate-200 text-xs p-2.5 rounded-xl border border-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="immediate">Immediate durante il turno</option>
                  <option value="end_of_turn">Alla fine di ogni frase</option>
                  <option value="summary_only">Solo riepilogo finale</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Audio Options */}
          <div className="space-y-3">
            <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Audio</span>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
              <div>
                <div className="flex justify-between font-semibold text-slate-300 mb-1">
                  <span>Velocità Parlato Coach</span>
                  <span className="text-amber-400 font-bold">{draftVoiceSettings.speed}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.25"
                  step="0.05"
                  value={draftVoiceSettings.speed}
                  onChange={(e) =>
                    setDraftVoiceSettings({
                      ...draftVoiceSettings,
                      speed: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Schermo & PWA */}
          <div className="space-y-3">
            <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Applicazione</span>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-slate-200">Mantieni schermo attivo</div>
                  <div className="text-[10px] text-slate-400">Impedisce lo spegnimento durante la chiamata</div>
                </div>
                <input
                  type="checkbox"
                  checked={draftVoiceSettings.keepScreenAwake}
                  onChange={(e) =>
                    setDraftVoiceSettings({
                      ...draftVoiceSettings,
                      keepScreenAwake: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Drawer Sticky Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCancelAndClose}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Salvataggio…</span>
              </>
            ) : savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-slate-950" />
                <span>Salvato</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salva modifiche</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
