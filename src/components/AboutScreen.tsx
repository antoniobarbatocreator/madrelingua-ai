import React from "react";
import { Logo } from "./Logo";
import {
  MessageCircle,
  BookOpen,
  Languages,
  Target,
  ArrowLeftRight,
  Shield,
  Mic,
  Sparkles,
} from "lucide-react";

export const AboutScreen: React.FC = () => {
  return (
    <div className="min-h-full pb-8">
      <div className="px-6 pt-12 pb-6 text-center">
        <Logo size={72} className="mx-auto" />
        <h1 className="text-2xl font-bold text-primary tracking-tight mt-4">Madrelingua</h1>
        <p className="text-sm text-muted mt-1">English Coach</p>
      </div>

      <div className="max-w-lg mx-auto px-5 space-y-5">
        <section className="bg-card rounded-2xl border border-warm p-5">
          <h2 className="font-bold text-primary text-base mb-2">Cos'e Madrelingua?</h2>
          <p className="text-sm text-muted leading-relaxed">
            Madrelingua e il tuo coach personale per imparare l'inglese attraverso la conversazione naturale.
            Pensato per chi vuole migliorare parlando, ascoltando e praticando in modo attivo — come faresti
            con un insegnante madrelingua seduto di fronte a te.
          </p>
        </section>

        <section className="bg-card rounded-2xl border border-warm p-5">
          <h2 className="font-bold text-primary text-base mb-3">Il nostro approccio</h2>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-700/10 flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <div className="font-semibold text-primary text-sm">Conversazione reale</div>
                <div className="text-xs text-muted mt-0.5 leading-snug">
                  Parli in inglese con un coach che ti ascolta, ti corregge e ti guida. Niente esercizi noiosi.
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-700/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <div className="font-semibold text-primary text-sm">Adattivo al tuo livello</div>
                <div className="text-xs text-muted mt-0.5 leading-snug">
                  Dal principiante (A1) all'avanzato (C2), il coach si adatta alla tua competenza e ai tuoi progressi.
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-700/10 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-sky-700" />
              </div>
              <div>
                <div className="font-semibold text-primary text-sm">A prova di rumore</div>
                <div className="text-xs text-muted mt-0.5 leading-snug">
                  Funziona con cuffie, auricolari o in vivavoce. Filtri avanzati per ambienti rumorosi.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-warm p-5">
          <h2 className="font-bold text-primary text-base mb-3">Le attivita</h2>
          <div className="space-y-2.5">
            {[
              { Icon: MessageCircle, color: "text-amber-700", label: "Conversazione", desc: "Chiacchiera liberamente per migliorare la fluidita" },
              { Icon: BookOpen, color: "text-sky-700", label: "Lezione", desc: "Lezioni strutturate su grammatica ed espressioni" },
              { Icon: Languages, color: "text-emerald-700", label: "Vocabolario", desc: "Impara parole nuove con il metodo frase-traduzione" },
              { Icon: Target, color: "text-violet-700", label: "Quiz", desc: "Giochi interattivi usati da insegnanti madrelingua" },
              { Icon: ArrowLeftRight, color: "text-rose-700", label: "Traduci", desc: "Traduci frasi e scopri sfumature di significato" },
            ].map(({ Icon, color, label, desc }) => (
              <div key={label} className="flex items-center gap-3 py-1">
                <Icon className={`w-4 h-4 ${color} shrink-0`} />
                <div>
                  <span className="font-semibold text-primary text-sm">{label}</span>
                  <span className="text-xs text-muted ml-1.5">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="text-center py-4">
          <p className="text-[11px] text-muted">Madrelingua v2.0</p>
        </div>
      </div>
    </div>
  );
};
