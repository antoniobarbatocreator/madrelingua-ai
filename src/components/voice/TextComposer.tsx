import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface TextComposerProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const TextComposer: React.FC<TextComposerProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Scrivi un messaggio in inglese o italiano...',
}) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 bg-slate-950/80 backdrop-blur-xl border-t border-white/[0.04] flex items-end gap-2 shrink-0"
    >
      <div className="flex-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.1] focus:border-amber-500/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.06)] rounded-xl px-4 py-2.5 text-[13px] text-slate-100 placeholder-slate-600 resize-none outline-none transition-all"
        />
      </div>
      <button
        type="submit"
        disabled={!hasText || disabled}
        className={`min-h-[40px] min-w-[40px] rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
          hasText
            ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25'
            : 'bg-white/[0.04] text-slate-600 border border-white/[0.06]'
        }`}
        title="Invia messaggio"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  );
};
