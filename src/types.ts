import { Activity, VoiceMode, EngineState } from "./lib/voiceEngine";

export type { Activity, VoiceMode, EngineState };

export type Tab = "home" | "knowledge" | "history" | "settings" | "about";

export interface ChatMessage {
  id: string;
  sender: "user" | "coach";
  text: string;
  timestamp: string;
}

export interface SavedSession {
  id: string;
  title: string;
  activity: Activity;
  messages: ChatMessage[];
  date: string;
  level: string;
}

export interface AppSettings {
  level: string;
  voiceName: string;
  voiceMode: VoiceMode;
  /** Coach speaking pace. 1 = natural, 0.7 = 30% slower. Pitch is preserved. */
  speechRate: number;
}

export const LEVELS = ["A1-A2", "B1-B2", "C1-C2"] as const;

export const ACTIVITY_META: Record<Activity, { label: string; description: string }> = {
  conversazione: { label: "Conversazione", description: "Chiacchierata libera su argomenti quotidiani" },
  lezione: { label: "Lezione", description: "Grammatica, espressioni e strutture della lingua" },
  vocabolario: { label: "Vocabolario", description: "Impara parole nuove e phrasal verbs" },
  quiz: { label: "Quiz", description: "Giochi e tecniche per imparare divertendoti" },
  traduci: { label: "Traduci", description: "Traduci frasi e scopri come si dice in inglese" },
  ripasso: { label: "Ripasso", description: "I vocaboli della tua libreria personale" },
};
