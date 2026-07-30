import React, { useState } from 'react';
import { Send, CornerDownLeft } from 'lucide-react';

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

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0"
    >
      <div className="flex-1 relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 resize-none outline-none transition-all pr-8"
        />
      </div>

      <button
        type="submit"
        disabled={!text.trim() || disabled}
        className="min-h-[40px] min-w-[40px] px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-30 disabled:hover:bg-amber-500 text-slate-950 font-bold flex items-center justify-center transition-all cursor-pointer shadow-md"
        title="Invia messaggio"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  );
};
