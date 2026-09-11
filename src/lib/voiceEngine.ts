import { TimeStretcher } from "./timeStretch";

export type Activity = "conversazione" | "lezione" | "vocabolario" | "quiz" | "traduci" | "ripasso";
export type VoiceMode = "free" | "push_to_talk";
export type EngineState = "idle" | "connecting" | "listening" | "speaking" | "thinking";

/** A batch of the learner's own vocabulary, chosen by the app, not by the model. */
export interface SessionKnowledge {
  items: { phrase: string; translation: string; context?: string; category?: string }[];
  sourceName?: string;
  mode: "drill" | "conversation";
}

export interface VoiceEngineOptions {
  onStateChange: (state: EngineState) => void;
  onCoachTranscript: (text: string, isFinal: boolean) => void;
  onUserTranscript: (text: string, isFinal: boolean) => void;
  onError: (message: string) => void;
  onSessionEnd: () => void;
  onMicLevel?: (level: number) => void;
}

const WORKLET_CODE = `
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._chunkBuffer = [];
    this._chunkSize = 2048;
  }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this._chunkBuffer.push(ch[i]);
    }
    while (this._chunkBuffer.length >= this._chunkSize) {
      const chunk = new Float32Array(this._chunkBuffer.splice(0, this._chunkSize));
      this.port.postMessage({ samples: chunk }, [chunk.buffer]);
    }
    return true;
  }
}
registerProcessor('mic-capture', MicCaptureProcessor);
`;

export class VoiceEngine {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  // Fallback for browsers without AudioWorklet
  private micProcessor: ScriptProcessorNode | null = null;

  private outputCtx: AudioContext | null = null;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private nextPlayTime = 0;

  private state: EngineState = "idle";
  private options: VoiceEngineOptions;
  private voiceMode: VoiceMode = "free";
  private micEnabled = false;
  private teacherPlaybackActive = false;
  private currentTeacherTurnId: string | undefined;

  private coachTextAccumulator = "";
  private userTextAccumulator = "";

  private audioChunksSent = 0;
  private micLevel = 0;
  private isReconnecting = false;
  private stretcher = new TimeStretcher();
  private wakeLock: WakeLockSentinel | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor(options: VoiceEngineOptions) {
    this.options = options;
  }

  getState(): EngineState {
    return this.state;
  }

  getMicLevel(): number {
    return this.micLevel;
  }

  getAudioChunksSent(): number {
    return this.audioChunksSent;
  }

  private setState(s: EngineState) {
    this.state = s;
    this.options.onStateChange(s);
  }

  // ── Connect & start session ─────────────────────────────────
  async connect(config: {
    activity: Activity;
    level: string;
    voiceName: string;
    voiceMode: VoiceMode;
    speechRate?: number;
    knowledge?: SessionKnowledge;
  }) {
    this.voiceMode = config.voiceMode;
    if (config.speechRate) this.stretcher.setSpeed(config.speechRate);
    this.setState("connecting");

    try {
      await this.initMicrophone();
    } catch (err: any) {
      console.error("[MIC] Failed:", err);
      this.options.onError("Impossibile accedere al microfono. Controlla i permessi.");
      this.setState("idle");
      return;
    }

    this.outputCtx = new AudioContext({ sampleRate: 24000 });

    this.acquireWakeLock();
    this.setupVisibilityHandler();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/live-ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("[WS] Connected");
      this.ws!.send(JSON.stringify({
        type: "init",
        activity: config.activity,
        level: config.level,
        voiceName: config.voiceName,
        turnMode: config.voiceMode === "push_to_talk" ? "push_to_talk" : "free",
        knowledge: config.knowledge,
      }));
    };

    this.ws.onmessage = (ev) => this.handleServerMessage(ev);

    this.ws.onerror = () => {
      this.options.onError("Errore di connessione al server.");
      this.disconnect();
    };

    this.ws.onclose = () => {
      if (this.state !== "idle") {
        this.setState("idle");
        this.options.onSessionEnd();
      }
    };
  }

  // ── Disconnect ──────────────────────────────────────────────
  disconnect() {
    this.stopMicrophone();
    this.stopAudioPlayback();
    this.releaseWakeLock();
    this.removeVisibilityHandler();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "session_end" }));
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.outputCtx) {
      this.outputCtx.close().catch(() => {});
      this.outputCtx = null;
    }
    this.teacherPlaybackActive = false;
    this.micEnabled = false;
    this.setState("idle");
  }

  // ── Push-to-talk controls ───────────────────────────────────
  startRecording() {
    if (this.voiceMode !== "push_to_talk" || !this.ws) return;
    this.wsSend({ type: "activity_start" });
    this.micEnabled = true;
    this.stopAudioPlayback();
    this.setState("listening");
  }

  stopRecording() {
    if (this.voiceMode !== "push_to_talk" || !this.ws) return;
    this.micEnabled = false;
    this.wsSend({ type: "audio_stream_end" });
    this.wsSend({ type: "activity_end" });
    this.setState("thinking");
  }

  // ── Interrupt coach ─────────────────────────────────────────
  interruptCoach() {
    if (!this.teacherPlaybackActive && this.state !== "speaking") return;
    this.stopAudioPlayback();
    this.teacherPlaybackActive = false;
    this.wsSend({ type: "interrupt", teacherTurnId: this.currentTeacherTurnId });
    if (this.voiceMode === "free") {
      this.micEnabled = true;
      this.setState("listening");
    }
  }

  // ── Send text message ───────────────────────────────────────
  sendText(text: string) {
    if (!text.trim() || !this.ws) return;
    this.wsSend({ type: "text", text: text.trim() });
  }

  changeActivity(activity: Activity) {
    this.wsSend({ type: "change_activity", activity });
  }

  changeLevel(level: string) {
    this.wsSend({ type: "change_level", level });
  }

  /** 1 = natural pace, 0.8 = 20% slower. Pitch is preserved either way. */
  setSpeechRate(rate: number) {
    this.stretcher.setSpeed(rate);
  }

  setVoiceMode(mode: VoiceMode) {
    this.voiceMode = mode;
    if (mode === "push_to_talk") {
      this.micEnabled = false;
    } else if (this.state === "listening" || this.state === "thinking") {
      this.micEnabled = true;
    }
  }

  // ── Handle server messages ──────────────────────────────────
  private handleServerMessage(ev: MessageEvent) {
    let msg: any;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "connected":
        break;

      case "setup_complete":
        console.log("[ENGINE] Setup complete, enabling mic");
        this.micEnabled = true;
        this.setState("listening");
        this.audioCtx?.resume();
        break;

      case "teacher_turn_started":
        if (this.userTextAccumulator.trim()) {
          this.options.onUserTranscript(this.userTextAccumulator.trim(), true);
          this.userTextAccumulator = "";
        }
        this.teacherPlaybackActive = true;
        this.currentTeacherTurnId = msg.teacherTurnId;
        this.coachTextAccumulator = "";
        this.stretcher.reset();
        this.setState("speaking");
        break;

      case "audio":
        if (msg.teacherTurnId !== this.currentTeacherTurnId) return;
        this.playAudioChunk(msg.data);
        break;

      case "teacher_transcript":
        if (msg.teacherTurnId !== this.currentTeacherTurnId) return;
        this.coachTextAccumulator += msg.text;
        this.options.onCoachTranscript(this.coachTextAccumulator, false);
        break;

      case "user_transcript":
        this.userTextAccumulator += msg.text;
        this.options.onUserTranscript(this.userTextAccumulator, false);
        break;

      case "turn_complete":
        this.teacherPlaybackActive = false;
        this.currentTeacherTurnId = undefined;
        this.flushStretcher();
        if (this.coachTextAccumulator.trim()) {
          this.options.onCoachTranscript(this.coachTextAccumulator.trim(), true);
        }
        this.coachTextAccumulator = "";
        // User text should already be finalized in teacher_turn_started,
        // but handle any stragglers
        if (this.userTextAccumulator.trim()) {
          this.options.onUserTranscript(this.userTextAccumulator.trim(), true);
          this.userTextAccumulator = "";
        }
        this.schedulePostPlaybackTransition();
        break;

      case "interrupted":
        this.teacherPlaybackActive = false;
        this.currentTeacherTurnId = undefined;
        this.stopAudioPlayback();
        this.coachTextAccumulator = "";
        this.options.onCoachTranscript("", false);
        if (this.voiceMode === "free") {
          this.micEnabled = true;
          this.setState("listening");
        }
        break;

      case "reconnecting":
        this.isReconnecting = true;
        this.stopAudioPlayback();
        this.teacherPlaybackActive = false;
        this.setState("connecting");
        break;

      case "reconnected":
        this.isReconnecting = false;
        this.micEnabled = true;
        this.setState("listening");
        this.audioCtx?.resume();
        break;

      case "error":
        this.options.onError(msg.error || "Errore sconosciuto");
        break;

      case "session_closed":
        if (this.isReconnecting) return;
        this.disconnect();
        this.options.onSessionEnd();
        break;
    }
  }

  private schedulePostPlaybackTransition() {
    const startTime = Date.now();
    const MAX_WAIT = 15000;

    const check = () => {
      const elapsed = Date.now() - startTime;
      if (this.activeSourceNodes.length === 0 || elapsed > MAX_WAIT) {
        this.micEnabled = true;
        this.setState("listening");
        this.audioCtx?.resume();
        return;
      }
      setTimeout(check, 100);
    };
    check();
  }

  // ── Microphone ──────────────────────────────────────────────
  private async initMicrophone() {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Try 16kHz AudioContext (Chrome supports it; other browsers may fall back to native rate)
    try {
      this.audioCtx = new AudioContext({ sampleRate: 16000 });
    } catch {
      this.audioCtx = new AudioContext();
    }
    await this.audioCtx.resume();

    const actualRate = this.audioCtx.sampleRate;
    const needsResample = Math.abs(actualRate - 16000) > 100;
    const downsampleRatio = actualRate / 16000;

    console.log(`[MIC] rate=${actualRate} resample=${needsResample}`);

    this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);

    // Try AudioWorklet first (more reliable on mobile), fall back to ScriptProcessor
    const useWorklet = typeof AudioWorkletNode !== "undefined" && this.audioCtx.audioWorklet;

    if (useWorklet) {
      try {
        await this.initWithWorklet(needsResample, downsampleRatio);
        console.log("[MIC] Using AudioWorklet");
        return;
      } catch (err) {
        console.warn("[MIC] AudioWorklet failed, falling back to ScriptProcessor:", err);
      }
    }

    this.initWithScriptProcessor(needsResample, downsampleRatio);
    console.log("[MIC] Using ScriptProcessor");
  }

  private async initWithWorklet(needsResample: boolean, downsampleRatio: number) {
    const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    try {
      await this.audioCtx!.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    this.workletNode = new AudioWorkletNode(this.audioCtx!, "mic-capture");

    this.workletNode.port.onmessage = (e: MessageEvent) => {
      const rawSamples: Float32Array = e.data.samples;
      this.processAndSendAudio(rawSamples, needsResample, downsampleRatio);
    };

    this.micSource!.connect(this.workletNode);
    this.workletNode.connect(this.audioCtx!.destination);
  }

  private initWithScriptProcessor(needsResample: boolean, downsampleRatio: number) {
    this.micProcessor = this.audioCtx!.createScriptProcessor(4096, 1, 1);

    this.micProcessor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      this.processAndSendAudio(input, needsResample, downsampleRatio);
    };

    this.micSource!.connect(this.micProcessor);
    this.micProcessor.connect(this.audioCtx!.destination);
  }

  private processAndSendAudio(rawSamples: Float32Array, needsResample: boolean, downsampleRatio: number) {
    // Calculate mic level (RMS) for UI feedback
    let sum = 0;
    for (let i = 0; i < rawSamples.length; i++) sum += rawSamples[i] * rawSamples[i];
    this.micLevel = Math.sqrt(sum / rawSamples.length);
    this.options.onMicLevel?.(this.micLevel);

    if (!this.micEnabled || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const samples = needsResample ? this.downsample(rawSamples, downsampleRatio) : rawSamples;

    // Convert float32 to int16 PCM
    const pcm16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Encode as base64
    const bytes = new Uint8Array(pcm16.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    this.ws.send(JSON.stringify({ type: "audio", data: base64 }));
    this.audioChunksSent++;

    if (this.audioChunksSent <= 3 || this.audioChunksSent % 100 === 0) {
      console.log(`[MIC] Chunk #${this.audioChunksSent} sent, level=${this.micLevel.toFixed(4)}, size=${base64.length}`);
    }
  }

  private downsample(input: Float32Array, ratio: number): Float32Array {
    const outputLength = Math.floor(input.length / ratio);
    const result = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const low = Math.floor(srcIndex);
      const high = Math.min(low + 1, input.length - 1);
      const frac = srcIndex - low;
      result[i] = input[low] * (1 - frac) + input[high] * frac;
    }
    return result;
  }

  private stopMicrophone() {
    this.micEnabled = false;
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode.port.close();
      this.workletNode = null;
    }
    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  // ── Audio playback ──────────────────────────────────────────
  private playAudioChunk(base64: string) {
    if (!this.outputCtx) return;

    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const pcm16 = new Int16Array(bytes.buffer);
      const raw = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) raw[i] = pcm16[i] / 32768.0;

      // Slow the coach down without dropping its pitch. At speed 1 this is a
      // pass-through; below 1 the stretched buffer is genuinely longer, so the
      // scheduling stays correct with no extra arithmetic.
      this.scheduleSamples(this.stretcher.process(raw));
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  }

  /** Play out the stretcher tail so the last word of a turn is not clipped. */
  private flushStretcher() {
    try {
      this.scheduleSamples(this.stretcher.flush());
    } catch (err) {
      console.error("Audio flush error:", err);
    }
  }

  private scheduleSamples(samples: Float32Array) {
    if (!this.outputCtx || samples.length === 0) return;

    const audioBuffer = this.outputCtx.createBuffer(1, samples.length, 24000);
    audioBuffer.getChannelData(0).set(samples);

    const source = this.outputCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputCtx.destination);

    const now = this.outputCtx.currentTime;
    if (this.nextPlayTime < now) this.nextPlayTime = now;

    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;
    this.activeSourceNodes.push(source);

    source.onended = () => {
      this.activeSourceNodes = this.activeSourceNodes.filter((s) => s !== source);
    };
  }

  private stopAudioPlayback() {
    this.stretcher.reset();
    for (const source of this.activeSourceNodes) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    }
    this.activeSourceNodes = [];
    this.nextPlayTime = 0;
  }

  private wsSend(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // ── Wake Lock — prevent screen sleep during session ─────────
  private async acquireWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      console.log("[WAKELOCK] Acquired");
      this.wakeLock.addEventListener("release", () => {
        console.log("[WAKELOCK] Released");
      });
    } catch (err) {
      console.warn("[WAKELOCK] Failed to acquire:", err);
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  // ── Visibility handler — resume when returning to app ───────
  private setupVisibilityHandler() {
    this.visibilityHandler = async () => {
      if (document.visibilityState !== "visible") return;
      console.log("[VISIBILITY] Page became visible, resuming audio contexts");
      await this.audioCtx?.resume().catch(() => {});
      await this.outputCtx?.resume().catch(() => {});
      this.acquireWakeLock();
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private removeVisibilityHandler() {
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}
