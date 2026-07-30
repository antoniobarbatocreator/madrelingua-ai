import React, { useState } from 'react';
import {
  HeartHandshake,
  Hourglass,
  Blocks,
  Languages,
  Check,
  ChevronDown,
} from 'lucide-react';

export const NeuroMethodGuide: React.FC = () => {
  const [activeChapter, setActiveChapter] = useState<number>(1);
  const [openAccordions, setOpenAccordions] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
  });

  const toggleAccordion = (id: number) => {
    setOpenAccordions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const principles = [
    {
      id: 1,
      title: 'Parlare senza ansia',
      icon: <HeartHandshake className="w-4 h-4 text-amber-400" />,
      intro: 'Filtro affettivo basso e conversazione naturale',
      text: "Quando il cervello avverte stress o paura di giudizio, attiva l'amigdala e blocca il recupero dei vocaboli. Il coach parla con un tono caldo e rilassante: ogni errore è una normale tappa del percorso di apprendimento per consolidare i circuiti del linguaggio.",
    },
    {
      id: 2,
      title: 'Capire le correzioni',
      icon: <Languages className="w-4 h-4 text-emerald-400" />,
      intro: 'Spiegazione chiara delle imprecisioni',
      text: 'Quando fai una svista (es. "I am agree"), spiegarla soltanto in inglese aumenta il carico cognitivo. Il coach mantiene la conversazione in inglese per l\'immersione, ma fornisce una spiegazione breve e immediata in italiano con la forma naturale da ripetere.',
    },
    {
      id: 3,
      title: 'Prendersi il tempo per pensare',
      icon: <Hourglass className="w-4 h-4 text-indigo-400" />,
      intro: 'Tolleranza completa delle pause',
      text: 'I classici assistenti vocali ti interrompono dopo un secondo di silenzio. Durante la conversazione puoi attivare la tolleranza per le pause di riflessione o la modalità "Tocca per parlare": il tempo per pensare serve al cervello per strutturare la frase corretta.',
    },
    {
      id: 4,
      title: 'Imparare per espressioni',
      icon: <Blocks className="w-4 h-4 text-cyan-400" />,
      intro: 'Apprendimento a blocchi (Chunks)',
      text: 'Invece di tradurre parola per parola dall\'italiano (creando frasi poco naturali), memorizzi blocchi di parole pronti all\'uso presi dalle lezioni o dai tuoi PDF personali.',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 text-slate-100 space-y-8">
      {/* Editorial Header */}
      <div className="space-y-2 border-b border-slate-800 pb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
          Il metodo
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Imparare a parlare, senza bloccarsi
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
          Un approccio pensato per conversare con più sicurezza, ricevere correzioni utili e consolidare l'inglese nel contesto.
        </p>
      </div>

      {/* Main Content Layout: Desktop Sticky Sidebar + Main Editorial Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Desktop Sticky Index Sidebar */}
        <aside className="hidden md:block md:col-span-4 sticky top-20 space-y-1 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
            Indice dei principi
          </div>
          {principles.map((p) => (
            <a
              key={p.id}
              href={`#principle-${p.id}`}
              onClick={() => setActiveChapter(p.id)}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-all cursor-pointer ${
                activeChapter === p.id
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className="w-5 h-5 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                {p.id}
              </span>
              <span className="truncate">{p.title}</span>
            </a>
          ))}
        </aside>

        {/* Content Principles List */}
        <div className="md:col-span-8 space-y-4">
          {principles.map((p) => (
            <div
              key={p.id}
              id={`principle-${p.id}`}
              className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 space-y-3 scroll-mt-24 transition-all"
            >
              {/* Header / Accordion trigger on mobile */}
              <div
                onClick={() => toggleAccordion(p.id)}
                className="flex items-center justify-between cursor-pointer md:cursor-default"
              >
                <div className="flex items-center space-x-3">
                  <span className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                    {p.id}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-white">{p.title}</h3>
                    <p className="text-[11px] text-amber-400/90 font-medium">{p.intro}</p>
                  </div>
                </div>

                <button className="md:hidden p-1 text-slate-400">
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      openAccordions[p.id] ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Text explanation */}
              {(openAccordions[p.id] || window.innerWidth >= 768) && (
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-2 border-t border-slate-800/60">
                  {p.text}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Non-Pushy Comparison Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="font-bold text-sm text-white">
            Confronto con assistenti generici
          </h3>
          <p className="text-xs text-slate-400">
            Come il coach madrelingua adatta la conversazione all'apprendimento.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Assistente generico */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
              Assistente generico
            </div>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-slate-500">•</span>
                <span>Interrompe dopo un breve momento di silenzio.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500">•</span>
                <span>Usa un ritmo standard non calibrato.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500">•</span>
                <span>Non risponde con spiegazioni in italiano.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500">•</span>
                <span>Non integra i tuoi appunti o materiali.</span>
              </li>
            </ul>
          </div>

          {/* Madrelingua Coach */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2 text-xs">
            <div className="font-bold text-amber-400 uppercase tracking-wider text-[10px]">
              Madrelingua Coach
            </div>
            <ul className="space-y-2 text-slate-200">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>Gestione flessibile delle pause di riflessione.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>Velocità della voce regolabile per il tuo livello.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>Correzioni spiegate chiaramente in italiano.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>Sincronizzazione immediata con i tuoi PDF.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
