import React, { useState } from "react";
import { AppSettings, LEVELS, VoiceMode } from "../types";
import { Check, Volume2, Mic, Hand, ShieldCheck } from "lucide-react";

interface SettingsScreenProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const VOICES = [
  { name: "Achird", label: "Achird", gender: "Maschile" },
  { name: "Aoede", label: "Aoede", gender: "Femminile" },
  { name: "Kore", label: "Kore", gender: "Femminile" },
  { name: "Puck", label: "Puck", gender: "Maschile" },
  { name: "Charon", label: "Charon", gender: "Maschile" },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ settings, onSave }) => {
  const [level, setLevel] = useState(settings.level);
  const [voiceName, setVoiceName] = useState(settings.voiceName);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(settings.voiceMode);
  const [noiseRobust, setNoiseRobust] = useState(settings.noiseRobust);
  const [dirty, setDirty] = useState(false);

  const update = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (val: T) => {
    setter(val);
    setDirty(true);
  };

  const handleSave = () => {
    onSave({ level, voiceName, voiceMode, noiseRobust });
    setDirty(false);
  };

  return (
    <div className="min-h-full pb-4">
      <div className="px-6 pt-10 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Impostazioni</h1>
          <p className="text-sm text-muted mt-1">Personalizza la tua esperienza.</p>
        </div>
        {dirty && (
          <button
            onClick={handleSave}
            className="h-9 px-4 rounded-xl bg-[#C2630B] hover:bg-[#A8550A] text-white font-semibold text-sm flex items-center gap-1.5 transition-colors cursor-pointer animate-scaleIn"
          >
            <Check className="w-4 h-4" />
            Salva
          </button>
        )}
      </div>

      <div className="max-w-lg mx-auto px-5 mt-4 space-y-5">
        {/* Level */}
        <section className="bg-card rounded-2xl border border-warm p-5">
          <h3 className="text-xs font-bold text-[#B5A99A] uppercase tracking-widest mb-3">Livello linguistico</h3>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => update(setLevel)(l)}
                className={`py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  level === l
                    ? "bg-[#C2630B] text-white shadow-md shadow-[#C2630B]/15"
                    : "bg-warm border border-warm text-muted hover:border-[#C2630B]/30"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-2.5 leading-snug">
            Il coach adattera la complessita e la velocita al tuo livello.
          </p>
        </section>

        {/* Voice */}
        <section className="bg-card rounded-2xl border border-warm p-5">
          <h3 className="text-xs font-bold text-[#B5A99A] uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5" />
            Voce del coach
          </h3>
          <div className="space-y-1.5">
            {VOICES.map((v) => (
              <button
                key={v.name}
                onClick={() => update(setVoiceName)(v.name)}
                className={`w-full p-3 rounded-xl text-left text-sm transition-all cursor-pointer flex items-center justify-between ${
                  voiceName === v.name
                    ? "bg-[#FFF3E6] border-2 border-[#C2630B] text-[#8B4513]"
                    : "bg-warm border border-warm text-primary hover:border-[#C2630B]/30"
                }`}
              >
                <span className="font-medium">{v.label}</span>
                <span className={`text-xs ${voiceName === v.name ? "text-[#C2630B]" : "text-muted"}`}>
                  {v.gender}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Voice mode */}
        <section className="bg-card rounded-2xl border border-warm p-5">
          <h3 className="text-xs font-bold text-[#B5A99A] uppercase tracking-widest mb-3">Modalita vocale</h3>
          <div className="space-y-2">
            <button
              onClick={() => update(setVoiceMode)("free" as VoiceMode)}
              className={`w-full p-4 rounded-xl text-left transition-all cursor-pointer flex gap-3 ${
                voiceMode === "free"
                  ? "bg-[#FFF3E6] border-2 border-[#C2630B]"
                  : "bg-warm border border-warm hover:border-[#C2630B]/30"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                voiceMode === "free" ? "bg-[#C2630B]/10" : "bg-warm"
              }`}>
                <Mic className={`w-4 h-4 ${voiceMode === "free" ? "text-[#C2630B]" : "text-muted"}`} />
              </div>
              <div>
                <div className="font-semibold text-sm text-primary">Conversazione libera</div>
                <div className="text-[11px] text-muted mt-0.5 leading-snug">
                  Il microfono e sempre attivo. Parli quando vuoi e puoi interrompere il coach.
                </div>
              </div>
            </button>

            <button
              onClick={() => update(setVoiceMode)("push_to_talk" as VoiceMode)}
              className={`w-full p-4 rounded-xl text-left transition-all cursor-pointer flex gap-3 ${
                voiceMode === "push_to_talk"
                  ? "bg-[#FFF3E6] border-2 border-[#C2630B]"
                  : "bg-warm border border-warm hover:border-[#C2630B]/30"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                voiceMode === "push_to_talk" ? "bg-[#C2630B]/10" : "bg-warm"
              }`}>
                <Hand className={`w-4 h-4 ${voiceMode === "push_to_talk" ? "text-[#C2630B]" : "text-muted"}`} />
              </div>
              <div>
                <div className="font-semibold text-sm text-primary">Premi per parlare</div>
                <div className="text-[11px] text-muted mt-0.5 leading-snug">
                  Premi il pulsante per registrare, premi di nuovo per inviare. Ideale in ambienti rumorosi.
                </div>
              </div>
            </button>
          </div>
        </section>

        {/* Noise robustness */}
        <section className="bg-card rounded-2xl border border-warm p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-700/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-sky-700" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-primary">Ambiente rumoroso</h3>
                <p className="text-[11px] text-muted mt-0.5 leading-snug">
                  Filtra i rumori di fondo per funzionare al meglio anche in vivavoce o in ambienti rumorosi.
                </p>
              </div>
            </div>
            <button
              onClick={() => update(setNoiseRobust)(!noiseRobust)}
              className={`w-12 h-7 rounded-full transition-colors cursor-pointer shrink-0 mt-0.5 ${
                noiseRobust ? "bg-[#C2630B]" : "bg-[#C8BDB2]"
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-1 ${
                noiseRobust ? "translate-x-5" : "translate-x-0"
              }`} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
