import React from 'react';
import { ChatMessage } from '../../types';
import { InteractiveTranscript } from '../InteractiveTranscript';
import { Volume2, Loader2, Sparkles, AlertCircle } from 'lucide-react';

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
    <div
      className={`flex flex-col space-y-1.5 my-2 animate-fadeIn ${
        isUser ? 'items-end' : 'items-start'
      }`}
    >
      {/* Sender Header */}
      <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-400 px-1">
        <span className={isUser ? 'text-amber-400' : 'text-amber-300'}>
          {isUser ? 'Tu' : 'Madrelingua Coach'}
        </span>
        <span className="text-[10px] text-slate-500 font-normal">{msg.timestamp}</span>
      </div>

      {/* Main Bubble Content */}
      <div
        className={`max-w-[88%] sm:max-w-2xl rounded-2xl p-3.5 sm:p-4.5 shadow-md relative group transition-all ${
          isUser
            ? 'bg-amber-500 text-slate-950 rounded-tr-none font-medium border border-amber-400/30'
            : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none space-y-2'
        }`}
      >
        {isUser ? (
          <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
            {msg.text}
          </div>
        ) : (
          <InteractiveTranscript
            text={msg.text}
            messageId={msg.id}
            onSelectWord={onSelectWord}
          />
        )}

        {/* Audio Re-play Control for Coach */}
        {!isUser && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
            <button
              onClick={() => onSpeakMessage(msg.text, msg.id)}
              disabled={activePlayingMsgId === msg.id}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-amber-400 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Ascolta pronuncia madrelingua"
            >
              {activePlayingMsgId === msg.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
              <span className="text-[11px]">Ascolta</span>
            </button>

            {msg.pronunciationTip && (
              <span className="text-[10px] text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 truncate max-w-[200px]">
                💡 {msg.pronunciationTip}
              </span>
            )}
          </div>
        )}
      </div>

      {/* In-context Correction Box */}
      {msg.correction && msg.correction.hasMistake && (
        <div className="max-w-[88%] sm:max-w-2xl mt-1.5 p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-1.5 animate-slideUp">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Suggerimento di naturalezza</span>
          </div>

          {msg.correction.originalText && (
            <div className="text-slate-400 line-through text-[11px]">
              "{msg.correction.originalText}"
            </div>
          )}

          {msg.correction.correctedTextEnglishPhrase && (
            <div className="font-bold text-emerald-300 text-sm">
              ➔ "{msg.correction.correctedTextEnglishPhrase}"
            </div>
          )}

          {msg.correction.correctedTextItalianExplanation && (
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {msg.correction.correctedTextItalianExplanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
