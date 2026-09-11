import React from "react";
import { SavedSession, ACTIVITY_META } from "../types";
import { Trash2, Clock, MessageSquare } from "lucide-react";

interface HistoryScreenProps {
  sessions: SavedSession[];
  onDeleteSession: (id: string) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ sessions, onDeleteSession }) => {
  return (
    <div className="min-h-full pb-4">
      <div className="px-6 pt-10 pb-2">
        <h1 className="text-2xl font-bold text-primary tracking-tight">Cronologia</h1>
        <p className="text-sm text-muted mt-1">Le tue sessioni salvate.</p>
      </div>

      <div className="px-5 mt-4">
        {sessions.length === 0 ? (
          <div className="text-center py-20 animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-card border border-warm flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-[#C8BDB2]" />
            </div>
            <h3 className="font-semibold text-primary text-base">Nessuna sessione salvata</h3>
            <p className="text-xs text-muted mt-1.5 max-w-[220px] mx-auto leading-relaxed">
              Dopo una sessione, premi il tasto Salva per conservare la conversazione.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl bg-card border border-warm flex items-start gap-3 animate-fadeIn"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-primary text-sm leading-snug">{s.title}</div>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1 bg-warm px-2 py-0.5 rounded-md font-medium">
                      {ACTIVITY_META[s.activity]?.label || s.activity}
                    </span>
                    <span>{s.date}</span>
                    <span className="inline-flex items-center gap-0.5">
                      <MessageSquare className="w-3 h-3" />
                      {s.messages.length}
                    </span>
                    <span className="text-[#C8BDB2]">{s.level}</span>
                  </div>
                </div>
                <button
                  onClick={() => onDeleteSession(s.id)}
                  className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-[#C8BDB2] hover:text-red-400 transition-colors cursor-pointer shrink-0 mt-0.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
