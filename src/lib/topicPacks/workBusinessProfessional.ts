import { TopicPack } from './types';

export const WORK_BUSINESS_PROFESSIONAL_PACK: TopicPack = {
  id: 'work_business_and_professional',
  title: 'Work, Business & Professional English',
  description: 'Riunioni, email di lavoro, negoziazioni, presentazioni e gestione di progetti.',
  version: '1.3.0',
  targetAudience: 'Professionisti, lavoratori e studenti che utilizzano l’inglese in contesti lavorativi.',
  cefrRange: ['B1', 'B2', 'C1', 'C2'],
  modules: [
    {
      id: 'business_meetings_and_discussions',
      title: 'Business Meetings & Discussions',
      description: 'Esprimere opinioni, concordare, dissentire con tatto e gestire l’ordine del giorno.',
      competencyAreas: [
        {
          id: 'expressing_opinions_tactfully',
          title: 'Expressing Opinions Tactfully',
          description: 'Esprimere disaccordo e proporre alternative in modo professionale.',
          cefrLevel: 'B2_C1',
          learningObjectives: ['Proporre una modifica a un piano senza risultare aggressivi.'],
          realLifeSituations: ['Intervenire in una riunione aziendale.'],
        },
      ],
      seedItems: [
        {
          id: 'seed_point_out',
          expression: 'point out',
          meaning: 'far notare / evidenziare',
          usage: 'Phrasal verb fondamentale per attirare l’attenzione su un dettaglio.',
          example: 'I would like to point out that our timeline is quite tight.',
          type: 'phrasal_verb',
          difficulty: 'B1',
        },
        {
          id: 'seed_carry_out',
          expression: 'carry out',
          meaning: 'svolgere / eseguire (un piano, un’analisi, un compito)',
          usage: 'Usato per azioni lavorative e operative.',
          example: 'We need to carry out a risk assessment before launching.',
          type: 'phrasal_verb',
          difficulty: 'B2',
        },
        {
          id: 'seed_touch_base',
          expression: 'touch base',
          meaning: 'farsi sentire / aggiornarsi brevemente',
          usage: 'Espressione colloquiale aziendale molto usata.',
          example: 'Let’s touch base early next week to review progress.',
          type: 'chunk',
          difficulty: 'B2',
        },
        {
          id: 'seed_bottom_line',
          expression: 'the bottom line',
          meaning: 'il punto fondamentale / il risultato finale (economico o pratico)',
          usage: 'Sostantivo idiomatico nel business.',
          example: 'The bottom line is that we need to increase sales.',
          type: 'idiom',
          difficulty: 'B2',
        },
      ],
    },
    {
      id: 'professional_emails_and_writing',
      title: 'Professional Emails & Correspondence',
      description: 'Formule di apertura e chiusura, solleciti e richieste di informazioni via email.',
      competencyAreas: [
        {
          id: 'email_follow_ups',
          title: 'Email Follow-ups & Reminders',
          description: 'Scrivere email di sollecito eleganti e professionali.',
          cefrLevel: 'B1_B2',
          learningObjectives: ['Inviare un sollecito professionale.'],
          realLifeSituations: ['Ricordare una scadenza a un cliente o collega.'],
        },
      ],
      seedItems: [
        {
          id: 'seed_follow_up_on',
          expression: 'follow up on',
          meaning: 'dar seguito a / verificare lo stato di',
          usage: 'Usato nelle email per fare il punto su una richiesta.',
          example: 'I’m writing to follow up on our discussion from yesterday.',
          type: 'phrasal_verb',
          difficulty: 'B1',
        },
      ],
    },
  ],
};
