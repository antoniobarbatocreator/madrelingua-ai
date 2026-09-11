import React, { useState, useRef, useCallback } from "react";
import {
  KnowledgeSource,
  KnowledgeItem,
  loadSources,
  loadItems,
  addSource,
  deleteSource,
  getStats,
  selectForReview,
  markPresented,
  exportAll,
  importAll,
} from "../lib/knowledge";
import { parseVocabularyList, isStructuredList } from "../lib/listParser";
import {
  FileText,
  ClipboardPaste,
  Upload,
  Trash2,
  Play,
  Loader2,
  ChevronDown,
  Download,
  FolderUp,
  BookOpen,
} from "lucide-react";

export type ReviewMode = "drill" | "conversation";

interface KnowledgeScreenProps {
  onStartReview: (items: KnowledgeItem[], mode: ReviewMode, sourceName?: string) => void;
}

const BATCH_SIZE = 12;

export const KnowledgeScreen: React.FC<KnowledgeScreenProps> = ({ onStartReview }) => {
  const [sources, setSources] = useState<KnowledgeSource[]>(() => loadSources());
  const [stats, setStats] = useState(() => getStats());
  const [mode, setMode] = useState<ReviewMode>("drill");

  const [tab, setTab] = useState<"text" | "file">("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setSources(loadSources());
    setStats(getStats());
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 6000);
  };

  const fail = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 8000);
  };

  const store = (name: string, kind: "text" | "pdf", excerpt: string, items: any[]) => {
    if (!items.length) {
      fail("Non ho trovato vocaboli in questo contenuto. Controlla che contenga parole o espressioni in inglese.");
      return;
    }
    const res = addSource(name, kind, excerpt, items);
    refresh();
    flash(
      res.skipped > 0
        ? `Aggiunte ${res.added} nuove voci. ${res.skipped} erano gia in libreria e sono state saltate.`
        : `Aggiunte ${res.added} voci alla tua libreria.`
    );
  };

  const handleAddText = async () => {
    if (text.trim().length < 10) {
      fail("Scrivi o incolla almeno qualche riga di appunti.");
      return;
    }

    // A list that is already "word = translation" needs no model at all.
    // Reading it locally is instant and spends none of the daily allowance.
    const parsed = parseVocabularyList(text);
    if (isStructuredList(parsed)) {
      const res = addSource(title || "Lista personale", "text", text, parsed.items);
      refresh();
      setText("");
      setTitle("");
      flash(
        `Lista letta direttamente, senza usare l'analisi: ${res.added} voci aggiunte` +
          (res.skipped > 0 ? `, ${res.skipped} gia presenti saltate` : "") +
          (parsed.unparsed > 0 ? `, ${parsed.unparsed} righe ignorate (titoli o note).` : ".")
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Estrazione fallita.");
      store(title || "Appunti incollati", "text", data.excerpt || text, data.items || []);
      setText("");
      setTitle("");
    } catch (e: any) {
      fail(e.message || "Qualcosa e andato storto durante l'analisi.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/knowledge/extract-pdf", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lettura del file fallita.");
      store(title || file.name, "pdf", data.excerpt || "", data.items || []);
      setTitle("");
    } catch (e: any) {
      fail(e.message || "Non sono riuscito a leggere il file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const start = (sourceId?: string, sourceName?: string) => {
    const batch = selectForReview(BATCH_SIZE, sourceId);
    if (!batch.length) {
      fail("Non ci sono ancora vocaboli da ripassare qui.");
      return;
    }
    markPresented(batch);
    refresh();
    onStartReview(batch, mode, sourceName);
  };

  const handleExport = () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `madrelingua-libreria-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const res = importAll(await file.text());
      refresh();
      flash(`Backup ripristinato: ${res.items} vocaboli in ${res.sources} fonti.`);
    } catch (e: any) {
      fail(e.message || "Il file di backup non e leggibile.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const itemsOf = (sourceId: string): KnowledgeItem[] =>
    loadItems().filter((i) => i.sourceId === sourceId);

  return (
    <div className="min-h-full pb-4">
      <div className="px-6 pt-10 pb-2">
        <h1 className="text-2xl font-bold text-primary tracking-tight">La tua libreria</h1>
        <p className="text-sm text-muted mt-1">
          I vocaboli che raccogli tu, dal tuo corso e dai tuoi appunti.
        </p>
      </div>

      <div className="px-5 space-y-4 mt-3">
        {notice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-fadeIn">
            {notice}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-fadeIn">
            {error}
          </div>
        )}

        {/* Library state and the main action */}
        {stats.total > 0 && (
          <section className="bg-card rounded-2xl border border-warm p-5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-bold text-primary tabular-nums">{stats.total}</div>
                <div className="text-[10px] text-muted font-medium mt-0.5">vocaboli</div>
              </div>
              <div>
                <div className="text-xl font-bold text-[#C2630B] tabular-nums">{stats.dueNow}</div>
                <div className="text-[10px] text-muted font-medium mt-0.5">da ripassare</div>
              </div>
              <div>
                <div className="text-xl font-bold text-emerald-700 tabular-nums">{stats.neverSeen}</div>
                <div className="text-[10px] text-muted font-medium mt-0.5">mai visti</div>
              </div>
            </div>

            <div className="flex gap-1.5 mt-5 p-1 bg-warm rounded-xl">
              <button
                onClick={() => setMode("drill")}
                className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === "drill" ? "bg-card text-primary shadow-sm" : "text-muted"
                }`}
              >
                Ripasso guidato
              </button>
              <button
                onClick={() => setMode("conversation")}
                className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === "conversation" ? "bg-card text-primary shadow-sm" : "text-muted"
                }`}
              >
                Conversazione
              </button>
            </div>
            <p className="text-[11px] text-muted mt-2 leading-snug">
              {mode === "drill"
                ? "Il coach ti interroga uno per uno sui vocaboli selezionati."
                : "Il coach conversa con te portando naturalmente il discorso sui tuoi vocaboli."}
            </p>

            <button
              onClick={() => start()}
              className="w-full h-12 mt-4 rounded-xl bg-[#C2630B] hover:bg-[#A8550A] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.99]"
            >
              <Play className="w-4 h-4 fill-current" />
              Inizia con {Math.min(BATCH_SIZE, stats.total)} vocaboli
            </button>
            <p className="text-[11px] text-muted mt-2 leading-snug text-center">
              Scelti dall&apos;app in base a cosa hai gia praticato, cosi ogni sessione e diversa.
            </p>
          </section>
        )}

        {/* Add a new source */}
        <section className="bg-card rounded-2xl border border-warm p-5">
          <h3 className="font-semibold text-sm text-primary">Aggiungi materiale</h3>

          <div className="flex gap-1.5 mt-3 p-1 bg-warm rounded-xl">
            <button
              onClick={() => setTab("text")}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                tab === "text" ? "bg-card text-primary shadow-sm" : "text-muted"
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Incolla testo
            </button>
            <button
              onClick={() => setTab("file")}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                tab === "file" ? "bg-card text-primary shadow-sm" : "text-muted"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Carica PDF
            </button>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome (es. Lezione 12 - phrasal verbs)"
            className="w-full mt-3 bg-warm border border-warm focus:border-[#C2630B] focus:bg-card rounded-xl px-3 py-2.5 text-sm text-primary placeholder-[#C8BDB2] outline-none transition-all"
          />

          {tab === "text" ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                placeholder={
                  "Una voce per riga, cosi:\n\nget along with = andare d'accordo\nto put up with -> sopportare\nlook forward to = non vedere l'ora di\n\nIn questo formato viene letta all'istante, senza consumare l'analisi. Vanno bene anche appunti in prosa: li legge l'intelligenza artificiale."
                }
                className="w-full mt-2 bg-warm border border-warm focus:border-[#C2630B] focus:bg-card rounded-xl px-3 py-2.5 text-sm text-primary placeholder-[#C8BDB2] resize-none outline-none transition-all leading-relaxed"
              />
              <button
                onClick={handleAddText}
                disabled={busy || text.trim().length < 10}
                className="w-full h-11 mt-2 rounded-xl bg-[#C2630B] hover:bg-[#A8550A] disabled:bg-[#C8BDB2] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizzo gli appunti...
                  </>
                ) : (
                  "Analizza e salva"
                )}
              </button>
            </>
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="w-full h-24 mt-2 rounded-xl border-2 border-dashed border-warm hover:border-[#C2630B] flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-5 h-5 text-[#C2630B] animate-spin" />
                    <span className="text-xs text-muted font-medium">Leggo e analizzo il file...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-[#C8BDB2]" />
                    <span className="text-xs text-muted font-medium">Scegli un PDF o un file di testo</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-muted mt-2 leading-snug">
                Il PDF deve avere testo selezionabile. Da una scansione o una foto non si puo estrarre nulla.
              </p>
            </>
          )}

          <p className="text-[11px] text-[#C8BDB2] mt-3 leading-snug border-t border-warm pt-3">
            Una lista gia in formato &quot;parola = traduzione&quot; viene letta sul telefono, gratis
            e senza limiti, anche con centinaia di voci. Solo gli appunti in prosa e i PDF passano
            per l&apos;analisi automatica, che sul piano gratuito di Google consente circa 20
            elaborazioni al giorno.
          </p>
        </section>

        {/* Sources */}
        {sources.length === 0 ? (
          <section className="bg-card rounded-2xl border border-warm p-8 text-center">
            <BookOpen className="w-8 h-8 text-[#C8BDB2] mx-auto" />
            <h3 className="font-semibold text-sm text-primary mt-3">La libreria e vuota</h3>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed max-w-[260px] mx-auto">
              Aggiungi gli appunti del tuo corso e il coach potra interrogarti proprio su quelli,
              invece che su vocaboli generici.
            </p>
          </section>
        ) : (
          <section className="space-y-2">
            <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider px-1">
              Le tue fonti
            </h3>
            {sources.map((s) => (
              <div key={s.id} className="bg-card rounded-2xl border border-warm overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#FFF3E6] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-[#C2630B]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-primary truncate">{s.name}</div>
                    <div className="text-[11px] text-muted mt-0.5">
                      {s.itemCount} vocaboli · {new Date(s.createdAt).toLocaleDateString("it-IT")}
                    </div>
                  </div>
                  <button
                    onClick={() => start(s.id, s.name)}
                    title="Ripassa solo questa fonte"
                    className="w-9 h-9 rounded-lg hover:bg-[#FFF3E6] flex items-center justify-center cursor-pointer transition-colors shrink-0"
                  >
                    <Play className="w-4 h-4 text-[#C2630B]" />
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    className="w-9 h-9 rounded-lg hover:bg-warm flex items-center justify-center cursor-pointer transition-colors shrink-0"
                  >
                    <ChevronDown
                      className={`w-4 h-4 text-muted transition-transform ${
                        expanded === s.id ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {expanded === s.id && (
                  <div className="border-t border-warm bg-warm/40 px-4 py-3 animate-fadeIn">
                    <div className="max-h-64 overflow-y-auto space-y-1.5">
                      {itemsOf(s.id).map((it) => (
                        <div key={it.id} className="text-xs leading-snug">
                          <span className="font-semibold text-primary">{it.phrase}</span>
                          <span className="text-muted"> — {it.translation}</span>
                          {it.seenCount > 0 && (
                            <span className="text-[10px] text-[#C8BDB2]"> · visto {it.seenCount}x</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Eliminare "${s.name}" e i suoi ${s.itemCount} vocaboli?`)) {
                          deleteSource(s.id);
                          refresh();
                        }
                      }}
                      className="mt-3 h-8 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Elimina questa fonte
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Backup */}
        <section className="bg-card rounded-2xl border border-warm p-5">
          <h3 className="font-semibold text-sm text-primary">Copia di sicurezza</h3>
          <p className="text-[11px] text-muted mt-1 leading-snug">
            La libreria vive su questo telefono e non viene inviata da nessuna parte. Se cancelli i
            dati del sito o cambi dispositivo, la perdi: esporta ogni tanto un file di backup.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleExport}
              disabled={stats.total === 0}
              className="flex-1 h-10 rounded-xl bg-warm hover:bg-[#FFF3E6] disabled:opacity-40 text-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Esporta
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
              className="hidden"
            />
            <button
              onClick={() => importRef.current?.click()}
              className="flex-1 h-10 rounded-xl bg-warm hover:bg-[#FFF3E6] text-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderUp className="w-3.5 h-3.5" />
              Ripristina
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
