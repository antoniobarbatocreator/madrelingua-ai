# Verifica ricostruzione v1.3

Data: 29 luglio 2026

## Base

Progetto di partenza: `madrelingua-ai---coach-inglese (11).zip`.

## Interventi principali

- ripristinato un orchestratore reale al posto del placeholder;
- ripristinati tutti gli 11 Topic Pack;
- aggiunto il resolver strutturale di attività, topic e moduli;
- aggiunto il controller deterministico della lezione di nuovi vocaboli;
- resi assoluti i filtri dei Materiali, anche quando un modulo è esaurito;
- corretta la lettura dei Materiali che non possiedono `fileName` ma solo `title`;
- aggiunto il limite CEFR reale nella selezione dei target;
- privilegiati target lessicali brevi rispetto a frasi complete e pattern grammaticali;
- vietati esercizi di imitazione e complimenti automatici sulla pronuncia nella modalità nuovi vocaboli;
- aggiunta la frase italiana obbligatoria, valutazione, retry con stessa parola e acquisizione autonoma;
- gestiti `No`, `Non lo so` e `Dimmi tu` senza cambiare target;
- supportato il cambio topic durante una lezione attiva;
- separati prompt interni e messaggi visibili;
- impedito l'invio positivo dei Materiali al percorso REST di nuovi vocaboli;
- reso persistente il pulsante `Termina sessione` durante la sessione;
- implementato reset completo senza salvataggio automatico;
- mantenuto il salvataggio esclusivamente manuale.

## Verifiche eseguite realmente

### Controllo sintattico

Tutti i file TypeScript e TSX del progetto, compreso `server.ts`, sono stati elaborati con `typescript.transpileModule`:

- file controllati: 70;
- errori sintattici: 0.

### Verificatore deterministico del nucleo

Comando logico equivalente a `npm run verify:core`, eseguito compilando localmente i moduli puri in CommonJS:

- controlli eseguiti: 21;
- controlli superati: 21;
- controlli falliti: 0.

I controlli coprono:

- 11 Topic Pack, etichette e alias;
- richiesta generica, topic esplicito e richieste ordinarie;
- scelta topic/modulo e argomenti personalizzati;
- apostrofi e normalizzazione;
- esclusioni assolute dei Materiali;
- Materiali predefiniti su tutti i moduli registrati;
- coda futura non esclusa prematuramente;
- menu iniziale non duplicato;
- creazione del target e della frase italiana assegnata;
- `Dimmi tu` con stesso target e nuova frase;
- acquisizione autonoma e avanzamento;
- rifiuto di frasi semanticamente estranee;
- controllo di conformità del docente;
- separazione REST dei Materiali;
- cambio topic durante una lezione;
- compatibilità CEFR A1_A2;
- fallback contestuale senza esercizi di ripetizione;
- visibilità e comportamento di `Termina sessione`;
- salvataggio esclusivamente manuale.

## Verifiche non eseguite

La build Vite completa e la suite Vitest non sono state eseguite in questo ambiente perché `npm ci` non può completarsi: il registry interno restituisce `404` per `yallist@3.1.1`.

Non sono stati eseguiti qui:

- microfono reale;
- permessi browser;
- WebSocket Gemini Live;
- voce Achird;
- credenziali Gemini;
- preview Google AI Studio.

Questi elementi richiedono la preview o un ambiente locale con dipendenze installabili e chiave API valida.

## Prova manuale consigliata

1. Avvia una sessione nuova: il coach deve presentare le quattro attività in italiano.
2. Dì “Mi piacerebbe imparare nuove parole”: deve mostrare gli 11 macroargomenti.
3. Scegli “vita quotidiana”, poi “scegli tu”.
4. Il coach deve presentare un solo target e terminare con una frase italiana da tradurre.
5. Non deve chiedere di ripetere né lodare la pronuncia.
6. Dì “Dimmi tu”: deve mantenere il target, mostrare la soluzione e assegnare una frase diversa.
7. Traduci correttamente la nuova frase: deve avanzare a un altro target filtrato.
8. Chiedi vocaboli per il viaggio: deve cambiare Topic Pack senza valutare la richiesta come traduzione.
9. Premi `Termina sessione`: chat e trascrizioni devono sparire, senza creare una voce nello storico.
10. Avvia un'altra sessione: deve essere pulita. Salva solo premendo `Salva`.
