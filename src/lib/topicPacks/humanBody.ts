import { TopicPack } from './types';

export const HUMAN_BODY_PACK: TopicPack = {
  id: 'human_body_anatomy_and_sensations',
  title: 'Human Body, Anatomy & Sensations',
  description: 'Parti del corpo, anatomia, sensazioni fisiche e movimento.',
  version: '1.3.0',
  targetAudience: 'Studenti che vogliono descrivere il corpo umano, dolori specifici e percezioni fisiche.',
  cefrRange: ['A1', 'A2', 'B1', 'B2'],
  modules: [
    {
      id: 'body_parts_and_sensations',
      title: 'Body Parts & Physical Sensations',
      description: 'Identificare organi, articolazioni e sensazioni fisiche.',
      competencyAreas: [
        {
          id: 'joints_and_muscles',
          title: 'Joints, Muscles & Internal Feeling',
          description: 'Parlare di muscoli, articolazioni e fastidi fisici.',
          cefrLevel: 'A2_B1',
          learningObjectives: ['Identificare con precisione la parte del corpo che duole.'],
          realLifeSituations: ['Spiegare un infortunio sportivo o un crampo.'],
        },
      ],
      seedItems: [
        {
          id: 'seed_sore_throat',
          expression: 'sore throat',
          meaning: 'mal di gola',
          usage: 'Nome composto molto comune.',
          example: 'I woke up with a sore throat this morning.',
          type: 'collocation',
          difficulty: 'A1',
        },
        {
          id: 'seed_stiff_neck',
          expression: 'stiff neck',
          meaning: 'torcicollo / collo rigido',
          usage: 'Usato quando i muscoli del collo sono contratti.',
          example: 'I have a stiff neck from sleeping in an awkward position.',
          type: 'collocation',
          difficulty: 'A2',
        },
        {
          id: 'seed_sprain_ankle',
          expression: 'sprain an ankle',
          meaning: 'stortarsi / prendere una storta alla caviglia',
          usage: 'Collocazione verbale usata per infortuni da distorsione.',
          example: 'He sprained his ankle while playing tennis.',
          type: 'collocation',
          difficulty: 'B1',
        },
      ],
    },
  ],
};
