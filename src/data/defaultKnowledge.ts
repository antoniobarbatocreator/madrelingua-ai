import { KnowledgeDocument } from '../types';

export const DEFAULT_KNOWLEDGE_DOCS: KnowledgeDocument[] = [
  {
    id: 'doc-travel-basics',
    title: 'Viaggi & Aeroporto - Frasi Utili',
    content: `Ecco un elenco di espressioni indispensabili per cavarsela in aeroporto e durante i viaggi:
1. "Could you please tell me where the baggage claim area is?" - Potrebbe dirmi dove si trova l'area ritiro bagagli?
2. "I would like to book a table for two people, please." - Vorrei prenotare un tavolo per due persone, per favore.
3. "Excuse me, how do I get to the nearest train station?" - Mi scusi, come arrivo alla stazione dei treni più vicina?
4. "Is there free Wi-Fi available here?" - C'è il Wi-Fi gratuito qui?
5. "Could I have the check, please?" - Potrei avere il conto, per favore?`,
    category: 'Viaggi',
    createdAt: '2025-01-10T10:00:00.000Z',
    updatedAt: '2025-01-10T10:00:00.000Z',
    extractedChunks: [
      {
        phrase: 'baggage claim area',
        translation: 'area ritiro bagagli',
        context: 'Could you please tell me where the baggage claim area is?',
        category: 'Viaggi',
      },
      {
        phrase: 'Could I have the check, please?',
        translation: 'Potrei avere il conto, per favore?',
        context: 'Al ristorante per chiedere il conto',
        category: 'Viaggi',
      },
    ],
  },
  {
    id: 'doc-business-meetings',
    title: 'Business English & Riunioni',
    content: `Espressioni professionali per riunioni e email di lavoro:
1. "I would like to touch base regarding our progress on the project." - Vorrei fare il punto sui nostri progressi nel progetto.
2. "Let's call it a day." - Concludiamo la giornata di lavoro per oggi.
3. "Could you elaborate on that point?" - Potrebbe approfondire quel punto?
4. "I'll get back to you by the end of the day." - Le risponderò entro la fine della giornata.
5. "Moving on to the next item on the agenda..." - Passando al punto successivo all'ordine del giorno...`,
    category: 'Business',
    createdAt: '2025-01-12T14:30:00.000Z',
    updatedAt: '2025-01-12T14:30:00.000Z',
    extractedChunks: [
      {
        phrase: 'touch base',
        translation: 'fare il punto / aggiornarsi',
        context: 'I would like to touch base regarding our progress.',
        category: 'Business',
      },
      {
        phrase: "Let's call it a day",
        translation: 'Concludiamo per oggi',
        context: 'Alla fine di una riunione o giornata di lavoro',
        category: 'Business',
      },
    ],
  },
];

export const INITIAL_KNOWLEDGE_DOCUMENTS = DEFAULT_KNOWLEDGE_DOCS;

