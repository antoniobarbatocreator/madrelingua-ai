import { TopicPack, TopicModule } from './types';
import { EVERYDAY_LIFE_PACK } from './everydayLife';
import { HEALTH_PHARMACY_MEDICAL_PACK } from './healthPharmacyMedical';
import { HUMAN_BODY_PACK } from './humanBody';

export const TRAVEL_ESSENTIALS_PACK: TopicPack = {
  id: 'travel_essentials',
  title: 'Viaggi e Aeroporto',
  description: 'Muoversi all’estero, controlli in aeroporto, hotel e indicazioni stradali.',
  version: '1.3.0',
  targetAudience: 'Viaggiatori e turisti.',
  cefrRange: ['A1', 'A2', 'B1', 'B2'],
  modules: [
    {
      id: 'airport_and_flights',
      title: 'Aeroporto e Check-in',
      description: 'Check-in, imbarco e controlli di sicurezza.',
      competencyAreas: [
        {
          id: 'boarding',
          title: 'Controlli e Gate',
          description: 'Gestire il gate e le informazioni sul volo.',
          cefrLevel: 'A2_B1',
        },
      ],
      seedItems: [
        {
          id: 'travel_1',
          expression: 'carry-on luggage',
          meaning: 'bagaglio a mano',
          type: 'chunk',
          difficulty: 'A2',
        },
        {
          id: 'travel_2',
          expression: 'boarding pass',
          meaning: 'carta di imbarco',
          type: 'word',
          difficulty: 'A1',
        },
        {
          id: 'travel_3',
          expression: 'baggage claim area',
          meaning: 'area ritiro bagagli',
          type: 'chunk',
          difficulty: 'A2',
        },
      ],
    },
  ],
};

export const WORKPLACE_BUSINESS_PACK: TopicPack = {
  id: 'workplace_and_business_communication',
  title: 'Lavoro e Business',
  description: 'Riunioni, email aziendali, presentazioni e negoziazione.',
  version: '1.3.0',
  targetAudience: 'Professionisti.',
  cefrRange: ['B1', 'B2', 'C1'],
  modules: [
    {
      id: 'meetings_and_discussions',
      title: 'Riunioni di Lavoro',
      description: 'Esprimere opinioni e fare il punto.',
      competencyAreas: [
        {
          id: 'business_opinions',
          title: 'Opinioni in Riunione',
          description: 'Espressioni per intervenire in riunione.',
          cefrLevel: 'B1_B2',
        },
      ],
      seedItems: [
        {
          id: 'work_1',
          expression: 'touch base',
          meaning: 'fare il punto / aggiornarsi',
          type: 'chunk',
          difficulty: 'B2',
        },
        {
          id: 'work_2',
          expression: 'call it a day',
          meaning: 'chiudere per oggi / concludere i lavori',
          type: 'idiom',
          difficulty: 'B2',
        },
        {
          id: 'work_3',
          expression: 'get ahead on work',
          meaning: 'portarsi avanti con il lavoro',
          type: 'phrasal_verb',
          difficulty: 'B2',
        },
        {
          id: 'work_4',
          expression: 'make the most of',
          meaning: 'sfruttare al massimo',
          type: 'chunk',
          difficulty: 'B2',
        },
      ],
    },
  ],
};

export const SOCIAL_SITUATIONS_PACK: TopicPack = {
  id: 'social_situations_and_small_talk',
  title: 'Situazioni Sociali e Small Talk',
  description: 'Rompere il ghiaccio, fare conversazione sociale e socializzare.',
  version: '1.3.0',
  targetAudience: 'Tutti i livelli.',
  cefrRange: ['A1', 'A2', 'B1', 'B2'],
  modules: [
    {
      id: 'breaking_the_ice',
      title: 'Rompere il Ghiaccio',
      description: 'Piccole conversazioni quotidiane.',
      competencyAreas: [{ id: 'icebreakers', title: 'Frasi di apertura', description: 'Iniziare una chiacchierata.', cefrLevel: 'A1_A2' }],
      seedItems: [
        { id: 'soc_1', expression: 'how is it going', meaning: 'come va', type: 'chunk', difficulty: 'A1' },
      ],
    },
  ],
};

export const FOOD_DINING_PACK: TopicPack = {
  id: 'food_dining_and_cooking',
  title: 'Cibo, Ristorante e Cucina',
  description: 'Ordinare al ristorante, ingredienti e ricette.',
  version: '1.3.0',
  targetAudience: 'Tutti i livelli.',
  cefrRange: ['A1', 'A2', 'B1', 'B2'],
  modules: [
    {
      id: 'at_the_restaurant',
      title: 'Al Ristorante',
      description: 'Chiedere il conto e ordinare.',
      competencyAreas: [{ id: 'ordering', title: 'Ordinazioni', description: 'Ordinare piatti.', cefrLevel: 'A1_A2' }],
      seedItems: [
        { id: 'food_1', expression: 'could I have the check please', meaning: 'potrei avere il conto per favore', type: 'chunk', difficulty: 'A2' },
      ],
    },
  ],
};

export const SHOPPING_SERVICES_PACK: TopicPack = {
  id: 'shopping_and_services',
  title: 'Shopping e Servizi',
  description: 'Acquisti nei negozi, prezzi e pagamenti.',
  version: '1.3.0',
  targetAudience: 'Tutti i livelli.',
  cefrRange: ['A1', 'A2', 'B1'],
  modules: [
    {
      id: 'in_the_shop',
      title: 'Nei Negozi',
      description: 'Chiedere sconti e prezzi.',
      competencyAreas: [{ id: 'prices', title: 'Prezzi', description: 'Chiedere quanto costa.', cefrLevel: 'A1_A2' }],
      seedItems: [
        { id: 'shop_1', expression: 'how much is this', meaning: 'quanto costa questo', type: 'chunk', difficulty: 'A1' },
      ],
    },
  ],
};

export const TECH_MEDIA_PACK: TopicPack = {
  id: 'tech_digital_and_media',
  title: 'Tecnologia e Media Digitali',
  description: 'Internet, dispositivi digitali, app e social network.',
  version: '1.3.0',
  targetAudience: 'Tutti i livelli.',
  cefrRange: ['A2', 'B1', 'B2'],
  modules: [
    {
      id: 'digital_life',
      title: 'Vita Digitale',
      description: 'Computer e internet.',
      competencyAreas: [{ id: 'internet', title: 'Uso di internet', description: 'Navigare online.', cefrLevel: 'A2_B1' }],
      seedItems: [
        { id: 'tech_1', expression: 'log in', meaning: 'effettuare l’accesso', type: 'phrasal_verb', difficulty: 'A2' },
      ],
    },
  ],
};

export const EDUCATION_CULTURE_PACK: TopicPack = {
  id: 'education_culture_and_hobbies',
  title: 'Istruzione, Cultura e Hobby',
  description: 'Studio, libri, film, sport e passatempi.',
  version: '1.3.0',
  targetAudience: 'Tutti i livelli.',
  cefrRange: ['A2', 'B1', 'B2'],
  modules: [
    {
      id: 'free_time_hobbies',
      title: 'Tempo Libero e Hobby',
      description: 'Parlare dei propri interessi.',
      competencyAreas: [{ id: 'interests', title: 'Interessi personali', description: 'Descrivere cosa piace fare.', cefrLevel: 'A2_B1' }],
      seedItems: [
        { id: 'edu_1', expression: 'be into', meaning: 'essere appassionato di', type: 'phrasal_verb', difficulty: 'B1' },
      ],
    },
  ],
};

export const OPINIONS_DEBATE_PACK: TopicPack = {
  id: 'opinions_feelings_and_debate',
  title: 'Opinioni, Emozioni e Dibattito',
  description: 'Esprimere punti di vista, argomentare ed emozioni.',
  version: '1.3.0',
  targetAudience: 'Livelli intermedi e avanzati.',
  cefrRange: ['B1', 'B2', 'C1'],
  modules: [
    {
      id: 'expressing_views',
      title: 'Esprimere il Proprio Punto di Vista',
      description: 'Argomentare con garbo.',
      competencyAreas: [{ id: 'debate', title: 'Confronto', description: 'Discutere un’idea.', cefrLevel: 'B2_C1' }],
      seedItems: [
        { id: 'op_1', expression: 'from my perspective', meaning: 'dal mio punto di vista', type: 'chunk', difficulty: 'B2' },
      ],
    },
  ],
};

export const TOPIC_PACKS: TopicPack[] = [
  EVERYDAY_LIFE_PACK,
  TRAVEL_ESSENTIALS_PACK,
  HEALTH_PHARMACY_MEDICAL_PACK,
  HUMAN_BODY_PACK,
  WORKPLACE_BUSINESS_PACK,
  SOCIAL_SITUATIONS_PACK,
  FOOD_DINING_PACK,
  SHOPPING_SERVICES_PACK,
  TECH_MEDIA_PACK,
  EDUCATION_CULTURE_PACK,
  OPINIONS_DEBATE_PACK,
];

export const PACK_ITALIAN_LABELS: Record<string, string> = {
  everyday_life_and_daily_english: 'Vita quotidiana e inglese pratico',
  travel_essentials: 'Viaggi e aeroporto',
  health_pharmacy_and_medical: 'Salute, farmacia e visite mediche',
  human_body_anatomy_and_sensations: 'Corpo umano, anatomia e sensazioni',
  workplace_and_business_communication: 'Lavoro, business e email',
  social_situations_and_small_talk: 'Situazioni sociali e chiarimenti',
  food_dining_and_cooking: 'Cibo, ristorante e cucina',
  shopping_and_services: 'Shopping, acquisti e servizi',
  tech_digital_and_media: 'Tecnologia, digitale e media',
  education_culture_and_hobbies: 'Istruzione, cultura e hobby',
  opinions_feelings_and_debate: 'Opinioni, emozioni e dibattito',
};

const PACK_ALIASES: Record<string, string[]> = {
  everyday_life_and_daily_english: ['routine quotidiana', 'vita di tutti i giorni', 'giornata', 'daily english'],
  travel_essentials: ['viaggi e aeroporto', 'aeroporto e check-in', 'viaggio', 'volo', 'hotel'],
  health_pharmacy_and_medical: ['salute e farmacia', 'farmacia e rimedi', 'medico e visite', 'dottore'],
  human_body_anatomy_and_sensations: ['corpo umano e anatomia', 'anatomia e sensazioni', 'parti del corpo'],
  workplace_and_business_communication: ['lavoro e business', 'riunioni e business', 'email aziendali', 'ufficio'],
  social_situations_and_small_talk: ['situazioni sociali', 'small talk e conversazione', 'socializzare'],
  food_dining_and_cooking: ['cibo e ristorante', 'ristorante e cucina', 'ordinare al ristorante'],
  shopping_and_services: ['acquisti e servizi', 'shopping e negozi', 'negozi e pagamenti'],
  tech_digital_and_media: ['tecnologia e digitale', 'media digitali', 'dispositivi e internet'],
  education_culture_and_hobbies: ['istruzione e hobby', 'cultura e tempo libero', 'passatempi'],
  opinions_feelings_and_debate: ['opinioni e dibattito', 'esprimere opinioni', 'emozioni e dibattito'],
};


export function getPackSelectionAliases(packId: string): string[] {
  return PACK_ALIASES[packId] || [];
}

export function getAllTopicPacks(): TopicPack[] {
  return TOPIC_PACKS;
}

export function getTopicPack(packId: string): TopicPack | undefined {
  return TOPIC_PACKS.find((p) => p.id === packId);
}

export function getModule(packId: string, moduleId: string): TopicModule | undefined {
  const pack = getTopicPack(packId);
  return pack?.modules.find((m) => m.id === moduleId);
}

export function findMatchingModule(query: string): { pack: TopicPack; module: TopicModule } | null {
  const norm = query.toLowerCase().trim();
  for (const pack of TOPIC_PACKS) {
    for (const mod of pack.modules) {
      if (
        pack.title.toLowerCase().includes(norm) ||
        mod.title.toLowerCase().includes(norm) ||
        norm.includes(mod.id) ||
        norm.includes(pack.id)
      ) {
        return { pack, module: mod };
      }
    }
  }
  return null;
}

export function getMacroTopicOverview(packId?: string): {
  packs: TopicPack[];
  readableListString: string;
  formattedPromptPanorama: string;
  toString(): string;
} {
  const packs = packId ? TOPIC_PACKS.filter((p) => p.id === packId) : TOPIC_PACKS;

  const lines = packs.map((p, idx) => {
    const label = PACK_ITALIAN_LABELS[p.id] || p.title;
    return `${idx + 1}. **${label}**: ${p.description}`;
  });

  const readableListString = lines.join('\n');
  const formattedPromptPanorama = `TOPIC PACK DISPONIBILI:\n${readableListString}\n\nPuoi anche propormi un argomento diverso oppure chiedere phrasal verbs, collocations ed espressioni specifiche.`;

  return {

    packs: TOPIC_PACKS,
    readableListString,
    formattedPromptPanorama,
    toString: () => formattedPromptPanorama,
  };
}
