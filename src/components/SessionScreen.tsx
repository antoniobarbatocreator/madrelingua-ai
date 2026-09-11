import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Activity,
  VoiceMode,
  EngineState,
  ChatMessage,
  ACTIVITY_META,
} from "../types";
import { VoiceEngine } from "../lib/voiceEngine";
import {
  ArrowLeft,
  Save,
  Mic,
  MicOff,
  Square,
  Send,
  Volume2,
  Loader2,
} from "lucide-react";

interface SessionScreenProps {
  activity: Activity;
  level: string;
  voiceName: string;
  voiceMode: VoiceMode;
  speechRate: number;
  onBack: () => void;
  onSave: (messages: ChatMessage[], activity: Activity) => void;
}

export const SessionScreen: React.FC<SessionScreenProps> = ({
  activity,
  level,
  voiceName,
  voiceMode,
  speechRate,
  onBack,
  onSave,
}) => {
  const [engineState, setEngineState] = useState<EngineState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveCoachText, setLiveCoachText] = useState("");
  const [liveUserText, setLiveUserText] = useState("");
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoiceEngine | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => {
    const engine = new VoiceEngine({
      onStateChange: setEngineState,
      onCoachTranscript: (text, isFinal) => {
        if (isFinal && text.trim()) {
          setMessages((prev) => [
            ...prev,
            { id: `c_${Date.now()}`, sender: "coach", text: text.trim(), timestamp: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) },
          ]);
          setLiveCoachText("");
        } else {
          setLiveCoachText(text);
        }
        scrollToBottom();
      },
      onUserTranscript: (text, isFinal) => {
        if (isFinal && text.trim()) {
          setMessages((prev) => [
            ...prev,
            { id: `u_${Date.now()}`, sender: "user", text: text.trim(), timestamp: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) },
          ]);
          setLiveUserText("");
        } else {
          setLiveUserText(text);
        }
        scrollToBottom();
      },
      onError: (msg) => {
        setError(msg);
        setTimeout(() => setError(null), 6000);
      },
      onSessionEnd: () => {},
      onMicLevel: (level) => {
        setMicLevel(level);
      },
    });

    engineRef.current = engine;
    engine.connect({ activity, level, voiceName, voiceMode, speechRate });

    return () => {
      engine.disconnect();
    };
  }, [activity, level, voiceName, voiceMode, speechRate, scrollToBottom]);

  const handleDisconnect = () => {
    engineRef.current?.disconnect();
    onBack();
  };

  const handleSave = () => {
    if (messages.length > 0) {
      onSave(messages, activity);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    engineRef.current?.sendText(textInput.trim());
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, sender: "user", text: textInput.trim(), timestamp: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) },
    ]);
    setTextInput("");
    scrollToBottom();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText(e);
    }
  };

  const handleInterrupt = () => {
    engineRef.current?.interruptCoach();
  };

  const handlePushToTalkToggle = () => {
    if (isRecording) {
      engineRef.current?.stopRecording();
      setIsRecording(false);
    } else {
      engineRef.current?.startRecording();
      setIsRecording(true);
    }
  };

  const isConnected = engineState !== "idle" && engineState !== "connecting";
  const isSpeaking = engineState === "speaking";
  const isListening = engineState === "listening";

  const meta = ACTIVITY_META[activity];

  return (
    <div className="h-app flex flex-col bg-warm">
      {/* Header */}
      <header className="bg-card/90 backdrop-blur-xl border-b-2 border-warm shrink-0 pt-safe">
        <div className="px-4 h-14 flex items-center justify-between gap-2">
          <button onClick={handleDisconnect} className="w-9 h-9 rounded-xl hover:bg-warm flex items-center justify-center cursor-pointer transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>

          <div className="flex-1 text-center min-w-0">
            <div className="font-bold text-primary text-sm truncate">{meta.label}</div>
            <div className="text-[10px] text-muted font-medium">{level}</div>
          </div>

          <button
            onClick={handleSave}
            disabled={messages.length === 0}
            className="w-9 h-9 rounded-xl hover:bg-[#FFF3E6] flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30"
          >
            <Save className="w-4.5 h-4.5 text-[#C2630B]" />
          </button>
        </div>
      </header>

      {/* Status indicator */}
      <div className="flex justify-center py-2 bg-card/50">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
          isSpeaking ? "bg-amber-100 text-amber-800" :
          isListening ? "bg-emerald-100 text-emerald-800" :
          engineState === "thinking" ? "bg-sky-100 text-sky-800" :
          engineState === "connecting" ? "bg-warm text-muted" :
          "bg-warm text-[#C8BDB2]"
        }`}>
          {engineState === "connecting" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isConnected ? (
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${
                isSpeaking ? "bg-amber-600" : isListening ? "bg-emerald-600" : "bg-sky-600"
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isSpeaking ? "bg-amber-600" : isListening ? "bg-emerald-600" : "bg-sky-600"
              }`} />
            </span>
          ) : null}
          <span>
            {engineState === "connecting" ? "Connessione..." :
             isSpeaking ? "Coach sta parlando" :
             isListening ? "In ascolto" :
             engineState === "thinking" ? "Elaborazione..." :
             "Disconnesso"}
          </span>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="mx-4 mt-1 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-fadeIn">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 && !liveCoachText && !liveUserText && (
          <div className="text-center py-16 animate-fadeIn">
            <h3 className="font-bold text-primary text-base">{meta.label}</h3>
            <p className="text-xs text-muted mt-1.5 max-w-[240px] mx-auto leading-relaxed">
              {meta.description}
            </p>
            <p className="text-[11px] text-[#C8BDB2] mt-6">
              {engineState === "connecting" ? "Connessione in corso..." : "Il coach sta per salutarti..."}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"} animate-fadeIn`}>
            <div className="flex items-center gap-1.5 text-[10px] px-1 mb-1">
              <span className={`font-semibold ${msg.sender === "user" ? "text-[#C2630B]" : "text-muted"}`}>
                {msg.sender === "user" ? "Tu" : "Coach"}
              </span>
              <span className="text-[#C8BDB2]">{msg.timestamp}</span>
            </div>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.sender === "user"
                ? "bg-[#C2630B] text-white rounded-tr-sm"
                : "bg-card border border-warm text-primary rounded-tl-sm shadow-sm"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {liveCoachText && (
          <div className="flex flex-col items-start animate-fadeIn">
            <div className="flex items-center gap-1.5 text-[10px] px-1 mb-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600" />
              </span>
              <span className="font-semibold text-muted">Coach</span>
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 bg-card border border-warm text-primary text-sm leading-relaxed shadow-sm">
              {liveCoachText}
            </div>
          </div>
        )}

        {liveUserText && (
          <div className="flex flex-col items-end animate-fadeIn">
            <div className="flex items-center gap-1.5 text-[10px] px-1 mb-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="font-semibold text-[#C2630B]">Tu</span>
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 bg-[#C2630B] text-white text-sm leading-relaxed italic">
              {liveUserText}
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Bottom controls */}
      <div className="bg-card/90 backdrop-blur-xl border-t-2 border-warm shrink-0 pb-safe">
        <div className="flex items-center justify-center gap-3 py-3 px-4">
          {isSpeaking && (
            <button
              onClick={handleInterrupt}
              className="h-11 px-5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer animate-scaleIn"
            >
              <Volume2 className="w-4 h-4" />
              Interrompi
            </button>
          )}

          {voiceMode === "push_to_talk" && isConnected && !isSpeaking && (
            <>
              <button
                onClick={handlePushToTalkToggle}
                className={`h-14 w-14 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-lg ${
                  isRecording
                    ? "bg-red-500 text-white shadow-red-500/25 animate-pulse"
                    : "bg-[#C2630B] text-white shadow-[#C2630B]/20 hover:shadow-[#C2630B]/30"
                }`}
              >
                {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-6 h-6" />}
              </button>
              <span className="text-xs text-muted font-medium">
                {isRecording ? "Registrando... premi per inviare" : "Premi per parlare"}
              </span>
            </>
          )}

          {voiceMode === "free" && isConnected && !isSpeaking && (
            <div className="flex items-center gap-3">
              <div className="relative">
                {isListening && micLevel > 0.002 && (
                  <div
                    className="absolute inset-[-4px] rounded-full bg-emerald-400/40 transition-transform"
                    style={{
                      transform: `scale(${1 + Math.min(micLevel * 15, 0.6)})`,
                      opacity: Math.min(micLevel * 20, 0.6),
                    }}
                  />
                )}
                <div className={`relative h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
                  isListening ? "bg-emerald-600 shadow-lg shadow-emerald-600/20" : "bg-[#C8BDB2]"
                }`}>
                  {isListening ? (
                    <Mic className="w-5 h-5 text-white" />
                  ) : (
                    <MicOff className="w-5 h-5 text-white/70" />
                  )}
                </div>
              </div>
              <span className={`text-xs font-medium ${isListening ? "text-emerald-700" : "text-muted"}`}>
                {isListening ? "Microfono attivo" : "In attesa..."}
              </span>
            </div>
          )}

          {engineState === "connecting" && (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-warm flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-muted animate-spin" />
              </div>
              <span className="text-xs text-muted font-medium">Connessione...</span>
            </div>
          )}
        </div>

        <div className="px-4 pb-3">
          <form onSubmit={handleSendText} className="flex items-end gap-2">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi un messaggio..."
              rows={1}
              className="flex-1 bg-warm border border-warm focus:border-[#C2630B] focus:bg-card focus:shadow-[0_0_0_3px_rgba(194,99,11,0.08)] rounded-xl px-4 py-2.5 text-sm text-primary placeholder-[#C8BDB2] resize-none outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                textInput.trim()
                  ? "bg-[#C2630B] text-white shadow-md shadow-[#C2630B]/15"
                  : "bg-warm text-[#C8BDB2]"
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
