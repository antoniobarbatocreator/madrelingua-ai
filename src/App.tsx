import React, { useState, useCallback } from "react";
import { Tab, Activity, ChatMessage, AppSettings, SavedSession } from "./types";
import { loadSessions, saveSession, deleteSession, loadSettings, saveSettings } from "./lib/storage";
import { HomeScreen } from "./components/HomeScreen";
import { SessionScreen } from "./components/SessionScreen";
import { HistoryScreen } from "./components/HistoryScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { AboutScreen } from "./components/AboutScreen";
import { TabBar } from "./components/TabBar";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [inSession, setInSession] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => loadSessions());
  const [currentActivity, setCurrentActivity] = useState<Activity>("conversazione");

  const handleSelectActivity = useCallback((activity: Activity) => {
    setCurrentActivity(activity);
    setInSession(true);
  }, []);

  const handleSaveSession = useCallback((messages: ChatMessage[], activity: Activity) => {
    const firstCoachMsg = messages.find((m) => m.sender === "coach");
    const title = firstCoachMsg
      ? firstCoachMsg.text.slice(0, 60) + (firstCoachMsg.text.length > 60 ? "..." : "")
      : "Sessione";

    const session: SavedSession = {
      id: `s_${Date.now()}`,
      title,
      activity,
      messages,
      date: new Date().toLocaleDateString("it-IT"),
      level: settings.level,
    };

    saveSession(session);
    setSavedSessions(loadSessions());
    setInSession(false);
  }, [settings.level]);

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id);
    setSavedSessions(loadSessions());
  }, []);

  const handleSaveSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  if (inSession) {
    return (
      <SessionScreen
        activity={currentActivity}
        level={settings.level}
        voiceName={settings.voiceName}
        voiceMode={settings.voiceMode}
        onBack={() => setInSession(false)}
        onSave={handleSaveSession}
      />
    );
  }

  return (
    <div className="h-app flex flex-col bg-warm">
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "home" && (
          <HomeScreen onSelectActivity={handleSelectActivity} />
        )}
        {activeTab === "history" && (
          <HistoryScreen
            sessions={savedSessions}
            onDeleteSession={handleDeleteSession}
          />
        )}
        {activeTab === "settings" && (
          <SettingsScreen
            settings={settings}
            onSave={handleSaveSettings}
          />
        )}
        {activeTab === "about" && <AboutScreen />}
      </div>
      <TabBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        historyCount={savedSessions.length}
      />
    </div>
  );
}
