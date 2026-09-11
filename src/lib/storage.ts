import { SavedSession, AppSettings } from "../types";

const SESSIONS_KEY = "madrelingua_sessions";
const SETTINGS_KEY = "madrelingua_settings";

const DEFAULTS: AppSettings = {
  level: "A1-A2",
  voiceName: "Achird",
  voiceMode: "free",
  speechRate: 0.85,
};

export function loadSessions(): SavedSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: SavedSession) {
  const sessions = loadSessions();
  sessions.unshift(session);
  if (sessions.length > 50) sessions.length = 50;
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function deleteSession(id: string) {
  const sessions = loadSessions().filter((s) => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch {}
  return { ...DEFAULTS };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
