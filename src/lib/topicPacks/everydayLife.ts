import { TopicPack } from './types';

export const EVERYDAY_LIFE_PACK: TopicPack = {
  id: 'everyday_life_and_daily_english',
  title: 'Everyday Life & Daily English',
  description: 'Espressioni e vocaboli pratici per la vita di tutti i giorni, le relazioni personali, lo shopping e la gestione del tempo.',
  version: '1.3.0',
  targetAudience: 'Studenti di tutti i livelli che desiderano comunicare spontaneamente nella quotidianità.',
  cefrRange: ['A1', 'A2', 'B1', 'B2', 'C1'],
  modules: [
    {
      id: 'daily_routine',
      title: 'Daily Routines & Habits',

      description: 'Descrivere la propria giornata, le abitudini e l’organizzazione del tempo.',
      competencyAreas: [
        {
          id: 'morning_evening_routines',
          title: 'Morning & Evening Routines',
          description: 'Espressioni utili per raccontare la mattina e la sera.',
          cefrLevel: 'A1_A2',
          learningObjectives: ['Descrivere la sequenza delle azioni quotidiane.'],
          realLifeSituations: ['Raccontare cosa si fa appena svegli.'],
        },
      ],
      seedItems: [
        {
          id: 'seed_wake_up',
          expression: 'wake up',
          meaning: 'svegliarsi (aprire gli occhi)',
          usage: 'Riferito all’atto di svegliarsi a letto.',
          example: 'I usually wake up at seven o’clock.',
          type: 'phrasal_verb',
          difficulty: 'A1',
        },
        {
          id: 'seed_get_up',
          expression: 'get up',
          meaning: 'alzarsi dal letto',
          usage: 'Riferito all’azione fisica di uscire dal letto.',
          example: 'I wake up at seven, but I get up at seven fifteen.',
          type: 'phrasal_verb',
          difficulty: 'A1',
        },
        {
          id: 'seed_look_forward_to',
          expression: 'look forward to',
          meaning: 'non vedere l’ora di / aspettare con ansia',
          usage: 'Seguito da sostantivo o verbo in -ing.',
          example: 'I look forward to meeting you tomorrow.',
          type: 'phrasal_verb',
          difficulty: 'B1',
        },
        {
          id: 'seed_run_out_of',
          expression: 'run out of',
          meaning: 'rimanere senza / esaurire',
          usage: 'Usato quando si finisce una scorta (tempo, latte, caffè).',
          example: 'We ran out of milk this morning.',
          type: 'phrasal_verb',
          difficulty: 'B1',
        },
      ],
    },
    {
      id: 'shopping_and_errands',
      title: 'Shopping & Daily Errands',
      description: 'Fare acquisti, chiedere prezzi, gestire resi e fare commissioni.',
      competencyAreas: [
        {
          id: 'at_the_store',
          title: 'At the Store & Customer Service',
          description: 'Interagire con i negozianti e chiedere assistenza.',
          cefrLevel: 'A2_B1',
          learningObjectives: ['Chiedere taglie, sconti e informazioni sui prodotti.'],
          realLifeSituations: ['Chiedere di provare un capo d’abbigliamento.'],
        },
      ],
      seedItems: [
        {
          id: 'seed_try_on',
          expression: 'try on',
          meaning: 'provare (un capo d’abbigliamento)',
          usage: 'Usato nei negozi di vestiti.',
          example: 'Can I try on this jacket in a medium?',
          type: 'phrasal_verb',
          difficulty: 'A2',
        },
        {
          id: 'seed_in_stock',
          expression: 'in stock',
          meaning: 'disponibile in negozio / a magazzino',
          usage: 'Riferito alla disponibilità immediata di un prodotto.',
          example: 'Do you have this item in stock?',
          type: 'chunk',
          difficulty: 'B1',
        },
      ],
    },
  ],
};
