# Madrelingua AI Coach v1.3 — Specifica autorevole

Questo documento è una specifica di sviluppo. Non è un Materiale didattico dell'utente e non deve essere inserito nella Knowledge Base del coach.

## Flusso autorevole

Ogni turno completo, vocale o testuale, segue questo percorso:

1. input e trascrizione;
2. orchestratore applicativo;
3. controller dell'attività attiva;
4. selezione e validazione del contenuto;
5. azione didattica deterministica;
6. Gemini formula verbalmente l'azione;
7. controllo di conformità;
8. risposta visibile e audio.

Gemini non decide autonomamente attività, Topic Pack, target, tipo di esercizio o avanzamento della lezione.

## Impara nuove parole

### Selezione del contenuto

- Una richiesta generica mostra gli 11 macroargomenti registrati.
- Una richiesta che contiene già un tema può risolverlo direttamente.
- Sono supportati argomenti personalizzati controllati.
- Il livello CEFR è un limite reale: A1_A2 non riceve target B1 o superiori.
- Sono prioritari parole, verbi, phrasal verbs, collocazioni, chunk ed espressioni brevi.
- Le frasi complete sono target solo quando costituiscono una formula comunicativa indivisibile.

### Separazione dai Materiali

In `learn_new_vocabulary` i Materiali sono esclusioni assolute:

- PDF, note, vocaboli personali e sessioni precedenti non sono fonti positive;
- il set di esclusione viene ricostruito prima del primo target e di ogni target successivo;
- il selettore non rilassa mai l'esclusione quando un modulo è esaurito;
- se non esiste un target valido, l'app chiede un altro modulo o usa la generazione controllata.

In `knowledge_review`, al contrario, i Materiali sono la fonte positiva del ripasso.

### Ciclo didattico obbligatorio

1. l'app seleziona un solo `currentItem`;
2. il coach ne spiega significato e uso in italiano;
3. mostra un solo esempio inglese;
4. assegna una frase italiana precisa da tradurre;
5. attende la traduzione libera dell'utente;
6. valuta l'intera frase, non la semplice presenza del target;
7. in caso di errore corregge e assegna una frase italiana diversa con lo stesso target;
8. `No`, `Non lo so` e `Dimmi tu` non cambiano target;
9. una risposta rivelata non vale come acquisizione autonoma;
10. si avanza solo dopo una traduzione nuova e corretta.

Sono vietati, salvo richiesta esplicita di pronuncia:

- “Ripeti dopo di me”;
- “Vuoi ripetere questa espressione?”;
- complimenti automatici sulla pronuncia;
- domande personali al posto della frase italiana da tradurre.

## Sessioni e salvataggio

- `Termina sessione` deve restare visibile per tutta la sessione avviata.
- Il comando chiude microfono, audio e WebSocket.
- Cancella chat, trascrizioni e stato temporaneo della sessione corrente.
- Torna a una sessione nuova con menu attività non ancora presentato.
- Non salva mai la conversazione.
- Solo il pulsante `Salva` crea o aggiorna una conversazione nello storico.
- La persistenza tecnica di recupero è separata dall'archivio visibile e viene eliminata quando la sessione viene terminata esplicitamente.

## Avvio di una sessione nuova

Una sessione fresca:

- non eredita messaggi o argomenti precedenti;
- parla inizialmente solo in italiano;
- presenta una volta le quattro attività;
- non propone automaticamente viaggi, business, riunioni o role-play.

## Invarianti di regressione

- Voce e testo usano lo stesso orchestratore.
- Un turno strutturalmente consumato non viene inviato anche come turno ordinario a Gemini.
- I prompt interni non diventano bolle visibili né cronologia salvata.
- Il percorso REST non riceve Materiali positivi durante `learn_new_vocabulary`.
- Gli elementi futuri già in coda non sono esclusi prima di essere esposti.
- I target già esposti, acquisiti o presenti nei Materiali restano esclusi.
