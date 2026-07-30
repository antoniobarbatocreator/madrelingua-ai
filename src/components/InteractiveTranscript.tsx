import React from 'react';

interface InteractiveTranscriptProps {
  text: string;
  fullSentence: string;
  messageId: string;
  onSelectWord: (selectedWord: string, sentence: string, messageId: string) => void;
  disabled?: boolean;
}

export const InteractiveTranscript: React.FC<InteractiveTranscriptProps> = ({
  text,
  fullSentence,
  messageId,
  onSelectWord,
  disabled = false,
}) => {
  if (!text || typeof text !== 'string') return null;

  // Tokenize text into words and non-words (punctuation, spaces, line breaks)
  // Matching letters, numbers, apostrophes, hyphens
  const tokens = text.split(/([a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?)/g);

  return (
    <span className="leading-relaxed">
      {tokens.map((token, idx) => {
        const isWord = /[a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?/.test(token);

        if (!isWord || disabled) {
          return <span key={idx}>{token}</span>;
        }

        const handleWordClick = (e: React.MouseEvent | React.TouchEvent) => {
          e.stopPropagation();
          // Clean clean word if needed
          const cleanWord = token.trim();
          if (cleanWord.length > 0) {
            onSelectWord(cleanWord, fullSentence || text, messageId);
          }
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onSelectWord(token.trim(), fullSentence || text, messageId);
          }
        };

        return (
          <span
            key={idx}
            role="button"
            tabIndex={0}
            onClick={handleWordClick}
            onKeyDown={handleKeyDown}
            className="inline-block rounded px-0.5 -mx-0.5 transition-colors cursor-pointer hover:bg-amber-400/20 hover:text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400/50 active:bg-amber-400/30"
            title={`Tocca per scoprire "${token}" no contesto`}
          >
            {token}
          </span>
        );
      })}
    </span>
  );
};
