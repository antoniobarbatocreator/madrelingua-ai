import React, { useState, useEffect } from 'react';
import { ActiveTab, ChatMessage, KnowledgeDocument, TopicFocus, UserLevel, VoiceSettings } from './types';
import { INITIAL_KNOWLEDGE_DOCUMENTS } from './data/defaultKnowledge';
import { Navbar } from './components/Navbar';
import { VoiceStudio } from './components/VoiceStudio';
import { KnowledgeManager } from './components/KnowledgeManager';
import { NeuroMethodGuide } from './components/NeuroMethodGuide';
import { VocabularyHistory } from './components/VocabularyHistory';
import { ConversationHistory } from './components/ConversationHistory';
import { loadSettingsFromStorage, saveSettingsToStorage } from './lib/settingsStorage';
import { loadKnowledgeDocsFromStorage, saveKnowledgeDocsToStorage } from './lib/knowledgeStorage';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');

  // Synchronous Lazy State Initialization for App Settings
  const [initialSettings] = useState(() => loadSettingsFromStorage());
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(initialSettings.voiceSettings);
  const [userLevel, setUserLevel] = useState<UserLevel>(initialSettings.userLevel);

  const [topicFocus, setTopicFocus] = useState<TopicFocus>('FREE_TALK');
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>(() => loadKnowledgeDocsFromStorage());
  const [resumedTitle, setResumedTitle] = useState<string | null>(null);

  // Authoritative Save Function for Settings
  const handleSaveAppSettings = (
    nextVoiceSettings: VoiceSettings,
    nextUserLevel: UserLevel
  ): boolean => {
    const saved = saveSettingsToStorage(nextVoiceSettings, nextUserLevel);
    if (!saved) {
      return false;
    }
    setVoiceSettings(nextVoiceSettings);
    setUserLevel(nextUserLevel);
    return true;
  };

  // Save knowledgeDocs to persistent storage whenever they change
  useEffect(() => {
    saveKnowledgeDocsToStorage(knowledgeDocs);
  }, [knowledgeDocs]);

  // Ensure document item counts are strictly synchronized with extractedChunks.length
  useEffect(() => {
    setKnowledgeDocs((prevDocs) =>
      prevDocs.map((doc) => {
        const count = doc.extractedChunks ? doc.extractedChunks.length : 0;
        if (doc.vocabularyCount !== count || doc.indexedItemCount !== count) {
          return {
            ...doc,
            vocabularyCount: count,
            indexedItemCount: count,
            indexingStatus: doc.indexingStatus || 'ready',
          };
        }
        return doc;
      })
    );
  }, []);

  // The active Gemini session owns the greeting. UI state starts empty to avoid duplicate welcomes.
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleResumeConversation = (contextMessages: ChatMessage[], sourceTitle: string) => {
    setMessages(contextMessages);
    setResumedTitle(sourceTitle);
    setActiveTab('studio');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userLevel={userLevel}
        knowledgeCount={knowledgeDocs.length}
        voiceSettings={voiceSettings}
        onSaveAppSettings={handleSaveAppSettings}
      />

      {/* Main Tab View Routing */}
      <main className="flex-1 overflow-x-hidden pb-16 md:pb-0">
        {activeTab === 'studio' && (
          <VoiceStudio
            userLevel={userLevel}
            voiceSettings={voiceSettings}
            setVoiceSettings={setVoiceSettings}
            knowledgeDocs={knowledgeDocs}
            messages={messages}
            setMessages={setMessages}
            resumedTitle={resumedTitle}
            onSessionReset={() => setResumedTitle(null)}
          />
        )}

        {activeTab === 'knowledge' && (
          <KnowledgeManager
            knowledgeDocs={knowledgeDocs}
            setKnowledgeDocs={setKnowledgeDocs}
          />
        )}

        {activeTab === 'method' && <NeuroMethodGuide />}

        {activeTab === 'review' && (
          <VocabularyHistory
            messages={messages}
            knowledgeDocs={knowledgeDocs}
            voiceSettings={voiceSettings}
            onGoToStudio={() => setActiveTab('studio')}
          />
        )}

        {activeTab === 'history' && (
          <ConversationHistory
            onResumeConversation={handleResumeConversation}
            onGoToStudio={() => setActiveTab('studio')}
          />
        )}
      </main>
    </div>
  );
}
