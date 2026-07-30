import React from 'react';
import { ChatMessage } from '../../types';
import { InteractiveTranscript } from '../InteractiveTranscript';
import { Volume2, Loader2, AlertCircle } from 'lucide-react';

interface MessageBubbleProps {
  msg: ChatMessage;
  activePlayingMsgId: string | null;
  onSpeakMessage: (msgText: string, msgId: string) => void;
  onSelectWord: (word: string, sentence: string, messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  activePlayingMsgId,
  onSpeakMessage,
  onSelectWord,
}) => {
  const isUser = msg.sender === 'user';

  return (
    <div className={`flex flex-col space-y-1 my-2.5 animate-fadeIn ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Sender */}
      <div className="flex items-center gap-1.5 text-[11px] px-1">
        <span className={`font-semibold ${isUser ? 'text-amber-400/80' : 'text-slate-400'}`}>
          {isUser ? 'Tu' : 'Coach'}
        </span>
        <span className="text-[10px] text-slate-600">{msg.timestamp}</span>
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[85%] sm:max-w-xl rounded-2xl p-3.5 relative group transition-all ${
          isUser
            ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 rounded-tr-sm font-medium shadow-lg shadow-amber-500/10'
            : 'glass-card text-slate-100 rounded-tl-sm space-y-2'
        }`}
      >
        {isUser ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
        ) : (
          <InteractiveTranscript text={msg.text} messageId={msg.id} onSelectWord={onSelectWord} />
        )}

        {!isUser && (
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
            <button
              onClick={() => onSpeakMessage(msg.text, msg.id)}
              disabled={activePlayingMsgId === msg.id}
              className="min-h-[28px] px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-amber-400/80 font-medium flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              title="Ascolta pronuncia"
            >
              {activePlayingMsgId === msg.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
              <span className="text-[11px]">Ascolta</span>
            </button>

            {msg.pronunciationTip && (
              <span className="text-[10px] text-amber-300/70 bg-amber-500/8 px-2 py-0.5 rounded-lg border border-amber-500/10 truncate max-w-[200px]">
                {msg.pronunciationTip}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Correction */}
      {msg.correction && msg.correction.hasMistake && (
        <div className="max-w-[85%] sm:max-w-xl mt-1.5 p-3.5 rounded-xl bg-gradient-to-br from-amber-500/8 to-amber-600/3 border border-amber-500/15 text-xs space-y-2 animate-slideUp">
          <div className="flex items-center gap-1.5 font-bold text-amber-400/90">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Suggerimento</span>
          </div>

          {msg.correction.originalText && (
            <div className="text-slate-500 line-through text-[11px]">"{msg.correction.originalText}"</div>
          )}

          {msg.correction.correctedTextEnglishPhrase && (
            <div className="font-bold text-emerald-400 text-sm">"{msg.correction.correctedTextEnglishPhrase}"</div>
          )}

          {msg.correction.correctedTextItalianExplanation && (
            <p className="text-slate-400 leading-relaxed text-[11px]">{msg.correction.correctedTextItalianExplanation}</p>
          )}
        </div>
      )}
    </div>
  );
};
