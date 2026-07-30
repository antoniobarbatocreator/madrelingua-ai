import React, { useState, useEffect, useMemo } from 'react';
import {
  conversationRepository,
  SavedConversation,
  SavedMessage,
  detectTextLanguage,
} from '../lib/conversationStorage';
import { ChatMessage } from '../types';
import {
  History,
  Search,
  Calendar,
  Clock,
  MessageSquare,
  Trash2,
  Edit3,
  Download,
  RotateCcw,
  ArrowLeft,
  FileText,
  FileJson,
  Check,
  X,
  AlertTriangle,
  Upload,
  Shield,
  Mic,
  Play,
  MoreVertical,
} from 'lucide-react';
import { SectionHeader } from './common/SectionHeader';
import { EmptyState } from './common/EmptyState';
import { ContextMenu, MenuItem } from './common/ContextMenu';
import { ConfirmDialog } from './common/ConfirmDialog';

interface ConversationHistoryProps {
  onResumeConversation: (contextMessages: ChatMessage[], sourceTitle: string) => void;
  onGoToStudio: () => void;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  onResumeConversation,
  onGoToStudio,
}) => {
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConv, setSelectedConv] = useState<SavedConversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  // Modals & Confirmation dialogs
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [exportModalConv, setExportModalConv] = useState<SavedConversation | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const list = await conversationRepository.getAllConversations();
    setConversations(list);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Filtered
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter((c) => {
      const title = c.title || '';
      if (title.toLowerCase().includes(q)) return true;
      if (!c.messages) return false;
      return c.messages.some((m) => (m.text || '').toLowerCase().includes(q));
    });
  }, [conversations, searchQuery]);

  // Temporal Grouping
  const groupedConversations = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const groups: {
      today: SavedConversation[];
      yesterday: SavedConversation[];
      last7Days: SavedConversation[];
      older: SavedConversation[];
    } = {
      today: [],
      yesterday: [],
      last7Days: [],
      older: [],
    };

    filteredConversations.forEach((c) => {
      const cDate = new Date(c.updatedAt || c.createdAt);
      cDate.setHours(0, 0, 0, 0);

      if (cDate.getTime() === today.getTime()) {
        groups.today.push(c);
      } else if (cDate.getTime() === yesterday.getTime()) {
        groups.yesterday.push(c);
      } else if (cDate.getTime() >= sevenDaysAgo.getTime()) {
        groups.last7Days.push(c);
      } else {
        groups.older.push(c);
      }
    });

    return groups;
  }, [filteredConversations]);

  // Rename
  const handleStartRename = (conv: SavedConversation, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingTitleId(conv.id);
    setEditTitleText(conv.title);
  };

  const handleSaveRename = async (conv: SavedConversation) => {
    if (!editTitleText.trim()) return;
    const updated = { ...conv, title: editTitleText.trim(), updatedAt: new Date().toISOString() };
    await conversationRepository.saveOrUpdateConversation(updated);
    setEditingTitleId(null);
    if (selectedConv?.id === conv.id) {
      setSelectedConv(updated);
    }
    showToast('Titolo aggiornato');
    loadData();
  };

  // Single delete
  const handleDeleteSingle = async (id: string) => {
    await conversationRepository.deleteConversation(id);
    setDeleteConfirmId(null);
    if (selectedConv?.id === id) {
      setSelectedConv(null);
    }
    showToast('Sessione eliminata');
    loadData();
  };

  // Resume session
  const handleResume = (conv: SavedConversation) => {
    const recentMessages = conv.messages.slice(-10);
    let totalChars = 0;
    const filteredContext: ChatMessage[] = [];

    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const m = recentMessages[i];
      if (totalChars + m.text.length > 6000) break;
      totalChars += m.text.length;
      filteredContext.unshift({
        id: `msg-resumed-${Date.now()}-${i}`,
        sender: m.role === 'user' ? 'user' : 'coach',
        text: m.text,
        timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    onResumeConversation(filteredContext, conv.title);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Breve';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const getLanguageBadge = (messages: SavedMessage[]) => {
    let hasIt = false;
    let hasEn = false;
    for (const m of messages) {
      const lang = m.detectedLanguage || detectTextLanguage(m.text);
      if (lang === 'it') hasIt = true;
      if (lang === 'en') hasEn = true;
      if (lang === 'mixed') {
        hasIt = true;
        hasEn = true;
      }
    }
    if (hasIt && hasEn) return { label: 'IT / EN', bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
    if (hasIt) return { label: 'IT', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    return { label: 'EN', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };
  };

  const exportAsTXT = (conv: SavedConversation) => {
    const slugTitle = conv.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const dateValue = conv.createdAt || conv.date || conv.startedAt || new Date().toISOString();
    const dateStr = new Date(dateValue).toISOString().split('T')[0];
    const filename = `english-coach-${dateStr}-${slugTitle || 'sessione'}.txt`;

    let content = `==================================================\n`;
    content += `ENGLISH COACH - SESSIONE SALVATA\n`;
    content += `Titolo: ${conv.title}\n`;
    content += `Data: ${new Date(dateValue).toLocaleString('it-IT')}\n`;
    content += `Durata: ${formatDuration(conv.durationSeconds)}\n`;
    content += `==================================================\n\n`;

    conv.messages.forEach((m) => {
      const msgTime = m.createdAt || m.timestamp || new Date().toISOString();
      const time = new Date(msgTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const sender = m.role === 'user' || m.sender === 'user' ? 'UTENTE' : 'COACH';
      content += `[${time}] ${sender}:\n${m.text}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Esportato ${filename}`);
  };

  const exportAsJSON = (conv: SavedConversation) => {
    const slugTitle = conv.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const dateValue = conv.createdAt || conv.date || conv.startedAt || new Date().toISOString();
    const dateStr = new Date(dateValue).toISOString().split('T')[0];
    const filename = `english-coach-${dateStr}-${slugTitle || 'sessione'}.json`;

    const blob = new Blob([JSON.stringify(conv, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Esportato ${filename}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 text-slate-100 space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-xl flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Section Header */}
      <SectionHeader
        icon={<History className="w-6 h-6 text-amber-400" />}
        title="Le tue sessioni"
        description="Rileggi le conversazioni, riprendi un'attività o esporta ciò che hai imparato."
        action={
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca nelle sessioni..."
              className="w-full bg-slate-900/80 text-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        }
      />

      {/* Main Grid View */}
      {conversations.length === 0 ? (
        <EmptyState
          icon={<History className="w-6 h-6 text-amber-400" />}
          title="Nessuna sessione salvata"
          description="Avvia una conversazione con il coach per creare la prima."
          action={{
            label: 'Vai allo Studio',
            onClick: onGoToStudio,
            icon: <Mic className="w-4 h-4" />,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Grouped Session Cards */}
          <div className={`${selectedConv ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-5`}>
            {[
              { label: 'Oggi', items: groupedConversations.today },
              { label: 'Ieri', items: groupedConversations.yesterday },
              { label: 'Ultimi 7 Giorni', items: groupedConversations.last7Days },
              { label: 'Mesi Precedenti', items: groupedConversations.older },
            ].map(
              (group) =>
                group.items.length > 0 && (
                  <div key={group.label} className="space-y-2">
                    <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 px-1 flex items-center justify-between">
                      <span>{group.label}</span>
                      <span className="text-slate-500">{group.items.length} sessioni</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                      {group.items.map((conv) => {
                        const isSelected = selectedConv?.id === conv.id;
                        const langBadge = getLanguageBadge(conv.messages);

                        const menuItems: MenuItem[] = [
                          {
                            label: 'Rinomina',
                            icon: <Edit3 className="w-3.5 h-3.5" />,
                            onClick: () => handleStartRename(conv),
                          },
                          {
                            label: 'Esporta',
                            icon: <Download className="w-3.5 h-3.5" />,
                            onClick: () => setExportModalConv(conv),
                          },
                          {
                            label: 'Elimina',
                            icon: <Trash2 className="w-3.5 h-3.5" />,
                            danger: true,
                            onClick: () => setDeleteConfirmId(conv.id),
                          },
                        ];

                        return (
                          <div
                            key={conv.id}
                            onClick={() => setSelectedConv(conv)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/50 text-slate-100 shadow-md'
                                : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2 min-w-0">
                              {editingTitleId === conv.id ? (
                                <div
                                  className="flex items-center gap-1.5 flex-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="text"
                                    value={editTitleText}
                                    onChange={(e) => setEditTitleText(e.target.value)}
                                    className="bg-slate-950 border border-amber-500 text-white text-xs px-2 py-1 rounded-lg w-full"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveRename(conv)}
                                    className="p-1 bg-emerald-500 text-slate-950 rounded-lg"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <h4 className="font-bold text-xs sm:text-sm text-slate-100 truncate flex-1">
                                  {conv.title}
                                </h4>
                              )}

                              <ContextMenu items={menuItems} />
                            </div>

                            {/* Details & Badges */}
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <div className="flex items-center gap-2">
                                <span>{formatDuration(conv.durationSeconds)}</span>
                                <span>•</span>
                                <span>{conv.messages.length} msg</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${langBadge.bg}`}
                                >
                                  {langBadge.label}
                                </span>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResume(conv);
                                  }}
                                  className="p-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                  title="Riprendi"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Riprendi</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
            )}
          </div>

          {/* Right Column: Selected Session Detail / Reader */}
          {selectedConv && (
            <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col h-[600px] overflow-hidden">
              {/* Header */}
              <div className="p-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <button
                    onClick={() => setSelectedConv(null)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-white truncate">
                      {selectedConv.title}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {new Date(selectedConv.createdAt).toLocaleString('it-IT')} • {formatDuration(selectedConv.durationSeconds)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleResume(selectedConv)}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Riprendi</span>
                  </button>

                  <button
                    onClick={() => setExportModalConv(selectedConv)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Esporta"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Transcript */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/40">
                {selectedConv.messages.map((m) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        isUser ? 'items-end' : 'items-start'
                      } max-w-[85%] ${isUser ? 'ml-auto' : 'mr-auto'}`}
                    >
                      <span className="text-[10px] text-slate-500 mb-0.5 px-1">
                        {isUser ? 'Utente' : 'Coach'}
                      </span>
                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isUser
                            ? 'bg-slate-800 text-slate-100 rounded-tr-none border border-slate-700'
                            : 'bg-amber-500/10 text-amber-100 rounded-tl-none border border-amber-500/20'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Single Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDeleteSingle(deleteConfirmId)}
        title="Eliminare questa sessione?"
        description="La conversazione e la trascrizione verranno rimosse dallo storico locale."
        confirmLabel="Elimina"
        isDangerous={true}
      />

      {/* Export Options Modal */}
      {exportModalConv && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-amber-400" />
                <span>Esporta sessione</span>
              </h3>
              <button
                onClick={() => setExportModalConv(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  exportAsTXT(exportModalConv);
                  setExportModalConv(null);
                }}
                className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer flex items-center gap-3"
              >
                <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="font-bold text-xs text-white">Esporta come TXT</div>
                  <div className="text-[10px] text-slate-400">Testo semplice leggibile</div>
                </div>
              </button>

              <button
                onClick={() => {
                  exportAsJSON(exportModalConv);
                  setExportModalConv(null);
                }}
                className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer flex items-center gap-3"
              >
                <FileJson className="w-5 h-5 text-sky-400 shrink-0" />
                <div>
                  <div className="font-bold text-xs text-white">Esporta come JSON</div>
                  <div className="text-[10px] text-slate-400">Struttura dati re-importabile</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
