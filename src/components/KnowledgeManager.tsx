import React, { useState, useMemo } from 'react';
import { KnowledgeDocument } from '../types';
import {
  FileUp,
  BookOpen,
  Trash2,
  Plus,
  FileCheck,
  RefreshCw,
  AlertCircle,
  FileText,
  AlignLeft,
  Pencil,
  Eye,
  X,
  CheckCircle2,
  Sparkles,
  Info,
  FolderPlus,
} from 'lucide-react';
import { SectionHeader } from './common/SectionHeader';
import { EmptyState } from './common/EmptyState';
import { ContextMenu, MenuItem } from './common/ContextMenu';
import { ConfirmDialog } from './common/ConfirmDialog';

interface KnowledgeManagerProps {
  knowledgeDocs: KnowledgeDocument[];
  setKnowledgeDocs: React.Dispatch<React.SetStateAction<KnowledgeDocument[]>>;
  onTestPhraseInStudio?: (phrase: string) => void;
}

export const KnowledgeManager: React.FC<KnowledgeManagerProps> = ({
  knowledgeDocs,
  setKnowledgeDocs,
}) => {
  // UI Panels & Modals State
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Text Editor Modal State
  const [showTextModal, setShowTextModal] = useState(false);
  const [editingTextDocId, setEditingTextDocId] = useState<string | null>(null);
  const [textEditorContent, setTextEditorContent] = useState('');
  const [textEditorTitle, setTextEditorTitle] = useState('');

  // Source Detail / Preview Modal State
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);

  // Rename Modal State
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState('');

  // Delete Confirmation State
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  // Helper Functions
  const getDocType = (doc: KnowledgeDocument): 'pdf' | 'text' => {
    if (doc.type) return doc.type as 'pdf' | 'text';
    const name = doc.fileName || doc.title || '';
    return name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text';
  };

  const getDocRawText = (doc: KnowledgeDocument): string => {
    if (doc.rawText) return doc.rawText;
    if (doc.extractedText) return doc.extractedText;
    if (doc.content) return doc.content;
    // Migration fallback for legacy notes created with separate fields
    if (doc.extractedChunks && doc.extractedChunks.length > 0) {
      return doc.extractedChunks
        .map((c) => `${c.phrase} - ${c.translation}${c.context ? ` (${c.context})` : ''}`)
        .join('\n');
    }
    return '';
  };

  const getLineCount = (text: string): number => {
    if (!text) return 0;
    return text.split('\n').length;
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Currently viewing document object
  const viewingDoc = useMemo(
    () => knowledgeDocs.find((d) => d.id === viewingDocId) || null,
    [knowledgeDocs, viewingDocId]
  );

  // PDF File Upload / Replace Handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setUploadError('Carica un file in formato PDF.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('pdfFile', file);

    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Errore durante il caricamento del file PDF.');
      }

      const uploadedDoc: KnowledgeDocument = {
        ...data.document,
        type: 'pdf',
      };

      if (replacingDocId) {
        setKnowledgeDocs((prev) =>
          prev.map((d) => (d.id === replacingDocId ? { ...uploadedDoc, id: replacingDocId } : d))
        );
        setReplacingDocId(null);
      } else {
        setKnowledgeDocs((prev) => [uploadedDoc, ...prev]);
      }

      setShowUploadModal(false);
    } catch (err: any) {
      console.error('PDF Upload Error:', err);
      setUploadError(err.message || 'Errore nel caricamento del PDF.');
    } finally {
      setIsUploading(false);
    }
  };

  // Open Editor to Add New Free Text
  const handleOpenAddTextModal = () => {
    setShowAddMenu(false);
    setEditingTextDocId(null);
    setTextEditorTitle('');
    setTextEditorContent('');
    setShowTextModal(true);
  };

  // Open Editor to Edit Existing Free Text
  const handleOpenEditTextModal = (doc: KnowledgeDocument) => {
    setEditingTextDocId(doc.id);
    setTextEditorTitle(doc.fileName || doc.title || '');
    setTextEditorContent(getDocRawText(doc));
    setShowTextModal(true);
  };

  // Save Free Text (Create or Edit)
  const handleSaveTextNote = (e: React.FormEvent) => {
    e.preventDefault();
    const content = textEditorContent.trim();
    if (!content) return;

    // Auto-generate title from first non-empty line (max 50 chars) or fallback
    let autoTitle = textEditorTitle.trim();
    if (!autoTitle) {
      const firstLine = content.split('\n').find((l) => l.trim().length > 0)?.trim() || '';
      if (firstLine) {
        autoTitle = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
      } else {
        autoTitle = `Nota del ${new Date().toLocaleDateString('it-IT')}`;
      }
    }

    const now = new Date().toISOString();
    const textSizeBytes = new Blob([content]).size;

    if (editingTextDocId) {
      // Update existing document
      setKnowledgeDocs((prev) =>
        prev.map((doc) => {
          if (doc.id === editingTextDocId) {
            return {
              ...doc,
              fileName: autoTitle,
              fileSize: textSizeBytes,
              updatedAt: now,
              rawText: content,
              extractedText: content,
              type: 'text',
              indexingStatus: 'ready',
            };
          }
          return doc;
        })
      );
    } else {
      // Create new document
      const newDoc: KnowledgeDocument = {
        id: `doc-text-${Date.now()}`,
        fileName: autoTitle,
        fileSize: textSizeBytes,
        uploadedAt: now,
        updatedAt: now,
        rawText: content,
        extractedText: content,
        type: 'text',
        vocabularyCount: 0,
        indexedItemCount: 0,
        indexingStatus: 'ready',
        extractedChunks: [],
      };
      setKnowledgeDocs((prev) => [newDoc, ...prev]);
    }

    setShowTextModal(false);
    setTextEditorContent('');
    setTextEditorTitle('');
    setEditingTextDocId(null);
  };

  // Rename Document Handler
  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingDocId || !renameTitleInput.trim()) return;

    setKnowledgeDocs((prev) =>
      prev.map((doc) =>
        doc.id === renamingDocId
          ? { ...doc, fileName: renameTitleInput.trim(), updatedAt: new Date().toISOString() }
          : doc
      )
    );
    setRenamingDocId(null);
    setRenameTitleInput('');
  };

  // Delete Document Handler
  const handleDeleteDoc = (docId: string) => {
    setKnowledgeDocs((prev) => prev.filter((d) => d.id !== docId));
    if (viewingDocId === docId) setViewingDocId(null);
    setDocToDelete(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 text-slate-100 space-y-6">
      {/* Page Header */}
      <SectionHeader
        icon={<BookOpen className="w-6 h-6 text-amber-400" />}
        title="I tuoi materiali"
        description="Aggiungi PDF, vocaboli e appunti che il coach potrà utilizzare durante le sessioni."
        action={
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Aggiungi materiale</span>
            </button>

            {/* Dropdown Menu */}
            {showAddMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-30 animate-fadeIn">
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    setReplacingDocId(null);
                    setUploadError(null);
                    setShowUploadModal(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                >
                  <FileUp className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Carica PDF</span>
                </button>
                <button
                  onClick={handleOpenAddTextModal}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer border-t border-slate-800/60"
                >
                  <AlignLeft className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Aggiungi testo</span>
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* Main Sources List / Empty State */}
      {knowledgeDocs.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-6 h-6 text-amber-400" />}
          title="Nessun materiale disponibile"
          description="Aggiungi PDF o testi per arricchire la conoscenza del coach."
          action={{
            label: 'Aggiungi materiale',
            onClick: () => setShowAddMenu(true),
            icon: <Plus className="w-4 h-4" />,
          }}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">
            <span>Elenco fonti disponibili per il coach ({knowledgeDocs.length})</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {knowledgeDocs.map((doc) => {
              const docType = getDocType(doc);
              const rawText = getDocRawText(doc);
              const lines = getLineCount(rawText);

              const menuItems: MenuItem[] =
                docType === 'text'
                  ? [
                      {
                        label: 'Apri',
                        icon: <Eye className="w-3.5 h-3.5" />,
                        onClick: () => setViewingDocId(doc.id),
                      },
                      {
                        label: 'Modifica',
                        icon: <Pencil className="w-3.5 h-3.5" />,
                        onClick: () => handleOpenEditTextModal(doc),
                      },
                      {
                        label: 'Rinomina',
                        icon: <Pencil className="w-3.5 h-3.5" />,
                        onClick: () => {
                          setRenamingDocId(doc.id);
                          setRenameTitleInput(doc.fileName || doc.title || '');
                        },
                      },
                      {
                        label: 'Elimina',
                        icon: <Trash2 className="w-3.5 h-3.5" />,
                        danger: true,
                        onClick: () => setDocToDelete(doc.id),
                      },
                    ]
                  : [
                      {
                        label: 'Visualizza informazioni',
                        icon: <Eye className="w-3.5 h-3.5" />,
                        onClick: () => setViewingDocId(doc.id),
                      },
                      {
                        label: 'Sostituisci',
                        icon: <FileUp className="w-3.5 h-3.5" />,
                        onClick: () => {
                          setReplacingDocId(doc.id);
                          setUploadError(null);
                          setShowUploadModal(true);
                        },
                      },
                      {
                        label: 'Rinomina',
                        icon: <Pencil className="w-3.5 h-3.5" />,
                        onClick: () => {
                          setRenamingDocId(doc.id);
                          setRenameTitleInput(doc.fileName || doc.title || '');
                        },
                      },
                      {
                        label: 'Elimina',
                        icon: <Trash2 className="w-3.5 h-3.5" />,
                        danger: true,
                        onClick: () => setDocToDelete(doc.id),
                      },
                    ];

              return (
                <div
                  key={doc.id}
                  onClick={() => setViewingDocId(doc.id)}
                  className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl border shrink-0 ${
                        docType === 'pdf'
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      }`}
                    >
                      {docType === 'pdf' ? (
                        <FileText className="w-5 h-5" />
                      ) : (
                        <AlignLeft className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-100 truncate group-hover:text-amber-300 transition-colors">
                          {doc.fileName || doc.title || 'Materiale'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border shrink-0 ${
                            docType === 'pdf'
                              ? 'bg-red-500/10 text-red-300 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          }`}
                        >
                          {docType === 'pdf' ? 'PDF' : 'Testo'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1">
                        {docType === 'pdf' ? (
                          <span>Dimensione: {formatFileSize(doc.fileSize)}</span>
                        ) : (
                          <span>
                            {lines} {lines === 1 ? 'riga' : 'righe'} • {rawText.length.toLocaleString('it-IT')} caratteri
                          </span>
                        )}
                        <span>•</span>
                        <span>Modificato: {formatDate(doc.updatedAt || doc.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Pronto
                    </span>
                    <ContextMenu items={menuItems} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FREE TEXT EDITOR MODAL (Full-screen on Mobile / Centered on Desktop) */}
      {showTextModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col sm:items-center sm:justify-center sm:p-4 animate-fadeIn">
          <form
            onSubmit={handleSaveTextNote}
            className="w-full h-full sm:h-auto sm:max-w-2xl bg-slate-900 sm:border sm:border-slate-800 sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <div className="min-w-0 pr-3">
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {editingTextDocId ? 'Modifica testo nei materiali' : 'Aggiungi testo ai materiali'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Incolla vocaboli, frasi, traduzioni, regole o appunti. Il contenuto verrà conservato
                  integralmente e reso disponibile al coach.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTextModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-5 flex-1 flex flex-col space-y-3 overflow-y-auto bg-slate-950/50">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Titolo (Facoltativo - generato automaticamente se vuoto)
                </label>
                <input
                  type="text"
                  value={textEditorTitle}
                  onChange={(e) => setTextEditorTitle(e.target.value)}
                  placeholder="es. Appunti di grammatica - Modali"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex-1 flex flex-col min-h-[260px]">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contenuto del testo *
                </label>
                <textarea
                  required
                  spellCheck={false}
                  maxLength={50000}
                  value={textEditorContent}
                  onChange={(e) => setTextEditorContent(e.target.value)}
                  placeholder="Incolla o scrivi qui il testo libremente...&#10;&#10;Esempio:&#10;To unwind - Staccare la spina&#10;On the one hand - Da un lato&#10;May vs Might: May per possibilità reali, Might per possibilità più remote."
                  className="w-full flex-1 min-h-[220px] bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-amber-500/50 resize-y"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-1">
                  <span>Supporta italiano ed inglese</span>
                  <span>
                    {textEditorContent.length.toLocaleString('it-IT')} / 50.000 caratteri •{' '}
                    {getLineCount(textEditorContent)} righe
                  </span>
                </div>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-end gap-2 shrink-0 pb-safe">
              <button
                type="button"
                onClick={() => setShowTextModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={!textEditorContent.trim()}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold cursor-pointer transition-all shadow-md shadow-amber-500/10"
              >
                Salva nei materiali
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PDF UPLOAD / REPLACE MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <FileUp className="w-4 h-4 text-amber-400" />
                <span>{replacingDocId ? 'Sostituisci documento PDF' : 'Carica un documento PDF'}</span>
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setReplacingDocId(null);
                }}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 bg-slate-950 border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-xl text-center space-y-3 transition-colors">
              <FileText className="w-8 h-8 text-amber-400 mx-auto" />
              <div>
                <p className="text-xs font-semibold text-slate-200">Seleziona un file dal dispositivo.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Formato PDF (max 10MB)</p>
              </div>

              <label className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer transition-all shadow-md">
                <span>{isUploading ? 'Caricamento in corso...' : 'Sfoglia file'}</span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>

              {isUploading && (
                <div className="flex items-center justify-center gap-2 text-xs text-amber-400 pt-1">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Elaborazione PDF in corso...</span>
                </div>
              )}

              {uploadError && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SOURCE DETAIL / PREVIEW MODAL */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <div className="flex items-center space-x-3 min-w-0 pr-3">
                <div
                  className={`p-2 rounded-xl border shrink-0 ${
                    getDocType(viewingDoc) === 'pdf'
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}
                >
                  {getDocType(viewingDoc) === 'pdf' ? (
                    <FileText className="w-5 h-5" />
                  ) : (
                    <AlignLeft className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base text-white truncate">
                    {viewingDoc.fileName || viewingDoc.title || 'Materiale'}
                  </h3>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="uppercase font-extrabold text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {getDocType(viewingDoc) === 'pdf' ? 'PDF' : 'Testo'}
                    </span>
                    <span>•</span>
                    {getDocType(viewingDoc) === 'pdf' ? (
                      <span>{formatFileSize(viewingDoc.fileSize)}</span>
                    ) : (
                      <span>
                        {getLineCount(getDocRawText(viewingDoc))} righe •{' '}
                        {getDocRawText(viewingDoc).length.toLocaleString('it-IT')} caratteri
                      </span>
                    )}
                    <span>•</span>
                    <span>Caricato: {formatDate(viewingDoc.uploadedAt)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setViewingDocId(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 bg-slate-950/50">
              {getDocType(viewingDoc) === 'text' ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Contenuto integrale del testo:
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-slate-200 bg-slate-950 p-4 rounded-xl border border-slate-800/80 leading-relaxed select-text overflow-x-auto">
                    {getDocRawText(viewingDoc) || 'Nessun testo presente.'}
                  </pre>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                    <div className="font-semibold text-slate-200">Dettagli Documento PDF</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-400">
                      <div>Nome file: <span className="text-slate-200">{viewingDoc.fileName || viewingDoc.title || 'Materiale'}</span></div>
                      <div>Dimensione: <span className="text-slate-200">{formatFileSize(viewingDoc.fileSize)}</span></div>
                      <div>Stato: <span className="text-emerald-400 font-bold">Pronto / Disponibile</span></div>
                      <div>Data caricamento: <span className="text-slate-200">{formatDate(viewingDoc.uploadedAt)}</span></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Anteprima testo estratto dal PDF per il Coach:
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800/80 leading-relaxed max-h-72 overflow-y-auto select-text">
                      {viewingDoc.extractedText || 'Nessun testo leggibile estratto.'}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
              <button
                onClick={() => {
                  const id = viewingDoc.id;
                  setViewingDocId(null);
                  setDocToDelete(id);
                }}
                className="px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Elimina fonte</span>
              </button>

              <div className="flex items-center gap-2">
                {getDocType(viewingDoc) === 'text' && (
                  <button
                    onClick={() => {
                      const docToEdit = viewingDoc;
                      setViewingDocId(null);
                      handleOpenEditTextModal(docToEdit);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Modifica testo</span>
                  </button>
                )}
                {getDocType(viewingDoc) === 'pdf' && (
                  <button
                    onClick={() => {
                      const id = viewingDoc.id;
                      setViewingDocId(null);
                      setReplacingDocId(id);
                      setUploadError(null);
                      setShowUploadModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    <span>Sostituisci PDF</span>
                  </button>
                )}
                <button
                  onClick={() => setViewingDocId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renamingDocId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <form
            onSubmit={handleSaveRename}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scaleUp"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-400" />
                <span>Rinomina materiale</span>
              </h3>
              <button
                type="button"
                onClick={() => setRenamingDocId(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nuovo nome / titolo
              </label>
              <input
                type="text"
                required
                value={renameTitleInput}
                onChange={(e) => setRenameTitleInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingDocId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={!renameTitleInput.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Salva
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        onConfirm={() => docToDelete && handleDeleteDoc(docToDelete)}
        title="Eliminare questo materiale?"
        description="Il materiale e il suo contenuto verranno rimossi dalle fonti del coach."
        confirmLabel="Elimina"
        isDangerous={true}
      />
    </div>
  );
};
