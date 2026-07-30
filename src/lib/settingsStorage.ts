import { VoiceSettings, UserLevel } from '../types';

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceName: 'Achird',
  speed: 1.0,
  pauseToleranceSeconds: 5,
  turnMode: 'automatic',
  correctionMode: 'immediate',
  keepScreenAwake: true,
};

export const DEFAULT_USER_LEVEL: UserLevel = 'B1_B2';

const SETTINGS_STORAGE_KEY = 'learning_app_settings_v1';

export interface StoredSettings {
  voiceSettings: VoiceSettings;
  userLevel: UserLevel;
}

export function loadSettingsFromStorage(): StoredSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = { ...DEFAULT_VOICE_SETTINGS, ...parsed.voiceSettings };
      // Clamp to the three selectable reflection-pause tiers (Veloce/Standard/Paziente).
      merged.pauseToleranceSeconds = Math.min(8, Math.max(3, Number(merged.pauseToleranceSeconds) || 5));
      return {
        voiceSettings: merged,
        userLevel: parsed.userLevel || DEFAULT_USER_LEVEL,
      };
    }
  } catch (e) {
    console.error('Failed to load settings from storage:', e);
  }
  return {
    voiceSettings: DEFAULT_VOICE_SETTINGS,
    userLevel: DEFAULT_USER_LEVEL,
  };
}

export function saveSettingsToStorage(voiceSettings: VoiceSettings, userLevel: UserLevel): boolean {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ voiceSettings, userLevel })
    );
    return true;
  } catch (e) {
    console.error('Failed to save settings to storage:', e);
    return false;
  }
}
