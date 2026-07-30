import React, { useState, useEffect } from 'react';
import {
  PersonalVocabularyItem,
  personalVocabularyRepository,
} from '../lib/personalVocabularyRepository';
import {
  Search,
  BookOpen,
  Filter,
  Download,
  Upload,
  Trash2,
  Edit,
  X,
  Volume2,
  CheckCircle2,
  Sparkles,
  ArrowUpDown,
  Mic,
  ChevronRight,
  Save,
  Check,
  RotateCcw,
} from 'lucide-react';
import { FilterSheet } from './common/FilterSheet';
import { ContextMenu, MenuItem } from './common/ContextMenu';
import { ConfirmDialog } from './common/ConfirmDialog';
import { EmptyState } from './common/EmptyState';
import { SkeletonList } from './common/SkeletonList';

interface PersonalVocabularyViewProps {
  onGoToStudio?: () => void;
  voiceSettings?: any;
}

export const PersonalVocabularyView: React.FC<PersonalVocabularyViewProps> = ({
  onGoToStudio,
  voiceSettings,
}) => {
  const [items, setItems] = useState<PersonalVocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [masteryFilter, setMasteryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'alpha' | 'occurrences'>('newest');

  // Mobile Filter Sheet state
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Selected item detail modal / editor
  const [selectedItem, setSelectedItem] = useState<PersonalVocabularyItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PersonalVocabularyItem>>({});

  // Item to delete
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Audio preview playing state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Notice toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await personalVocabularyRepository.getAllItems();
      setItems(data);
    } catch (e) {
      console.error('Failed to load vocabulary items:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Play pronunciation via API
  const handlePlayAudio = async (text: string, itemId: string) => {
    if (playingAudioId) return;
    setPlayingAudioId(itemId);
    try {
      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceName: voiceSettings?.voiceName || 'Achird',
          text,
        }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const buffer = audioCtx.createBuffer(1, bytes.length / 2, 24000);
        const channelData = buffer.getChannelData(0);
        const dataView = new DataView(bytes.buffer);
        for (let i = 0; i < bytes.length / 2; i++) {
          channelData[i] = dataView.getInt16(i * 2, true) / 32768;
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.onended = () => setPlayingAudioId(null);
        source.start();
      } else {
        setPlayingAudioId(null);
      }
    } catch (e) {
      console.error('Audio play error:', e);
      setPlayingAudioId(null);
    }
  };

  // Export handlers
  const handleExportJson = async () => {
    const jsonStr = await personalVocabularyRepository.exportVocabularyJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocabolario_personale_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('Esportazione JSON completata!');
  };

  const handleExportCsv = async () => {
    const csvStr = await personalVocabularyRepository.exportVocabularyCsv();
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocabolario_personale_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast('Esportazione CSV completata!');
  };

  // Import JSON file
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (Array.isArray(json)) {
          const res = await personalVocabularyRepository.importVocabulary(json);
          showToast(`Importati ${res.added} nuovi vocaboli (${res.updated} aggiornati).`);
          loadItems();
        } else {
          alert('Il file deve contenere un array JSON di elementi.');
        }
      } catch (err) {
        alert('Errore nel formato del file JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Delete item
  const handleDeleteItem = async (id: string) => {
    await personalVocabularyRepository.deleteItem(id);
    setSelectedItem(null);
    setItemToDelete(null);
    showToast('Elemento eliminato.');
    loadItems();
  };

  // Save edits
  const handleSaveEdits = async () => {
    if (!selectedItem) return;
    const updated = await personalVocabularyRepository.updateItem(selectedItem.id, editForm);
    setSelectedItem(updated);
    setIsEditing(false);
    showToast('Vocabolo aggiornato con successo!');
    loadItems();
  };

  // Reset filters
  const resetFilters = () => {
    setTypeFilter('all');
    setMasteryFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = typeFilter !== 'all' || masteryFilter !== 'all' || !!searchQuery.trim();

  // Filter & Search Logic
  const filteredItems = items
    .filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (masteryFilter !== 'all' && item.mastery !== masteryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesExpr = (item.expression || '').toLowerCase().includes(q);
        const matchesTrans = (item.translationIt || '').toLowerCase().includes(q);
        const matchesTags = item.tags?.some((t) => (t || '').toLowerCase().includes(q)) || false;
        const matchesMeaning = item.contextualMeaningIt ? item.contextualMeaningIt.toLowerCase().includes(q) : false;
        return matchesExpr || matchesTrans || matchesTags || matchesMeaning;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
      } else if (sortBy === 'alpha') {
        return a.expression.localeCompare(b.expression);
      } else {
        return (b.occurrenceCount || 1) - (a.occurrenceCount || 1);
      }
    });

  // Calculate summary counts
  const toReviewCount = items.filter((i) => i.mastery === 'new' || i.mastery === 'learning').length;
  const familiarCount = items.filter((i) => i.mastery === 'familiar' || i.mastery === 'mastered').length;

  const getTypeBadgeStyle = (type?: string) => {
    switch (type) {
      case 'phrasal_verb':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'chunk':
      case 'collocation':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'idiom':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'word':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      default:
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    }
  };

  return (
    <div className="space-y-4 text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Compact Summary Header */}
      <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold text-sm text-white">{items.length}</span>
            <span className="text-slate-400">espressioni</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold text-sm text-amber-400">{toReviewCount}</span>
            <span className="text-slate-400">da ripassare</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold text-sm text-emerald-400">{familiarCount}</span>
            <span className="text-slate-400">familiari</span>
          </div>
        </div>

        {/* Discrete Secondary Action */}
        {onGoToStudio && (
          <button
            onClick={onGoToStudio}
            className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Torna allo Studio</span>
          </button>
        )}
      </div>

      {/* Toolbar / Search & Filters */}
      <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca un'espressione o traduzione..."
              className="w-full bg-slate-950 text-slate-200 text-xs rounded-xl pl-8 pr-8 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Desktop Filters Single Line */}
          <div className="hidden md:flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs px-2.5 py-2 rounded-xl border border-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Tutte le tipologie</option>
              <option value="word">Singole Parole</option>
              <option value="phrasal_verb">Phrasal Verbs</option>
              <option value="chunk">Chunks / Espressioni</option>
              <option value="idiom">Modi di Dire</option>
            </select>

            <select
              value={masteryFilter}
              onChange={(e) => setMasteryFilter(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs px-2.5 py-2 rounded-xl border border-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Tutti i livelli</option>
              <option value="new">Da ripassare</option>
              <option value="learning">In apprendimento</option>
              <option value="familiar">Familiari</option>
              <option value="mastered">Memorizzati</option>
            </select>

            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs px-2.5 py-2 rounded-xl border border-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="newest">Più recenti</option>
              <option value="alpha">A - Z</option>
              <option value="occurrences">Frequenza</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-amber-400 hover:underline px-2 cursor-pointer font-medium"
              >
                Rimuovi filtri
              </button>
            )}
          </div>

          {/* Mobile Filter Button opening Bottom Sheet */}
          <div className="flex md:hidden items-center justify-between gap-2">
            <button
              onClick={() => setShowFilterSheet(true)}
              className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                hasActiveFilters
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtri e Ordinamento</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-3 py-1.5 text-xs text-amber-400 hover:underline font-medium cursor-pointer shrink-0"
              >
                Rimuovi
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Sheet */}
      <FilterSheet
        isOpen={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
        groups={[
          {
            id: 'type',
            label: 'Tipologia',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: 'all', label: 'Tutte' },
              { value: 'word', label: 'Singole parole' },
              { value: 'phrasal_verb', label: 'Phrasal verbs' },
              { value: 'chunk', label: 'Chunks' },
              { value: 'idiom', label: 'Modi di dire' },
            ],
          },
          {
            id: 'mastery',
            label: 'Padronanza',
            value: masteryFilter,
            onChange: setMasteryFilter,
            options: [
              { value: 'all', label: 'Tutti' },
              { value: 'new', label: 'Nuovi' },
              { value: 'learning', label: 'In apprendimento' },
              { value: 'familiar', label: 'Familiari' },
              { value: 'mastered', label: 'Memorizzati' },
            ],
          },
          {
            id: 'sort',
            label: 'Ordinamento',
            value: sortBy,
            onChange: (v: any) => setSortBy(v),
            options: [
              { value: 'newest', label: 'Più recenti' },
              { value: 'alpha', label: 'A - Z' },
              { value: 'occurrences', label: 'Più frequenti' },
            ],
          },
        ]}
      />

      {/* Vocabulary Items List (Compact Rows) */}
      {loading ? (
        <SkeletonList count={4} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-6 h-6 text-amber-400" />}
          title="Il tuo vocabolario è vuoto"
          description="Tocca una parola pronunciata dal coach durante una sessione per salvarla qui."
          action={
            onGoToStudio
              ? {
                  label: 'Vai allo Studio',
                  onClick: onGoToStudio,
                  icon: <Mic className="w-4 h-4" />,
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const menuItems: MenuItem[] = [
              {
                label: 'Modifica',
                icon: <Edit className="w-3.5 h-3.5" />,
                onClick: () => {
                  setSelectedItem(item);
                  setEditForm(item);
                  setIsEditing(true);
                },
              },
              {
                label: 'Elimina',
                icon: <Trash2 className="w-3.5 h-3.5" />,
                danger: true,
                onClick: () => setItemToDelete(item.id),
              },
            ];

            return (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedItem(item);
                  setEditForm(item);
                  setIsEditing(false);
                }}
                className="p-3 sm:p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-900 hover:border-amber-500/30 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayAudio(item.expression, item.id);
                    }}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-400 transition-colors shrink-0"
                    title="Ascolta pronuncia"
                  >
                    <Volume2
                      className={`w-4 h-4 ${
                        playingAudioId === item.id ? 'animate-bounce text-amber-400' : ''
                      }`}
                    />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-amber-300 truncate">
                        {item.expression}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 border ${getTypeBadgeStyle(
                          item.type
                        )}`}
                      >
                        {item.type}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-emerald-400 truncate mt-0.5">
                      {item.translationIt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {item.occurrenceCount > 1 && (
                    <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold text-[10px]">
                      {item.occurrenceCount}x
                    </span>
                  )}
                  <ContextMenu items={menuItems} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Item Detail / Editor Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-slate-100 animate-scaleUp">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${getTypeBadgeStyle(
                    selectedItem.type
                  )}`}
                >
                  {selectedItem.type}
                </span>
                <h3 className="text-lg font-bold text-white mt-1">{selectedItem.expression}</h3>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-1.5 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700 cursor-pointer"
                  title="Modifica"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Traduzione:</label>
                  <input
                    type="text"
                    value={editForm.translationIt || ''}
                    onChange={(e) => setEditForm({ ...editForm, translationIt: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Spiegazione:</label>
                  <textarea
                    rows={2}
                    value={editForm.contextualMeaningIt || ''}
                    onChange={(e) => setEditForm({ ...editForm, contextualMeaningIt: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                  />
                </div>

                <button
                  onClick={handleSaveEdits}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Modifiche</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Traduzione:</span>
                  <p className="text-sm font-bold text-emerald-400">{selectedItem.translationIt}</p>
                </div>

                {selectedItem.contextualMeaningIt && (
                  <p className="text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 leading-relaxed">
                    <strong className="text-amber-300 block mb-0.5">Spiegazione:</strong>
                    {selectedItem.contextualMeaningIt}
                  </p>
                )}

                {selectedItem.exampleEnglish && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Esempio:</span>
                    <p className="font-semibold text-amber-200">"{selectedItem.exampleEnglish}"</p>
                    {selectedItem.exampleItalian && (
                      <p className="text-slate-400">"{selectedItem.exampleItalian}"</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Item Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && handleDeleteItem(itemToDelete)}
        title="Eliminare dall'archivio?"
        description="Questa parola non sarà più visibile nel tuo vocabolario personale."
        confirmLabel="Elimina"
        isDangerous={true}
      />
    </div>
  );
};
