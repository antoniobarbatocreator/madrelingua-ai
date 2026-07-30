import { TopicPack } from './types';

export const TRAVEL_TRANSPORT_HOSPITALITY_PACK: TopicPack = {
  id: 'travel_transport_and_hospitality',
  title: 'Travel, Transport & Hospitality',
  description: 'Muoversi all’estero, aeroporti, hotel, trasporti e risoluzione di imprevisti durante i viaggi.',
  version: '1.3.0',
  targetAudience: 'Viaggiatori, turisti e professionisti che si spostano all’estero.',
  cefrRange: ['A1', 'A2', 'B1', 'B2', 'C1'],
  modules: [
    {
      id: 'airport_and_flights',
      title: 'Airport & Flights',
      description: 'Check-in, imbarco, controlli di sicurezza e coincidenze aeree.',
      competencyAreas: [
        {
          id: 'boarding_and_layovers',
          title: 'Boarding & Layovers',
          description: 'Gestire coincidenze e ritardi al gate.',
          cefrLevel: 'A2_B1',
          learningObjectives: ['Chiedere indicazioni sul gate e sulle coincidenze.'],
          realLifeSituations: ['Parlare con il personale di bordo o di terra.'],
        },
      ],
      seedItems: [
        {
          id: 'seed_check_in',
          expression: 'check in',
          meaning: 'fare il check-in / registrarsi',
          usage: 'Usato sia in aeroporto sia in hotel.',
          example: 'We need to check in two hours before the flight.',
          type: 'phrasal_verb',
          difficulty: 'A1',
        },
        {
          id: 'seed_layover',
          expression: 'layover',
          meaning: 'scalo / coincidenza aerea',
          usage: 'Sostantivo per la sosta tra due voli.',
          example: 'We have a three-hour layover in Frankfurt.',
          type: 'word',
          difficulty: 'B1',
        },
        {
          id: 'seed_carry_on',
          expression: 'carry-on bag',
          meaning: 'bagaglio a mano',
          usage: 'Sostantivo per la valigia da portare in cabina.',
          example: 'Is this small suitcase allowed as a carry-on bag?',
          type: 'chunk',
          difficulty: 'A2',
        },
      ],
    },
    {
      id: 'hotel_and_accommodation',
      title: 'Hotel & Accommodation',
      description: 'Prenotazioni, richiesta di servizi in camera e segnalazione di problemi.',
      competencyAreas: [
        {
          id: 'reception_requests',
          title: 'Reception Requests & Issues',
          description: 'Interagire con la reception per richieste o lamentele.',
          cefrLevel: 'A2_B1',
          learningObjectives: ['Segnalare che la stanza ha un problema o chiedere asciugamani.'],
          realLifeSituations: ['Chiedere il check-out posticipato.'],
        },
      ],
      seedItems: [
        {
          id: 'seed_late_checkout',
          expression: 'late check-out',
          meaning: 'check-out posticipato',
          usage: 'Richiesta di lasciare la stanza più tardi.',
          example: 'Could we request a late check-out tomorrow?',
          type: 'chunk',
          difficulty: 'A2',
        },
      ],
    },
  ],
};
