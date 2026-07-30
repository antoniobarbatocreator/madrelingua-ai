import { TopicPack } from './types';

export const HEALTH_PHARMACY_MEDICAL_PACK: TopicPack = {
  id: 'health_pharmacy_and_medical',
  title: 'Health, Pharmacy & Medical',
  description: 'Comunicare sintomi, acquistare farmaci in farmacia, prenotare visite e spiegare problemi di salute.',
  version: '1.3.0',
  targetAudience: 'Studenti e viaggiatori che hanno la necessità di descrivere uno stato di salute o chiedere assistenza medica.',
  cefrRange: ['A2', 'B1', 'B2', 'C1'],
  modules: [
    {
      id: 'at_the_pharmacy',
      title: 'At the Pharmacy',
      description: 'Chiedere farmaci da banco, comprendere i dosaggi e spiegare sintomi minori.',
      competencyAreas: [
        {
          id: 'over_the_counter_remedies',
          title: 'Over-the-Counter Remedies',
          description: 'Acquistare medicinali senza ricetta.',
          cefrLevel: 'A2_B1',
          learningObjectives: ['Chiedere un rimedio per mal di testa o febbre.'],
          realLifeSituations: ['Spiegare al farmacista cosa fa male.'],
        },
      ],
      seedItems: [
        {
          id: 'seed_painkiller',
          expression: 'painkiller',
          meaning: 'antidolorifico / analgesico',
          usage: 'Sostantivo comune in farmacia.',
          example: 'Do you have any strong painkillers for a headache?',
          type: 'word',
          difficulty: 'A2',
        },
        {
          id: 'seed_over_the_counter',
          expression: 'over-the-counter',
          meaning: 'da banco (senza ricetta)',
          usage: 'Aggettivo usato per farmaci acquistabili liberamente.',
          example: 'Is this medicine available over-the-counter?',
          type: 'chunk',
          difficulty: 'B1',
        },
        {
          id: 'seed_side_effects',
          expression: 'side effects',
          meaning: 'effetti collaterali',
          usage: 'Sostantivo al plurale per le reazioni avverse ai farmaci.',
          example: 'Does this prescription have any known side effects?',
          type: 'collocation',
          difficulty: 'B1',
        },
      ],
    },
    {
      id: 'describing_symptoms_and_illness',
      title: 'Describing Symptoms & Illness',
      description: 'Esprimere dolori, malesseri e condizioni fisiche al medico.',
      competencyAreas: [
        {
          id: 'doctor_appointment',
          title: 'At the Doctor’s Surgery',
          description: 'Spiegare da quanti giorni dura un disturbo e dove fa male.',
          cefrLevel: 'B1_B2',
          learningObjectives: ['Descrivere l’intensità e la durata di un sintomo.'],
          realLifeSituations: ['Rispondere alle domande del medico durante la visita.'],
        },
      ],
      seedItems: [
        {
          id: 'seed_come_down_with',
          expression: 'come down with',
          meaning: 'ammalarsi di / prendere (un’influenza, un raffreddore)',
          usage: 'Phrasal verb molto naturale nel parlato.',
          example: 'I think I’m coming down with the flu.',
          type: 'phrasal_verb',
          difficulty: 'B1',
        },
        {
          id: 'seed_dizzy',
          expression: 'feel dizzy',
          meaning: 'avere i giramenti di testa / sentirsi stordito',
          usage: 'Riferito alla sensazione di perdere l’equilibrio.',
          example: 'I felt dizzy when I stood up.',
          type: 'collocation',
          difficulty: 'A2',
        },
      ],
    },
  ],
};
