import React, { useState, useCallback } from "react";
import { Tab, Activity, ChatMessage, AppSettings, SavedSession } from "./types";
import { loadSessions, saveSession, deleteSession, loadSettings, saveSettings } from "./lib/storage";
import { HomeScreen } from "./components/HomeScreen";
import { SessionScreen } from "./components/SessionScreen";
import { HistoryScreen } from "./components/HistoryScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { AboutScreen } from "./components/AboutScreen";
import { KnowledgeScreen, ReviewMode } from "./components/KnowledgeScreen";
import { TabBar } from "./components/TabBar";
import { KnowledgeItem } from "./lib/knowledge";
import { SessionKnowledge } from "./lib/voiceEngine";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [inSession, setInSession] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => loadSessions());
  const [currentActivity, setCurrentActivity] = useState<Activity>("conversazione");
  const [knowledge, setKnowledge] = useState<SessionKnowledge | undefined>();

  const handleSelectActivity = useCallback((activity: Activity) => {
    setCurrentActivity(activity);
    setKnowledge(undefined);
    setInSession(true);
  }, []);

  const handleStartReview = useCallback(
    (items: KnowledgeItem[], mode: ReviewMode, sourceName?: string) => {
      setKnowledge({
        items: items.map((i) => ({
          phrase: i.phrase,
          translation: i.translation,
          context: i.context,
          category: i.category,
        })),
        sourceName,
        mode,
      });
      setCurrentActivity("ripasso");
      setInSession(true);
    },
    []
  );

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
        speechRate={settings.speechRate}
        knowledge={knowledge}
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
        {activeTab === "knowledge" && (
          <KnowledgeScreen onStartReview={handleStartReview} />
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
