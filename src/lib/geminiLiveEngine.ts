import { TurnMode, VoiceSessionState } from '../types';
import { LearningMode, LearningRuntimeState, SessionStartReason } from '../types/learningSession';
import { ConversationRuntimeState } from './conversationRuntime';
import { screenWakeLockManager } from './screenWakeLock';
import { saveActiveSessionState, clearActiveSessionState } from './sessionPersistence';

export type LiveStatus = 'disconnected' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export type BargeInStatus =
  | 'idle'
  | 'monitoring'
  | 'candidate_speech'
  | 'interrupting_teacher'
  | 'capturing_user'
  | 'waiting_for_user_end';

export interface BargeInState {
  status: BargeInStatus;
  teacherTurnId?: string;
  candidateStartedAt?: number;
  interruptionSent: boolean;
  userSpeechConfirmed: boolean;
}

export interface LiveConnection {
  id: string;
  ws: WebSocket;
  generation: number;
  role: 'active' | 'pending';
  transitionId: number;
  learningMode: string;
}

export type LiveContextTransitionStatus =
  | 'idle'
  | 'preparing'
  | 'pending_setup'
  | 'promoting'
  | 'waiting_for_initial_turn'
  | 'completed'
  | 'rolling_back'
  | 'failed';

export interface LiveContextTransition {
  id: number;
  status: LiveContextTransitionStatus;
  sourceMode?: string;
  targetMode?: string;
  startedAt: number;
  retryCount: number;
  previousConnectionId?: string;
  pendingConnectionId?: string;
  options?: any;
}

export interface LiveDiagnostics {
  originalSampleRate: number;
  sentSampleRate: number;
  channelCount: number;
  sampleFormat: string;
  avgChunkSizeBytes: number;
  connectionStatus: LiveStatus;
  voiceSessionState: VoiceSessionState;
  appSessionId: string;
  connectionGeneration: number;
  userRequestedEnd: boolean;
  sessionExpectedActive: boolean;
  reconnectAttempt: number;
  wsReadyState: string;
  isOnline: boolean;
  sessionResumptionEnabled: boolean;
  resumptionHandleAvailable: boolean;
  lastResumableState: boolean;
  goAwayCount: number;
  lastGoAwayTimeLeft: string;
  contextWindowCompressionActive: boolean;
  historyFallbackExecuted: boolean;
  reinjectedMessageCount: number;
  wakeLockSupported: boolean;
  wakeLockActive: boolean;
  visibilityState: string;
  lastLifecycleEvent: string;
  audioContextState: string;
  micTrackState: string;
  requiresUserGestureToResume: boolean;

  inputTranscriptionCount: number;
  lastInputTranscription: string;
  outputTranscriptionCount: number;
  lastOutputTranscription: string;
  browserSpeechRecognitionUsed: boolean;
  turnMode: TurnMode;
  pauseToleranceSeconds: number;
  silenceDurationMs: number;
  automaticActivityDetection: boolean;
  activityHandling: string;
  manualTurnActive: boolean;
  micOutboundEnabled: boolean;
  activityStartCount: number;
  activityEndCount: number;
  audioStreamEndCount: number;
  uiPauseToleranceSeconds: number;
  localStoragePauseToleranceSeconds: number | string;
  loadedAtStartupPauseToleranceSeconds: number;
  activeSessionPauseToleranceSeconds: number;
  clientSentPauseToleranceSeconds: number;
  serverReceivedPauseToleranceSeconds: number;
  geminiSilenceDurationMs: number;
  automaticActivityEndCount: number;
  userPauseAudioStreamEndCount: number;
  closureReason: string;
  sessionEndSent: boolean;
  uiLevel?: string;
  localStorageLevel?: string;
  loadedAtStartupLevel?: string;
  activeSessionLevel?: string;
  clientSentLevel?: string;
  serverReceivedLevel?: string;
  levelProfileInjected?: string;
  learningMode?: string;
  activityStatus?: string;
  currentPhase?: string;
  waitingFor?: string;
  currentItemId?: string;
  completedItemCount?: number;
  targetItemCount?: number;
  lastScore?: number;
  extractedVocabCount?: number;
  silentEvalSuccess?: boolean;
  stateRestoredOnReconnect?: boolean;
  sessionPromptType?: 'voice' | 'text';
  tapToTalkRecommendedForA1A2?: boolean;
  transitionStatus?: LiveContextTransitionStatus;
  currentTransitionId?: number;
}

export interface GeminiLiveOptions {
  voiceName: string;
  level: string;
  topic: string;
  learningMode?: LearningMode;
  learningRuntimeState?: LearningRuntimeState;
  sessionStartReason?: SessionStartReason;
  correctionMode?: string;
  knowledgeText?: string;
  turnMode: TurnMode;
  pauseToleranceSeconds: number;
  keepScreenAwake?: boolean;
  recentHistory?: Array<{ sender: 'user' | 'coach'; text: string }>;
  initialActionPrompt?: string;
  forceFreshModelContext?: boolean;
  onStatusChange?: (status: LiveStatus) => void;
  onVoiceStateChange?: (voiceState: VoiceSessionState) => void;
  onTeacherTranscript?: (text: string, isFinal: boolean) => void;
  onUserTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onVolumeChange?: (volume: number) => void;
  onDiagnosticsChange?: (diag: LiveDiagnostics) => void;
  onManualTurnChange?: (active: boolean) => void;
  onNotification?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export class GeminiLiveEngine {
  private activeConnection: LiveConnection | null = null;
  private pendingConnection: LiveConnection | null = null;

  private activeConnectionGeneration: number = 0;
  private pendingConnectionGeneration: number = 0;
  private transitionIdCounter: number = 0;

  private currentTransition: LiveContextTransition = {
    id: 0,
    status: 'idle',
    startedAt: 0,
    retryCount: 0,
  };

  private setupTimeoutTimer: any = null;
  private initialTurnTimeoutTimer: any = null;

  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private silentInputGain: GainNode | null = null;
  private micProcessingWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMicAudioProcessAt: number = 0;
  private micRecoveryAttempted: boolean = false;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private nextPlayTime: number = 0;
  
  private status: LiveStatus = 'disconnected';
  private voiceSessionState: VoiceSessionState = 'idle';
  private teacherAccumulatedText: string = '';
  private userAccumulatedText: string = '';
  private userTranscriptFinalizeTimer: ReturnType<typeof setTimeout> | null = null;
  private options: GeminiLiveOptions | null = null;
  private isUserSpeakingActive: boolean = false;

  // Session vs Connection flags
  private appSessionId: string = '';
  private sessionStartReason: SessionStartReason = 'fresh_session';
  private userRequestedEnd: boolean = true;
  private sessionExpectedActive: boolean = false;
  private reconnectAttempt: number = 0;
  private reconnectTimer: any = null;
  private isReconnecting: boolean = false;

  // Resumption & Diagnostics flags
  private resumptionHandleAvailable: boolean = false;
  private lastResumableState: boolean = false;
  private goAwayCount: number = 0;
  private lastGoAwayTimeLeft: string = 'N/A';
  private contextWindowCompressionActive: boolean = true;
  private historyFallbackExecuted: boolean = false;
  private reinjectedMessageCount: number = 0;
  private wakeLockActive: boolean = false;
  private wakeLockSupported: boolean = false;
  private lastLifecycleEvent: string = 'Init';
  private requiresUserGestureToResume: boolean = false;

  private turnMode: TurnMode = 'automatic';
  private pauseToleranceSeconds: number = 5;
  private manualTurnActive: boolean = false;
  private micOutboundEnabled: boolean = true;

  // Barge-in & Mic Analysis State
  private micCaptureActive: boolean = false;
  private localVadEnabled: boolean = false;
  private teacherPlaybackActive: boolean = false;
  private bargeInEnabled: boolean = false;

  private bargeInState: BargeInState = {
    status: 'idle',
    interruptionSent: false,
    userSpeechConfirmed: false,
  };

  private currentTeacherTurnId: string | null = null;
  private interruptedTeacherTurnIds: Set<string> = new Set<string>();
  private teacherTurnSeq: number = 0;

  private rollingMicBuffer: Array<{ data: string; timestamp: number }> = [];

  private isInitialCoachTurnPending: boolean = false;
  private activeModelSetupComplete: boolean = false;
  private initialCoachTurnRequestSent: boolean = false;
  private initialCoachTurnAccepted: boolean = false;
  private initialSetupWatchdogTimer: any = null;
  private initialCoachFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private initialSetupRetryCount: number = 0;
  private forceFreshModelContext: boolean = false;
  private initialActionPrompt?: string;
  private sentAudioStreamEnd: boolean = false;

  // Authoritative teacher-turn delivery state. A visible transcript alone is never
  // considered a successful spoken turn: at least one playable audio chunk must arrive.
  private teacherAudioWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private teacherTurnAudioReceived: boolean = false;
  private teacherTurnTextReceived: boolean = false;
  private teacherTurnRetryCount: number = 0;
  private pendingTeacherActionPrompt: string = '';
  private pendingTeacherTransitionId: number = 0;

  // Guards against a turn that starts streaming (audio/text already arrived) and then
  // goes silent without turnComplete, interrupted, error or close ever firing — the
  // upstream Live session can stall mid-response without tearing down the socket.
  // Without this, the app is stuck in 'speaking'/'thinking' forever with the mic disabled.
  private teacherStreamStallWatchdogTimer: ReturnType<typeof setTimeout> | null = null;

  private activityStartCount: number = 0;
  private activityEndCount: number = 0;
  private audioStreamEndCount: number = 0;

  private loadedAtStartupPauseToleranceSeconds: number = 2;
  private activeSessionPauseToleranceSeconds: number = 2;
  private clientSentPauseToleranceSeconds: number = 2;
  private serverReceivedPauseToleranceSeconds: number = 2;
  private geminiSilenceDurationMs: number = 2000;
  private closureReason: string = 'In attesa o mai avviata';
  private sessionEndSent: boolean = false;

  private outputTranscriptionCount: number = 0;
  private lastOutputTranscription: string = '';
  private inputTranscriptionCount: number = 0;
  private lastInputTranscription: string = '';
  private serverReceivedLevel: string = '';
  private levelProfileInjected: string = '';

  private wakeLockUnsubscribe: (() => void) | null = null;

  constructor() {
    this.initPageLifecycleListeners();
  }

  public get ws(): WebSocket | null {
    return this.activeConnection?.ws || null;
  }

  private initPageLifecycleListeners() {
    if (typeof window === 'undefined') return;

    // Screen Wake Lock status listener
    this.wakeLockSupported = screenWakeLockManager.isSupported();
    this.wakeLockUnsubscribe = screenWakeLockManager.addListener((active, supported) => {
      this.wakeLockActive = active;
      this.wakeLockSupported = supported;
      this.updateDiagnostics({});
    });

    const handleVisibility = () => {
      const state = document.visibilityState;
      this.lastLifecycleEvent = `visibilitychange (${state})`;

      if (state === 'hidden') {
        this.persistCurrentState();
      } else if (state === 'visible') {
        if (this.sessionExpectedActive && !this.userRequestedEnd) {
          this.handleResumeFromBackground();
        }
      }
    };

    const handleFreezeOrPageHide = (e: Event) => {
      this.lastLifecycleEvent = e.type;
      this.persistCurrentState();
    };

    const handleResumeOrPageShow = (e: Event) => {
      this.lastLifecycleEvent = e.type;
      if (this.sessionExpectedActive && !this.userRequestedEnd) {
        this.handleResumeFromBackground();
      }
    };

    const handleOnline = () => {
      this.lastLifecycleEvent = 'online';
      if ((this.sessionExpectedActive && !this.userRequestedEnd && this.status === 'error') || this.voiceSessionState === 'reconnecting') {
        this.reconnectSession('Ripristino connessione internet');
      }
    };

    const handleOffline = () => {
      this.lastLifecycleEvent = 'offline';
      if (this.sessionExpectedActive) {
        this.notify('Connessione internet assente', 'warning');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('freeze', handleFreezeOrPageHide);
    window.addEventListener('pagehide', handleFreezeOrPageHide);
    window.addEventListener('resume', handleResumeOrPageShow);
    window.addEventListener('pageshow', handleResumeOrPageShow);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  private appendTranscriptChunk(existing: string, incoming: string): string {
    const chunk = String(incoming || '').replace(/\s+/g, ' ').trim();
    if (!chunk) return existing;
    if (!existing) return chunk;
    const needsSpace = !/[\s'’-]$/.test(existing) && !/^[,.;:!?)}\]]/.test(chunk);
    return `${existing}${needsSpace ? ' ' : ''}${chunk}`.replace(/\s+/g, ' ').trim();
  }

  private clearUserTranscriptFinalizeTimer(): void {
    if (this.userTranscriptFinalizeTimer) {
      clearTimeout(this.userTranscriptFinalizeTimer);
      this.userTranscriptFinalizeTimer = null;
    }
  }

  private finalizeUserTranscript(): void {
    this.clearUserTranscriptFinalizeTimer();
    const finalText = this.userAccumulatedText.replace(/\s+/g, ' ').trim();
    if (!finalText) return;
    this.userAccumulatedText = '';
    this.options?.onUserTranscript?.(finalText, true);
  }

  private scheduleUserTranscriptFinalization(delayMs = 300): void {
    if (!this.userAccumulatedText.trim()) return;
    this.clearUserTranscriptFinalizeTimer();
    this.userTranscriptFinalizeTimer = setTimeout(() => {
      this.finalizeUserTranscript();
    }, delayMs);
  }

  public beginLearningContextTransition(): void {
    this.stopAudioPlayback();
    this.teacherAccumulatedText = '';
    this.userAccumulatedText = '';
    this.clearUserTranscriptFinalizeTimer();
    this.micOutboundEnabled = false;
  }

  private persistCurrentState() {
    if (!this.sessionExpectedActive || this.userRequestedEnd || !this.appSessionId) return;
    if (this.options?.learningRuntimeState) {
      saveActiveSessionState(this.options.learningRuntimeState as ConversationRuntimeState);
    }
  }

  private async handleResumeFromBackground() {
    if (this.options?.keepScreenAwake !== false) {
      screenWakeLockManager.requestWakeLock();
    }

    let audioCtxBlocked = false;
    if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {
      try {
        await this.inputAudioCtx.resume();
      } catch (e) {
        audioCtxBlocked = true;
      }
    }
    if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
      try {
        await this.outputAudioCtx.resume();
      } catch (e) {
        audioCtxBlocked = true;
      }
    }

    if (audioCtxBlocked || (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended')) {
      this.requiresUserGestureToResume = true;
      this.setVoiceState('paused');
      this.notify('Tocca per riprendere la sessione', 'info');
      this.updateDiagnostics({});
      return;
    }

    this.requiresUserGestureToResume = false;

    if (!this.activeConnection?.ws || this.activeConnection.ws.readyState !== WebSocket.OPEN) {
      this.reconnectSession('Ritorno dall\'interruzione di sistema');
    }
  }

  public async resumeFromUserGesture(): Promise<boolean> {
    this.requiresUserGestureToResume = false;

    if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {
      try { await this.inputAudioCtx.resume(); } catch (e) {}
    }
    if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
      try { await this.outputAudioCtx.resume(); } catch (e) {}
    }

    if (this.options?.keepScreenAwake !== false) {
      screenWakeLockManager.requestWakeLock();
    }

    if (!this.activeConnection?.ws || this.activeConnection.ws.readyState !== WebSocket.OPEN) {
      return this.reconnectSession('Gesture utente per riprendere');
    } else {
      this.setVoiceState('listening');
      return true;
    }
  }

  private setVoiceState(newState: VoiceSessionState) {
    this.voiceSessionState = newState;
    let newLiveStatus: LiveStatus = 'disconnected';
    if (newState === 'connecting' || newState === 'reconnecting') newLiveStatus = 'connecting';
    else if (newState === 'listening') newLiveStatus = 'listening';
    else if (newState === 'thinking') newLiveStatus = 'thinking';
    else if (newState === 'speaking') newLiveStatus = 'speaking';
    else if (newState === 'error') newLiveStatus = 'error';
    else if (newState === 'idle' || newState === 'paused') newLiveStatus = 'disconnected';

    this.status = newLiveStatus;
    this.updateDiagnostics({ voiceSessionState: newState, connectionStatus: newLiveStatus });

    if (this.options?.onVoiceStateChange) {
      this.options.onVoiceStateChange(newState);
    }
    if (this.options?.onStatusChange) {
      this.options.onStatusChange(newLiveStatus);
    }
  }

  private notify(msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    if (this.options?.onNotification) {
      this.options.onNotification(msg, type);
    }
  }

  private resetBargeInState(status: BargeInStatus = 'idle') {
    this.bargeInState = {
      status,
      teacherTurnId: this.currentTeacherTurnId || undefined,
      candidateStartedAt: undefined,
      interruptionSent: false,
      userSpeechConfirmed: false,
    };
  }

  public getBargeInState(): BargeInState {
    return { ...this.bargeInState };
  }

  public handleConfirmedBargeIn(params?: { teacherTurnId?: string; reason?: string }) {
    const conn = this.activeConnection;
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;

    const isBusy =
      this.isInitialCoachTurnPending ||
      !this.activeModelSetupComplete ||
      this.isReconnecting ||
      (this.currentTransition.status !== 'idle' && this.currentTransition.status !== 'completed');

    if (isBusy) {
      if (Boolean((import.meta as any).env?.DEV)) {
        console.log('[BargeIn] Interruption ignored: engine busy during transition or setup.');
      }
      return;
    }

    const turnId = params?.teacherTurnId || this.currentTeacherTurnId || `turn_curr_${Date.now()}`;
    if (turnId) {
      this.interruptedTeacherTurnIds.add(turnId);
    }

    this.teacherPlaybackActive = false;
    this.bargeInState.status = 'interrupting_teacher';
    this.bargeInState.interruptionSent = true;

    this.stopAudioPlayback();

    this.teacherAccumulatedText = '';
    if (this.options?.onTeacherTranscript) {
      this.options.onTeacherTranscript('', false);
    }

    try {
      conn.ws.send(
        JSON.stringify({
          type: 'interrupt',
          teacherTurnId: turnId,
          reason: params?.reason || 'user_barge_in',
        })
      );
    } catch (e) {
      console.warn('[BargeIn] Error sending interrupt message:', e);
    }

    if (this.rollingMicBuffer.length > 0) {
      // Flush the rolling mic buffer so Gemini receives the start of the
      // user's speech. In all modes mic audio is now muted while the coach
      // speaks, so the buffer contains the only record of the learner's
      // first words and must always be sent.
      let flushed = 0;
      for (const item of this.rollingMicBuffer) {
        try {
          conn.ws.send(JSON.stringify({ type: 'audio', data: item.data }));
          flushed++;
        } catch (e) {}
      }
      if (Boolean((import.meta as any).env?.DEV)) {
        console.log(`[BargeIn] Flushed ${flushed} buffered audio frames for barge-in turn ${turnId}`);
      }
      this.rollingMicBuffer = [];
    }

    this.micOutboundEnabled = true;
    this.bargeInState.status = 'capturing_user';
    this.bargeInState.userSpeechConfirmed = true;
    this.setVoiceState('listening');

    if (Boolean((import.meta as any).env?.DEV)) {
      console.log(`[BargeIn] Executed barge-in for turn ${turnId} (reason: ${params?.reason || 'vad'})`);
    }
  }

  public interruptAndStartManualTurn() {
    this.handleConfirmedBargeIn({ reason: 'tap_to_talk_manual_barge_in' });
    this.startManualTurn();
  }

  public getStatus(): LiveStatus {
    return this.status;
  }

  public getVoiceState(): VoiceSessionState {
    return this.voiceSessionState;
  }

  public isReconnectingState(): boolean {
    return this.voiceSessionState === 'reconnecting';
  }

  public isUserGestureRequired(): boolean {
    return this.requiresUserGestureToResume;
  }

  public getTurnMode(): TurnMode {
    return this.turnMode;
  }

  public isManualTurnActive(): boolean {
    return this.manualTurnActive;
  }

  public isMicOutboundEnabled(): boolean {
    return this.micOutboundEnabled;
  }

  public getAppSessionId(): string {
    return this.appSessionId;
  }

  public getDiagnostics(): LiveDiagnostics {
    const effectivePause = Math.min(8, Math.max(3, Number(this.pauseToleranceSeconds) || 5));
    const silenceDurationMs = Math.round(effectivePause * 1000);
    const automaticActivityDetection = this.turnMode !== 'tap_to_talk';
    const activityHandling = 'START_OF_ACTIVITY_INTERRUPTS';

    let storedPause: number | string = 'N/A';
    let storedLevel: string = 'N/A';
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem('madrelingua-ai.voice-settings.v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.voiceSettings?.pauseToleranceSeconds != null) {
            storedPause = Number(parsed.voiceSettings.pauseToleranceSeconds);
          }
          if (parsed?.cefrLevel || parsed?.userLevel) {
            storedLevel = parsed.cefrLevel || parsed.userLevel;
          }
        }
      }
    } catch (e) {}

    const selectedLevel = this.options?.level || 'B1_B2';

    let wsStateStr = 'CLOSED';
    if (this.activeConnection?.ws) {
      const state = this.activeConnection.ws.readyState;
      if (state === WebSocket.CONNECTING) wsStateStr = 'CONNECTING';
      else if (state === WebSocket.OPEN) wsStateStr = 'OPEN';
      else if (state === WebSocket.CLOSING) wsStateStr = 'CLOSING';
    }

    let micStateStr = 'Non attivo';
    if (this.mediaStream) {
      const audioTrack = this.mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        micStateStr = `${audioTrack.label} (${audioTrack.readyState}, enabled=${audioTrack.enabled})`;
      }
    }

    return {
      connectionStatus: this.status,
      voiceSessionState: this.voiceSessionState,
      appSessionId: this.appSessionId || 'nessuna',
      connectionGeneration: this.activeConnectionGeneration,
      userRequestedEnd: this.userRequestedEnd,
      sessionExpectedActive: this.sessionExpectedActive,
      reconnectAttempt: this.reconnectAttempt,
      wsReadyState: wsStateStr,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      sessionResumptionEnabled: true,
      resumptionHandleAvailable: this.resumptionHandleAvailable,
      lastResumableState: this.lastResumableState,
      goAwayCount: this.goAwayCount,
      lastGoAwayTimeLeft: this.lastGoAwayTimeLeft,
      contextWindowCompressionActive: this.contextWindowCompressionActive,
      historyFallbackExecuted: this.historyFallbackExecuted,
      reinjectedMessageCount: this.reinjectedMessageCount,
      wakeLockSupported: this.wakeLockSupported,
      wakeLockActive: this.wakeLockActive,
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'visible',
      lastLifecycleEvent: this.lastLifecycleEvent,
      audioContextState: this.inputAudioCtx ? this.inputAudioCtx.state : 'N/A',
      micTrackState: micStateStr,
      requiresUserGestureToResume: this.requiresUserGestureToResume,

      originalSampleRate: this.inputAudioCtx ? this.inputAudioCtx.sampleRate : 48000,
      sentSampleRate: 16000,
      channelCount: 1,
      sampleFormat: 'pcm_i16_le',
      avgChunkSizeBytes: 3200,
      browserSpeechRecognitionUsed: false,

      turnMode: this.turnMode,
      pauseToleranceSeconds: effectivePause,
      silenceDurationMs,
      automaticActivityDetection,
      activityHandling,
      manualTurnActive: this.manualTurnActive,
      micOutboundEnabled: this.micOutboundEnabled,
      activityStartCount: this.activityStartCount,
      activityEndCount: this.activityEndCount,
      audioStreamEndCount: this.audioStreamEndCount,
      uiPauseToleranceSeconds: this.options?.pauseToleranceSeconds ?? effectivePause,
      localStoragePauseToleranceSeconds: storedPause,
      loadedAtStartupPauseToleranceSeconds: this.loadedAtStartupPauseToleranceSeconds,
      activeSessionPauseToleranceSeconds: this.activeSessionPauseToleranceSeconds,
      clientSentPauseToleranceSeconds: this.clientSentPauseToleranceSeconds,
      serverReceivedPauseToleranceSeconds: this.serverReceivedPauseToleranceSeconds,
      geminiSilenceDurationMs: this.geminiSilenceDurationMs,
      automaticActivityEndCount: this.turnMode === 'automatic' ? 0 : this.activityEndCount,
      userPauseAudioStreamEndCount: 0,
      closureReason: this.closureReason,
      sessionEndSent: this.sessionEndSent,
      uiLevel: selectedLevel,
      localStorageLevel: storedLevel,
      loadedAtStartupLevel: storedLevel !== 'N/A' ? storedLevel : selectedLevel,
      activeSessionLevel: selectedLevel,
      clientSentLevel: selectedLevel,
      serverReceivedLevel: this.serverReceivedLevel || selectedLevel,
      levelProfileInjected: this.levelProfileInjected || selectedLevel,
      sessionPromptType: 'voice',
      tapToTalkRecommendedForA1A2: selectedLevel === 'A1_A2',
      inputTranscriptionCount: this.inputTranscriptionCount,
      lastInputTranscription: this.lastInputTranscription,
      outputTranscriptionCount: this.outputTranscriptionCount,
      lastOutputTranscription: this.lastOutputTranscription,
      transitionStatus: this.currentTransition.status,
      currentTransitionId: this.currentTransition.id,
    };
  }

  private updateDiagnostics(partial: Partial<LiveDiagnostics>) {
    if (partial.serverReceivedLevel !== undefined) this.serverReceivedLevel = partial.serverReceivedLevel;
    if (partial.levelProfileInjected !== undefined) this.levelProfileInjected = partial.levelProfileInjected;
    if (partial.inputTranscriptionCount !== undefined) this.inputTranscriptionCount = partial.inputTranscriptionCount;
    if (partial.lastInputTranscription !== undefined) this.lastInputTranscription = partial.lastInputTranscription;
    if (partial.outputTranscriptionCount !== undefined) this.outputTranscriptionCount = partial.outputTranscriptionCount;
    if (partial.lastOutputTranscription !== undefined) this.lastOutputTranscription = partial.lastOutputTranscription;

    if (this.options?.onDiagnosticsChange) {
      this.options.onDiagnosticsChange(this.getDiagnostics());
    }
  }

  public startManualTurn(): boolean {
    if (this.turnMode !== 'tap_to_talk') return false;
    const socket = this.activeConnection?.ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    if (this.manualTurnActive) return false;

    this.manualTurnActive = true;
    this.micOutboundEnabled = true;
    this.activityStartCount++;

    socket.send(JSON.stringify({ type: 'activity_start' }));
    this.setVoiceState('listening');
    this.updateDiagnostics({});
    if (this.options?.onManualTurnChange) {
      this.options.onManualTurnChange(true);
    }
    return true;
  }

  public endManualTurn(): boolean {
    if (this.turnMode !== 'tap_to_talk') return false;
    const socket = this.activeConnection?.ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    if (!this.manualTurnActive) return false;

    this.manualTurnActive = false;
    this.micOutboundEnabled = false;
    this.activityEndCount++;

    socket.send(JSON.stringify({ type: 'activity_end' }));
    this.setVoiceState('thinking');
    this.updateDiagnostics({});
    if (this.options?.onManualTurnChange) {
      this.options.onManualTurnChange(false);
    }
    return true;
  }

  public async startSession(options: GeminiLiveOptions, existingAppSessionId?: string): Promise<boolean> {
    this.options = options;
    this.turnMode = options.turnMode || 'automatic';

    if (options.sessionStartReason) {
      this.sessionStartReason = options.sessionStartReason;
    } else if (this.isReconnecting || this.reconnectAttempt > 0) {
      this.sessionStartReason = 'technical_reconnect';
    } else if (existingAppSessionId) {
      this.sessionStartReason = 'explicit_resume';
    } else {
      this.sessionStartReason = 'fresh_session';
    }

    this.userRequestedEnd = false;
    this.sessionExpectedActive = true;
    this.appSessionId = existingAppSessionId || crypto.randomUUID();
    this.initialActionPrompt = options.initialActionPrompt;
    this.forceFreshModelContext = options.forceFreshModelContext ?? this.sessionStartReason === 'fresh_session';
    if (this.sessionStartReason === 'fresh_session') {
      this.options.recentHistory = [];
    }
    this.reconnectAttempt = 0;
    this.isReconnecting = false;
    this.requiresUserGestureToResume = false;

    const effectivePauseSeconds = Math.min(
      8,
      Math.max(3, Number(options.pauseToleranceSeconds) || 5)
    );
    this.pauseToleranceSeconds = effectivePauseSeconds;
    this.activeSessionPauseToleranceSeconds = effectivePauseSeconds;
    this.clientSentPauseToleranceSeconds = effectivePauseSeconds;
    this.serverReceivedPauseToleranceSeconds = effectivePauseSeconds;
    this.geminiSilenceDurationMs = effectivePauseSeconds * 1000;

    this.clearTransitionTimers();

    // Close existing connections
    if (this.activeConnection) {
      try {
        this.activeConnection.ws.onopen = null;
        this.activeConnection.ws.onmessage = null;
        this.activeConnection.ws.onerror = null;
        this.activeConnection.ws.onclose = null;
        this.activeConnection.ws.close();
      } catch (e) {}
      this.activeConnection = null;
    }
    if (this.pendingConnection) {
      try {
        this.pendingConnection.ws.onopen = null;
        this.pendingConnection.ws.onmessage = null;
        this.pendingConnection.ws.onerror = null;
        this.pendingConnection.ws.onclose = null;
        this.pendingConnection.ws.close();
      } catch (e) {}
      this.pendingConnection = null;
    }

    const isFreshNewSession = !existingAppSessionId && (!options.recentHistory || options.recentHistory.length === 0);
    this.activeModelSetupComplete = false;
    this.initialCoachTurnRequestSent = false;
    this.initialCoachTurnAccepted = false;
    this.initialSetupRetryCount = 0;

    if (isFreshNewSession) {
      this.isInitialCoachTurnPending = true;
      this.micOutboundEnabled = false;
    } else {
      this.isInitialCoachTurnPending = false;
      this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';
    }

    this.manualTurnActive = false;
    this.sentAudioStreamEnd = false;
    this.activityStartCount = 0;
    this.activityEndCount = 0;
    this.audioStreamEndCount = 0;
    this.sessionEndSent = false;
    this.closureReason = 'Sessione avviata dall\'utente';

    if (options.keepScreenAwake !== false) {
      screenWakeLockManager.requestWakeLock();
    }

    this.persistCurrentState();
    return this.connectFreshWebSocket();
  }

  private async ensureAudioAndMediaReady(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      throw new Error('Il runtime vocale richiede un browser.');
    }
    if (!window.isSecureContext) {
      throw new Error('Il microfono richiede una pagina HTTPS sicura. Apri la preview in una nuova scheda HTTPS.');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Questo browser o questa preview non espone navigator.mediaDevices.getUserMedia.');
    }

    const existingTrack = this.mediaStream?.getAudioTracks?.()[0];
    if (existingTrack && existingTrack.readyState !== 'live') {
      try { this.mediaStream?.getTracks().forEach((track) => track.stop()); } catch (e) {}
      this.mediaStream = null;
    }

    if (!this.mediaStream) {
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (micErr: any) {
        const isPermission =
          micErr?.name === 'NotAllowedError' ||
          micErr?.name === 'PermissionDeniedError' ||
          micErr?.name === 'SecurityError' ||
          String(micErr?.message || micErr).toLowerCase().includes('permission') ||
          String(micErr?.message || micErr).toLowerCase().includes('notallowederror');

        if (isPermission) {
          const err = new Error('Accesso al microfono negato. Abilita il microfono per questa app dalle autorizzazioni del browser e ricarica la pagina.');
          (err as any).isPermissionDenied = true;
          throw err;
        }
        throw micErr;
      }
    }

    const liveTrack = this.mediaStream.getAudioTracks()[0];
    if (!liveTrack || liveTrack.readyState !== 'live') {
      throw new Error('Il browser non ha restituito una traccia microfono attiva.');
    }
    liveTrack.enabled = true;

    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.inputAudioCtx || this.inputAudioCtx.state === 'closed') {
      this.inputAudioCtx = new AudioCtxClass();
    }
    if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
    }

    if (this.inputAudioCtx.state === 'suspended') {
      await this.inputAudioCtx.resume();
    }
    if (this.outputAudioCtx.state === 'suspended') {
      await this.outputAudioCtx.resume();
    }

    if (this.inputAudioCtx.state !== 'running') {
      throw new Error(`AudioContext microfono non attivo: ${this.inputAudioCtx.state}`);
    }

    return true;
  }

  private async connectFreshWebSocket(): Promise<boolean> {
    this.activeConnectionGeneration++;
    const currentGen = this.activeConnectionGeneration;

    this.activeModelSetupComplete = false;
    this.initialCoachTurnRequestSent = false;
    this.initialCoachTurnAccepted = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setVoiceState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    try {
      await this.ensureAudioAndMediaReady();

      const connId = `conn_active_${Date.now()}_${currentGen}`;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-ws`;
      const ws = new WebSocket(wsUrl);

      const conn: LiveConnection = {
        id: connId,
        ws,
        generation: currentGen,
        role: 'active',
        transitionId: this.currentTransition.id,
        learningMode: this.options?.learningMode || 'activity_selection',
      };

      if (this.activeConnection) {
        try {
          this.activeConnection.ws.onopen = null;
          this.activeConnection.ws.onmessage = null;
          this.activeConnection.ws.onerror = null;
          this.activeConnection.ws.onclose = null;
          this.activeConnection.ws.close();
        } catch (e) {}
      }

      this.activeConnection = conn;

      ws.onopen = () => {
        if (this.activeConnection?.id !== connId) return;

        ws.send(
          JSON.stringify({
            type: 'init',
            appSessionId: this.appSessionId,
            sessionStartReason: this.sessionStartReason,
            voiceName: this.options?.voiceName || 'Achird',
            level: this.options?.level,
            topic: this.options?.topic,
            learningMode: this.options?.learningMode || 'activity_selection',
            learningRuntimeState: this.options?.learningRuntimeState || null,
            correctionMode: this.options?.correctionMode || 'immediate',
            knowledgeText: this.options?.knowledgeText,
            turnMode: this.turnMode,
            pauseToleranceSeconds: this.pauseToleranceSeconds,
            recentHistory: this.options?.recentHistory || [],
            forceFreshModelContext: this.forceFreshModelContext,
            initialActionPrompt: this.initialActionPrompt,
            deferInitialCoachTurn: false,
          })
        );
      };

      this.attachActiveWebSocketHandlers(conn);

      if (this.initialSetupWatchdogTimer) {
        clearTimeout(this.initialSetupWatchdogTimer);
        this.initialSetupWatchdogTimer = null;
      }
      this.initialSetupWatchdogTimer = setTimeout(() => {
        if (this.activeConnection?.id === connId && !this.activeModelSetupComplete) {
          console.warn('[LiveStartup] Initial connection setup timeout (8s)');
          if (this.initialSetupRetryCount < 1) {
            this.initialSetupRetryCount++;
            console.warn('[LiveStartup] Retrying connectFreshWebSocket once...');
            this.connectFreshWebSocket();
          } else {
            console.error('[LiveStartup] Initial connection setup second failure.');
            this.setVoiceState('error');
            this.notify('Non sono riuscito ad avviare il coach. Tocca per riprovare.', 'error');
          }
        }
      }, 8000);

      return true;
    } catch (err: any) {
      console.error('[LiveHandoff] Failed to connect fresh WebSocket:', err);
      const isPermission =
        err?.isPermissionDenied ||
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.name === 'SecurityError' ||
        String(err?.message || err).toLowerCase().includes('permission');

      if (isPermission) {
        this.sessionExpectedActive = false;
        this.setVoiceState('error');
        const errMsg = 'Accesso al microfono negato. Autorizza il microfono nel browser per continuare.';
        this.notify(errMsg, 'error');
        if (this.options?.onError) {
          this.options.onError(errMsg);
        }
        return false;
      }

      if (this.sessionExpectedActive && !this.userRequestedEnd) {
        this.handleTechnicalDisconnect('Impossibile stabilire il WebSocket');
      } else {
        this.setVoiceState('error');
      }
      return false;
    }
  }

  private clearTeacherAudioWatchdog(): void {
    if (this.teacherAudioWatchdogTimer) {
      clearTimeout(this.teacherAudioWatchdogTimer);
      this.teacherAudioWatchdogTimer = null;
    }
  }

  private beginTeacherDelivery(prompt: string, transitionId: number): void {
    this.clearTeacherAudioWatchdog();
    this.pendingTeacherActionPrompt = prompt || '';
    this.pendingTeacherTransitionId = transitionId;
    this.teacherTurnAudioReceived = false;
    this.teacherTurnTextReceived = false;
    this.teacherTurnRetryCount = 0;
    this.armTeacherAudioWatchdog();
  }

  private armTeacherAudioWatchdog(timeoutMs = 10000): void {
    this.clearTeacherAudioWatchdog();
    this.teacherAudioWatchdogTimer = setTimeout(() => {
      if (!this.sessionExpectedActive || this.userRequestedEnd || this.teacherTurnAudioReceived) return;
      this.retryTeacherTurnForMissingAudio('audio_watchdog_timeout');
    }, timeoutMs);
  }

  private retryTeacherTurnForMissingAudio(reason: string): void {
    if (this.teacherTurnAudioReceived || !this.sessionExpectedActive || this.userRequestedEnd) return;
    // If we received transcript text but no audio yet, audio may be delayed —
    // extend the deadline rather than immediately retrying, which would restart
    // the response and cause a stutter.
    if (this.teacherTurnTextReceived && this.teacherTurnRetryCount === 0) {
      this.teacherTurnRetryCount += 1;
      this.armTeacherAudioWatchdog(8000);
      return;
    }
    this.clearTeacherStreamStallWatchdog();
    const socket = this.activeConnection?.ws;
    if (!socket || socket.readyState !== WebSocket.OPEN || !this.activeModelSetupComplete) {
      this.clearTeacherAudioWatchdog();
      this.currentTransition.status = 'failed';
      this.isInitialCoachTurnPending = false;
      this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';
      this.setVoiceState('listening');
      this.notify('La risposta vocale non è partida. Puoi riprovare a parlare.', 'warning');
      return;
    }

    if (this.teacherTurnRetryCount < 1) {
      this.teacherTurnRetryCount += 1;
      this.stopAudioPlayback();
      this.teacherAccumulatedText = '';
      this.teacherTurnTextReceived = false;
      this.options?.onTeacherTranscript?.('', false);
      this.setVoiceState('thinking');
      socket.send(JSON.stringify({
        type: 'retry_teacher_turn',
        transitionId: this.pendingTeacherTransitionId,
        initialActionPrompt: this.pendingTeacherActionPrompt,
        reason,
      }));
      this.armTeacherAudioWatchdog(12000);
      return;
    }

    this.clearTeacherAudioWatchdog();
    this.currentTransition.status = 'failed';
    this.isInitialCoachTurnPending = false;
    this.initialCoachTurnRequestSent = false;
    this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';
    this.setVoiceState('listening');
    this.notify('Ho ricevuto il testo ma non l’audio del coach. La sessione resta attiva: prova a parlare di nuovo.', 'error');
  }

  // Re-armed on every audio/transcript chunk while a teacher turn is in flight. If the
  // stream then falls silent for longer than the timeout with no turnComplete/interrupted/
  // error/close, the transport is treated as broken and a reconnect is triggered — the same
  // recovery path already used for explicit WebSocket errors and closes.
  private armTeacherStreamStallWatchdog(timeoutMs = 20000): void {
    this.clearTeacherStreamStallWatchdog();
    this.teacherStreamStallWatchdogTimer = setTimeout(() => {
      this.teacherStreamStallWatchdogTimer = null;
      if (!this.sessionExpectedActive || this.userRequestedEnd || !this.teacherPlaybackActive) return;
      console.warn('[StallWatchdog] Teacher turn stalled mid-stream with no completion signal; reconnecting.');
      this.handleTechnicalDisconnect('Il coach si è bloccato durante la risposta');
    }, timeoutMs);
  }

  private clearTeacherStreamStallWatchdog(): void {
    if (this.teacherStreamStallWatchdogTimer) {
      clearTimeout(this.teacherStreamStallWatchdogTimer);
      this.teacherStreamStallWatchdogTimer = null;
    }
  }

  private markTeacherAudioReceived(connectionId: string): void {
    if (this.activeConnection?.id !== connectionId) return;
    this.teacherTurnAudioReceived = true;
    this.clearTeacherAudioWatchdog();
    if (
      this.currentTransition.id === this.pendingTeacherTransitionId &&
      this.currentTransition.status === 'waiting_for_initial_turn'
    ) {
      this.currentTransition.status = 'completed';
      if (this.initialTurnTimeoutTimer) {
        clearTimeout(this.initialTurnTimeoutTimer);
        this.initialTurnTimeoutTimer = null;
      }
    }
  }

  // --- TWO-PHASE DIDACTIC MODE SWITCH HANDOFF ---

  public async reconfigureLearningSession(options: {
    learningMode: LearningMode;
    learningRuntimeState: LearningRuntimeState;
    topic?: string;
    knowledgeText?: string;
    initialActionPrompt?: string;
    forceFreshModelContext?: boolean;
    sessionStartReason?: SessionStartReason;
  }): Promise<boolean> {
    const transitionId = ++this.transitionIdCounter;
    this.clearTransitionTimers();
    this.clearTeacherAudioWatchdog();

    this.currentTransition = {
      id: transitionId,
      status: 'preparing',
      sourceMode: this.options?.learningMode,
      targetMode: options.learningMode,
      startedAt: Date.now(),
      retryCount: 0,
      previousConnectionId: this.activeConnection?.id,
      options,
    };

    // Keep one Live connection for the whole app session. Changing activity is a
    // conversational state update, not a transport reconnect.
    this.stopAudioPlayback();
    this.resetBargeInState('idle');
    if (this.currentTeacherTurnId) {
      this.interruptedTeacherTurnIds.add(this.currentTeacherTurnId);
    }
    this.teacherPlaybackActive = false;
    this.teacherAccumulatedText = '';
    this.userAccumulatedText = '';
    this.clearUserTranscriptFinalizeTimer();
    this.options?.onTeacherTranscript?.('', false);
    this.options?.onUserTranscript?.('', false);

    const effectiveKnowledgeText = options.learningMode === 'learn_new_vocabulary'
      ? ''
      : (options.knowledgeText ?? this.options?.knowledgeText ?? '');

    if (this.options) {
      this.options.learningMode = options.learningMode;
      this.options.learningRuntimeState = options.learningRuntimeState;
      this.options.topic = options.topic ?? this.options.topic;
      this.options.knowledgeText = effectiveKnowledgeText;
      if (options.learningMode === 'learn_new_vocabulary') {
        this.options.recentHistory = [];
      }
    }

    this.forceFreshModelContext = false;
    this.initialActionPrompt = options.initialActionPrompt;
    this.isInitialCoachTurnPending = Boolean(options.initialActionPrompt);
    this.initialCoachTurnRequestSent = Boolean(options.initialActionPrompt);
    this.initialCoachTurnAccepted = false;
    this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';

    const active = this.activeConnection;
    if (active?.ws.readyState === WebSocket.OPEN && this.activeModelSetupComplete) {
      this.currentTransition.status = 'waiting_for_initial_turn';
      this.setVoiceState('thinking');
      const prompt = options.initialActionPrompt || '';
      this.beginTeacherDelivery(prompt, transitionId);
      active.transitionId = transitionId;
      active.learningMode = options.learningMode;
      active.ws.send(JSON.stringify({
        type: 'context_update',
        transitionId,
        learningMode: options.learningMode,
        learningRuntimeState: options.learningRuntimeState,
        topic: options.topic,
        knowledgeText: effectiveKnowledgeText,
        initialActionPrompt: prompt,
      }));
      return true;
    }

    // Transport recovery only: preserve the previous connection until the pending
    // one has emitted setup_complete. Promotion on a mere WebSocket open is forbidden.
    this.currentTransition.status = 'pending_setup';
    return this.preparePendingConnection(transitionId, {
      ...options,
      knowledgeText: effectiveKnowledgeText,
    });
  }

  private async preparePendingConnection(transitionId: number, options: any): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (this.currentTransition.id !== transitionId) {
        console.warn(`[LiveHandoff] Abandoning preparePendingConnection for obsolete transition #${transitionId}`);
        resolve(false);
        return;
      }

      this.currentTransition.status = 'pending_setup';
      this.pendingConnectionGeneration++;
      const pendingGen = this.pendingConnectionGeneration;
      const connId = `conn_pending_${Date.now()}_${pendingGen}`;

      console.log(`[LiveHandoff] Creating pending connection ${connId} for transition #${transitionId} (gen ${pendingGen})`);

      this.ensureAudioAndMediaReady().then(() => {
        try {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${protocol}//${window.location.host}/api/live-ws`;
          const ws = new WebSocket(wsUrl);

          const pendingConn: LiveConnection = {
            id: connId,
            ws,
            generation: pendingGen,
            role: 'pending',
            transitionId,
            learningMode: options.learningMode,
          };

          if (this.pendingConnection) {
            try {
              this.pendingConnection.ws.onopen = null;
              this.pendingConnection.ws.onmessage = null;
              this.pendingConnection.ws.onerror = null;
              this.pendingConnection.ws.onclose = null;
              this.pendingConnection.ws.close();
            } catch (e) {}
          }

          this.pendingConnection = pendingConn;
          this.currentTransition.pendingConnectionId = connId;

          // 12-second setup timeout
          this.setupTimeoutTimer = setTimeout(() => {
            this.handleSetupTimeout(transitionId, resolve);
          }, 12000);

          ws.onopen = () => {
            if (this.pendingConnection?.id !== connId || this.currentTransition.id !== transitionId) {
              console.log(`[LiveHandoff] Stale pending onopen ignored for ${connId}`);
              return;
            }

            console.log(`[LiveHandoff] Pending WebSocket connected ${connId}. Sending init...`);
            const initPayload = {
              type: 'init',
              appSessionId: this.appSessionId,
              sessionStartReason: 'activity_switch',
              voiceName: this.options?.voiceName || 'Achird',
              level: this.options?.level,
              topic: options.topic || this.options?.topic,
              learningMode: options.learningMode,
              learningRuntimeState: options.learningRuntimeState,
              correctionMode: this.options?.correctionMode || 'immediate',
              knowledgeText: options.learningMode === 'learn_new_vocabulary' ? '' : (options.knowledgeText ?? this.options?.knowledgeText),
              turnMode: this.turnMode,
              pauseToleranceSeconds: this.pauseToleranceSeconds,
              recentHistory: options.learningMode === 'learn_new_vocabulary' ? [] : (this.options?.recentHistory || []),
              forceFreshModelContext: true,
              deferInitialCoachTurn: true,
              transitionId,
            };

            ws.send(JSON.stringify(initPayload));
          };

          ws.onmessage = (event) => {
            if (this.pendingConnection?.id !== connId || this.currentTransition.id !== transitionId) {
              return;
            }

            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'setup_complete') {
                console.log(`[LiveHandoff] Received ${msg.type} on pending connection ${connId} for transition #${transitionId}`);
                if (this.setupTimeoutTimer) {
                  clearTimeout(this.setupTimeoutTimer);
                  this.setupTimeoutTimer = null;
                }

                // PHASE 2 — PROMOTE
                this.promotePendingConnection(transitionId, options);
                resolve(true);
              } else if (msg.type === 'error') {
                console.error(`[LiveHandoff] Pending connection ${connId} error message:`, msg.error);
                this.handlePendingFailure(transitionId, msg.error || 'Errore di connessione', resolve);
              }
            } catch (e) {
              console.error(`[LiveHandoff] Error parsing message on pending connection ${connId}:`, e);
            }
          };

          ws.onerror = (err) => {
            if (this.pendingConnection?.id !== connId || this.currentTransition.id !== transitionId) return;
            console.error(`[LiveHandoff] Pending WebSocket error on ${connId}:`, err);
            this.handlePendingFailure(transitionId, 'Errore di rete sul WebSocket pendente', resolve);
          };

          ws.onclose = () => {
            if (this.pendingConnection?.id !== connId || this.currentTransition.id !== transitionId) return;
            console.warn(`[LiveHandoff] Pending WebSocket closed early on ${connId}`);
            this.handlePendingFailure(transitionId, 'WebSocket pendente chiuso prematuramente', resolve);
          };

        } catch (err: any) {
          console.error(`[LiveHandoff] Failed to instantiate pending WebSocket:`, err);
          this.handlePendingFailure(transitionId, err?.message || 'Impossibile creare il WebSocket pendente', resolve);
        }
      }).catch((err: any) => {
        console.error('[LiveHandoff] Media setup failed for pending connection:', err);
        const isPermission =
          err?.isPermissionDenied ||
          err?.name === 'NotAllowedError' ||
          err?.name === 'PermissionDeniedError' ||
          err?.name === 'SecurityError' ||
          String(err?.message || err).toLowerCase().includes('permission');

        if (isPermission) {
          this.sessionExpectedActive = false;
          this.setVoiceState('error');
          const errMsg = 'Accesso al microfono negato. Autorizza il microfono nel browser per continuare.';
          this.notify(errMsg, 'error');
          if (this.options?.onError) {
            this.options.onError(errMsg);
          }
        }
        this.handlePendingFailure(transitionId, err?.message || 'Impossibile accedere al microfono', resolve);
      });
    });
  }

  private promotePendingConnection(transitionId: number, options: any): void {
    if (this.currentTransition.id !== transitionId || !this.pendingConnection) {
      console.warn(`[LiveHandoff] Cannot promote: transition ID mismatch or no pending connection.`);
      return;
    }

    this.currentTransition.status = 'promoting';
    const promotedConn = this.pendingConnection;
    const previousConn = this.activeConnection;

    console.log(`[LiveHandoff] Phase 2 PROMOTE: Promoting connection ${promotedConn.id} to active. Closing previous connection ${previousConn?.id || 'none'}`);

    // 1. Promote pending to active
    promotedConn.role = 'active';
    this.activeConnection = promotedConn;
    this.activeConnectionGeneration = promotedConn.generation;
    this.pendingConnection = null;

    // 2. Attach operational handlers to promoted connection's WS
    this.attachActiveWebSocketHandlers(promotedConn);

    // 3. Safely close previous active connection
    if (previousConn) {
      try {
        previousConn.ws.onopen = null;
        previousConn.ws.onmessage = null;
        previousConn.ws.onerror = null;
        previousConn.ws.onclose = null;
        if (previousConn.ws.readyState === WebSocket.OPEN || previousConn.ws.readyState === WebSocket.CONNECTING) {
          previousConn.ws.close();
        }
      } catch (e) {
        console.warn(`[LiveHandoff] Error closing previous connection ${previousConn.id}:`, e);
      }
    }

    // 4. Clear old audio/text state
    this.stopAudioPlayback();
    this.teacherAccumulatedText = '';
    this.userAccumulatedText = '';

    // 5. Re-enable microphone output & audio routing (keep disabled if initial coach turn is pending)
    const isCoachTurnPending = this.isInitialCoachTurnPending || Boolean(options.initialActionPrompt || this.initialActionPrompt);
    if (isCoachTurnPending) {
      this.isInitialCoachTurnPending = true;
      this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';
      this.setVoiceState('thinking');
    } else {
      this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';
    }
    this.startMicProcessing();

    // 6. Update transition state to waiting_for_initial_turn
    this.currentTransition.status = 'waiting_for_initial_turn';

    // 7. Send request_initial_coach_turn to promoted active socket
    const startupPrompt = options.initialActionPrompt || this.initialActionPrompt;
    console.log(`[LiveHandoff] Sending request_initial_coach_turn to promoted connection ${promotedConn.id} for transition #${transitionId}`);
    
    if (promotedConn.ws.readyState === WebSocket.OPEN) {
      this.initialCoachTurnRequestSent = true;
      this.beginTeacherDelivery(startupPrompt || '', transitionId);
      promotedConn.ws.send(JSON.stringify({
        type: 'request_initial_coach_turn',
        appSessionId: this.appSessionId,
        sessionStartReason: 'activity_switch',
        transitionId,
        initialActionPrompt: startupPrompt,
      }));
    }

    // 8. Start initial turn timeout (12 seconds)
    this.initialTurnTimeoutTimer = setTimeout(() => {
      this.handleInitialTurnTimeout(transitionId, options);
    }, 12000);
  }

  private attachActiveWebSocketHandlers(conn: LiveConnection): void {
    conn.ws.onmessage = (event) => {
      if (this.activeConnection?.id !== conn.id) {
        console.log(`[LiveHandoff] Message on inactive connection ${conn.id} ignored.`);
        return;
      }

      try {
        const msg = JSON.parse(event.data);

        if (
          msg.transitionId !== undefined &&
          Number(msg.transitionId) < Number(conn.transitionId || 0) &&
          ['teacher_turn_started', 'audio', 'teacher_transcript', 'teacher_turn_completed', 'turnComplete'].includes(msg.type)
        ) {
          if (Boolean((import.meta as any).env?.DEV)) {
            console.log(`[LiveTurn] Discarded stale ${msg.type} for transition #${msg.transitionId}; active is #${conn.transitionId}`);
          }
          return;
        }

        if (msg.type === 'connected') {
          if (msg.serverPauseToleranceSeconds) {
            this.serverReceivedPauseToleranceSeconds = msg.serverPauseToleranceSeconds;
          }
          if (msg.silenceDurationMs) {
            this.geminiSilenceDurationMs = msg.silenceDurationMs;
          }
          if (msg.hasHandle !== undefined) {
            this.resumptionHandleAvailable = Boolean(msg.hasHandle);
          }

          const wasReconnecting = this.reconnectAttempt > 0 || this.isReconnecting;
          this.reconnectAttempt = 0;
          this.isReconnecting = false;

          this.updateDiagnostics({
            serverReceivedLevel: msg.serverReceivedLevel || this.options?.level,
            levelProfileInjected: msg.levelProfileInjected || this.options?.level,
          });

          this.startMicProcessing();

          if (this.isInitialCoachTurnPending) {
            this.micOutboundEnabled = false;
          } else {
            this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';
            this.setVoiceState('listening');
          }

          if (wasReconnecting) {
            this.notify('Connessione ripristinata', 'success');
          }
          return;
        }

        if (msg.type === 'setup_complete') {
          if (this.initialSetupWatchdogTimer) {
            clearTimeout(this.initialSetupWatchdogTimer);
            this.initialSetupWatchdogTimer = null;
          }
          this.activeModelSetupComplete = true;
          this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';

          this.startMicProcessing();

          if (this.isInitialCoachTurnPending && !this.initialCoachTurnRequestSent) {
            this.initialCoachTurnRequestSent = true;

            this.beginTeacherDelivery(this.initialActionPrompt || '', conn.transitionId);
            conn.ws.send(
              JSON.stringify({
                type: 'request_initial_coach_turn',
                appSessionId: this.appSessionId,
                sessionStartReason: this.sessionStartReason,
                transitionId: conn.transitionId,
                initialActionPrompt: this.initialActionPrompt,
              })
            );
            this.setVoiceState('thinking');

            if (this.initialCoachFallbackTimer) {
              clearTimeout(this.initialCoachFallbackTimer);
            }
            this.initialCoachFallbackTimer = setTimeout(() => {
              if (this.activeConnection?.id !== conn.id) return;
              if (!this.sessionExpectedActive || this.userRequestedEnd) return;
              if (!this.isInitialCoachTurnPending) return;

              console.warn('[LiveStartup] Initial coach turn produced no output. Enabling learner audio as fallback.');
              this.isInitialCoachTurnPending = false;
              this.initialCoachTurnRequestSent = false;
              this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';
              this.setVoiceState('listening');
              this.notify('Il coach è pronto. Puoi parlare anche se il saluto iniziale non è partito.', 'warning');
            }, 13000);
          } else if (!this.isInitialCoachTurnPending) {
            this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';
            this.setVoiceState('listening');
          }

          this.updateDiagnostics({});
          return;
        }

        if (msg.type === 'initial_coach_turn_accepted') {
          console.log(`[LiveHandoff] Initial coach turn accepted on active connection ${conn.id} for transition #${conn.transitionId}`);
          this.initialCoachTurnAccepted = true;
          if (this.voiceSessionState !== 'speaking') {
            this.setVoiceState('thinking');
          }
          return;
        }

        if (msg.type === 'session_resumption_update') {
          if (msg.hasHandle !== undefined) {
            this.resumptionHandleAvailable = Boolean(msg.hasHandle);
            this.lastResumableState = Boolean(msg.hasHandle);
          }
          this.updateDiagnostics({});
          return;
        }

        if (msg.type === 'go_away') {
          this.goAwayCount++;
          if (msg.timeLeft) {
            this.lastGoAwayTimeLeft = String(msg.timeLeft);
          }
          this.notify('Chiusura imminente della sessione da parte del server, riconnessione in corso…', 'warning');
          if (this.sessionExpectedActive && !this.userRequestedEnd) {
            this.handleTechnicalDisconnect('GoAway dal server');
          }
          return;
        }

        if (msg.type === 'history_fallback_executed') {
          this.historyFallbackExecuted = true;
          if (msg.messageCount) {
            this.reinjectedMessageCount = msg.messageCount;
          }
          this.updateDiagnostics({});
          return;
        }

        if (msg.type === 'teacher_turn_started' || msg.type === 'audio' || msg.type === 'teacher_transcript') {
          if (this.initialCoachFallbackTimer && msg.type === 'audio') {
            clearTimeout(this.initialCoachFallbackTimer);
            this.initialCoachFallbackTimer = null;
          }
          if (msg.type === 'teacher_turn_started') {
            const turnId = msg.teacherTurnId || `turn_${Date.now()}_${++this.teacherTurnSeq}`;
            this.currentTeacherTurnId = turnId;
            this.teacherTurnAudioReceived = false;
            this.teacherTurnTextReceived = false;
            this.teacherPlaybackActive = false;
            this.resetBargeInState('monitoring');
            if (!this.teacherAudioWatchdogTimer) {
              this.pendingTeacherActionPrompt = 'Respond naturally to the learner’s latest turn in the current active activity. Produce a complete spoken response.';
              this.pendingTeacherTransitionId = Number(msg.transitionId ?? conn.transitionId ?? 0);
              this.teacherTurnRetryCount = 0;
              this.armTeacherAudioWatchdog();
            }
            // Give late ASR chunks a short window before committing the learner turn.
            this.scheduleUserTranscriptFinalization(320);
            return;
          }

          if (msg.type === 'audio') {
            if (msg.teacherTurnId && this.interruptedTeacherTurnIds.has(msg.teacherTurnId)) {
              if (Boolean((import.meta as any).env?.DEV)) {
                console.log(`[BargeIn] Rejected late audio chunk for interrupted turn ${msg.teacherTurnId}`);
              }
              return;
            }
            if (this.bargeInState.status === 'interrupting_teacher' || this.bargeInState.status === 'capturing_user') {
              if (Boolean((import.meta as any).env?.DEV)) {
                console.log('[BargeIn] Rejected teacher audio chunk arriving during barge-in capturing');
              }
              return;
            }

            this.teacherPlaybackActive = true;
            this.markTeacherAudioReceived(conn.id);
            this.armTeacherStreamStallWatchdog();
            this.scheduleUserTranscriptFinalization(240);
            if (this.voiceSessionState !== 'speaking') {
              this.setVoiceState('speaking');
            }
            this.playAudioChunk(msg.data);
            return;
          } else if (msg.type === 'teacher_transcript') {
            if (msg.teacherTurnId && this.interruptedTeacherTurnIds.has(msg.teacherTurnId)) {
              if (Boolean((import.meta as any).env?.DEV)) {
                console.log(`[BargeIn] Rejected late transcript for interrupted turn ${msg.teacherTurnId}`);
              }
              return;
            }
            if (this.bargeInState.status === 'interrupting_teacher' || this.bargeInState.status === 'capturing_user') {
              return;
            }

            this.scheduleUserTranscriptFinalization(240);
            this.armTeacherStreamStallWatchdog();
            this.teacherTurnTextReceived = true;
            this.teacherAccumulatedText = this.appendTranscriptChunk(this.teacherAccumulatedText, msg.text);
            this.updateDiagnostics({
              outputTranscriptionCount: this.outputTranscriptionCount + 1,
              lastOutputTranscription: this.teacherAccumulatedText,
            });
            if (this.options?.onTeacherTranscript) {
              this.options.onTeacherTranscript(this.teacherAccumulatedText, false);
            }
            return;
          }
        } else if (msg.type === 'user_transcript') {
          this.clearUserTranscriptFinalizeTimer();
          this.userAccumulatedText = this.appendTranscriptChunk(this.userAccumulatedText, msg.text);
          this.bargeInState.status = 'idle';
          this.updateDiagnostics({
            inputTranscriptionCount: this.inputTranscriptionCount + 1,
            lastInputTranscription: this.userAccumulatedText,
          });
          if (this.options?.onUserTranscript) {
            this.options.onUserTranscript(this.userAccumulatedText, false);
          }
          // Commit shortly after the latest ASR chunk instead of waiting for the
          // model to begin an obsolete response. This lets the app orchestrator
          // route activity/topic choices before coach output advances.
          this.scheduleUserTranscriptFinalization(400);
        } else if (msg.type === 'interrupted' || msg.type === 'teacher_turn_interrupted') {
          this.clearTeacherAudioWatchdog();
          this.clearTeacherStreamStallWatchdog();
          this.teacherPlaybackActive = false;
          this.stopAudioPlayback();
          this.teacherAccumulatedText = '';
          if (this.options?.onTeacherTranscript) {
            this.options.onTeacherTranscript('', false);
          }
          this.setVoiceState('listening');
        } else if (msg.type === 'turnComplete' || msg.type === 'teacher_turn_completed') {
          if (msg.teacherTurnId && this.interruptedTeacherTurnIds.has(msg.teacherTurnId)) {
            if (Boolean((import.meta as any).env?.DEV)) {
              console.log(`[BargeIn] Rejected turnComplete for interrupted turn ${msg.teacherTurnId}`);
            }
            return;
          }

          if (!this.teacherTurnAudioReceived) {
            this.finalizeUserTranscript();
            this.retryTeacherTurnForMissingAudio(
              this.teacherTurnTextReceived ? 'transcript_without_audio' : 'turn_complete_without_audio'
            );
            return;
          }

          this.clearTeacherAudioWatchdog();
          this.clearTeacherStreamStallWatchdog();
          this.teacherPlaybackActive = false;
          this.resetBargeInState('idle');

          this.finalizeUserTranscript();
          if (this.teacherAccumulatedText.trim()) {
            if (this.options?.onTeacherTranscript) {
              this.options.onTeacherTranscript(this.teacherAccumulatedText.trim(), true);
            }
            this.teacherAccumulatedText = '';
          }

          if (this.isInitialCoachTurnPending) {
            this.isInitialCoachTurnPending = false;
            this.initialCoachTurnRequestSent = false;
            this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';
          }

          const remainingMs = this.outputAudioCtx ? Math.max(0, (this.nextPlayTime - this.outputAudioCtx.currentTime) * 1000) : 0;
          setTimeout(() => {
            if (this.activeConnection?.id !== conn.id) return;
            if (!this.sessionExpectedActive) return;
            if (this.voiceSessionState === 'speaking' || this.voiceSessionState === 'thinking') {
              this.setVoiceState('listening');
            }
          }, remainingMs);
        } else if (msg.type === 'initial_coach_turn_failed') {
          console.error('Initial coach turn failed:', msg.error);
          if (this.initialCoachFallbackTimer) {
            clearTimeout(this.initialCoachFallbackTimer);
            this.initialCoachFallbackTimer = null;
          }
          this.isInitialCoachTurnPending = false;
          this.initialCoachTurnRequestSent = false;
          this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';
          this.setVoiceState('listening');
          this.notify('Il saluto iniziale non è partito, ma il microfono è attivo. Puoi parlare.', 'warning');
        } else if (msg.type === 'error') {
          console.error('Active Gemini Live WS error:', msg.error);
          if (this.sessionExpectedActive && !this.userRequestedEnd) {
            this.handleTechnicalDisconnect('Errore dal server Gemini Live');
          } else {
            this.setVoiceState('error');
          }
        }
      } catch (e) {
        console.error('Error handling active message:', e);
      }
    };

    conn.ws.onerror = (err) => {
      if (this.activeConnection?.id !== conn.id) return;
      if (this.initialSetupWatchdogTimer) {
        clearTimeout(this.initialSetupWatchdogTimer);
        this.initialSetupWatchdogTimer = null;
      }
      console.error('Active WebSocket error:', err);
      if (this.sessionExpectedActive && !this.userRequestedEnd) {
        this.handleTechnicalDisconnect('Errore di connessione WebSocket');
      } else {
        this.setVoiceState('error');
      }
    };

    conn.ws.onclose = () => {
      if (this.activeConnection?.id !== conn.id) return;
      if (this.initialSetupWatchdogTimer) {
        clearTimeout(this.initialSetupWatchdogTimer);
        this.initialSetupWatchdogTimer = null;
      }
      console.warn('Active WebSocket closed');
      if (this.sessionExpectedActive && !this.userRequestedEnd) {
        this.handleTechnicalDisconnect('Connessione WebSocket chiusa');
      } else {
        this.setVoiceState('idle');
      }
    };
  }

  private handlePendingFailure(transitionId: number, reason: string, resolve: (val: boolean) => void) {
    if (this.currentTransition.id !== transitionId) return;

    if (this.setupTimeoutTimer) {
      clearTimeout(this.setupTimeoutTimer);
      this.setupTimeoutTimer = null;
    }

    if (this.currentTransition.retryCount < 1) {
      console.warn(`[LiveHandoff] Pending connection failure on transition #${transitionId}: ${reason}. Retrying (attempt 1)...`);
      this.currentTransition.retryCount++;
      this.preparePendingConnection(transitionId, this.currentTransition.options).then(resolve);
    } else {
      console.error(`[LiveHandoff] Pending connection second failure on transition #${transitionId}: ${reason}. Rolling back.`);
      this.handleTransitionRollback(transitionId, reason);
      resolve(false);
    }
  }

  private handleSetupTimeout(transitionId: number, resolve: (val: boolean) => void) {
    if (this.currentTransition.id !== transitionId || this.currentTransition.status !== 'pending_setup') return;

    console.warn(`[LiveHandoff] Setup timeout (8s) on transition #${transitionId}.`);
    if (this.pendingConnection) {
      try {
        this.pendingConnection.ws.close();
      } catch (e) {}
      this.pendingConnection = null;
    }

    if (this.currentTransition.retryCount < 1) {
      console.warn(`[LiveHandoff] Retrying pending setup for transition #${transitionId}...`);
      this.currentTransition.retryCount++;
      this.preparePendingConnection(transitionId, this.currentTransition.options).then(resolve);
    } else {
      console.error(`[LiveHandoff] Setup timeout second failure for transition #${transitionId}. Rolling back.`);
      this.handleTransitionRollback(transitionId, 'Timeout durante l’avvio dell’attività');
      resolve(false);
    }
  }

  private handleInitialTurnTimeout(transitionId: number, options: any) {
    if (this.currentTransition.id !== transitionId || this.currentTransition.status !== 'waiting_for_initial_turn') return;

    console.warn(`[LiveHandoff] Initial turn timeout (8s) on transition #${transitionId}.`);

    if (this.currentTransition.retryCount < 1) {
      console.warn(`[LiveHandoff] Retrying request_initial_coach_turn for transition #${transitionId}...`);
      this.currentTransition.retryCount++;

      if (this.activeConnection?.ws.readyState === WebSocket.OPEN) {
        this.activeConnection.ws.send(JSON.stringify({
          type: 'request_initial_coach_turn',
          appSessionId: this.appSessionId,
          sessionStartReason: 'activity_switch',
          transitionId,
          initialActionPrompt: options.initialActionPrompt || this.initialActionPrompt,
        }));

        this.initialTurnTimeoutTimer = setTimeout(() => {
          if (this.currentTransition.id === transitionId && this.currentTransition.status === 'waiting_for_initial_turn') {
            console.error(`[LiveHandoff] Initial turn timeout second failure for transition #${transitionId}. Rolling back.`);
            this.handleTransitionRollback(transitionId, 'Nessuna risposta dal coach');
          }
        }, 12000);
      } else {
        this.handleTransitionRollback(transitionId, 'Connessione attiva interrotta durante il prompt iniziale');
      }
    } else {
      this.handleTransitionRollback(transitionId, 'Nessuna risposta dal coach al secondo tentativo');
    }
  }

  private handleTransitionRollback(transitionId: number, reason: string) {
    if (this.currentTransition.id !== transitionId) return;

    this.clearTransitionTimers();
    this.currentTransition.status = 'failed';

    console.error(`[LiveHandoff] Transition #${transitionId} failed: ${reason}`);

    if (this.pendingConnection) {
      try {
        this.pendingConnection.ws.close();
      } catch (e) {}
      this.pendingConnection = null;
    }

    if (this.activeConnection && this.activeConnection.ws.readyState === WebSocket.OPEN) {
      this.micOutboundEnabled = this.turnMode !== 'tap_to_talk';
      this.setVoiceState('listening');
    } else {
      this.micOutboundEnabled = false;
      this.setVoiceState('idle');
    }

    this.notify('Non sono riuscito ad avviare la nuova attività. Puoi riprovare senza terminare la sessione.', 'warning');
  }

  private clearTransitionTimers() {
    if (this.initialSetupWatchdogTimer) {
      clearTimeout(this.initialSetupWatchdogTimer);
      this.initialSetupWatchdogTimer = null;
    }
    if (this.setupTimeoutTimer) {
      clearTimeout(this.setupTimeoutTimer);
      this.setupTimeoutTimer = null;
    }
    if (this.initialTurnTimeoutTimer) {
      clearTimeout(this.initialTurnTimeoutTimer);
      this.initialTurnTimeoutTimer = null;
    }
    if (this.initialCoachFallbackTimer) {
      clearTimeout(this.initialCoachFallbackTimer);
      this.initialCoachFallbackTimer = null;
    }
  }

  private handleTechnicalDisconnect(reason: string) {
    if (this.userRequestedEnd || !this.sessionExpectedActive) return;

    this.clearTeacherStreamStallWatchdog();
    this.closureReason = `Chiusura temporanea: ${reason}`;
    this.stopAudioPlayback();
    this.teacherPlaybackActive = false;
    this.micOutboundEnabled = false;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setVoiceState('reconnecting');
      this.notify('Connessione internet assente', 'warning');
      return;
    }

    this.reconnectAttempt++;
    if (this.reconnectAttempt > 6) {
      this.setVoiceState('error');
      this.notify('Non sono riuscito a ripristinare automaticamente la sessione', 'error');
      return;
    }

    this.setVoiceState('reconnecting');
    this.notify('Riconnessione…', 'info');

    const delay = Math.min(8000, 500 * Math.pow(2, this.reconnectAttempt - 1));

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.sessionExpectedActive && !this.userRequestedEnd) {
        this.connectFreshWebSocket();
      }
    }, delay);
  }

  public async reconnectSession(reason?: string): Promise<boolean> {
    if (reason) this.closureReason = reason;
    this.reconnectAttempt = 0;
    return this.connectFreshWebSocket();
  }

  private resampleTo16k(inputData: Float32Array, inputSampleRate: number): Float32Array {
    if (inputSampleRate === 16000) return inputData;
    const ratio = inputSampleRate / 16000;
    const newLength = Math.floor(inputData.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const originPos = i * ratio;
      const index = Math.floor(originPos);
      const fraction = originPos - index;
      const nextIndex = Math.min(index + 1, inputData.length - 1);
      result[i] = inputData[index] * (1 - fraction) + inputData[nextIndex] * fraction;
    }
    return result;
  }

  private startMicProcessing() {
    if (!this.inputAudioCtx || !this.mediaStream) return;

    try {
      if (this.micProcessingWatchdogTimer) {
        clearTimeout(this.micProcessingWatchdogTimer);
        this.micProcessingWatchdogTimer = null;
      }
      if (this.mediaStreamSource) {
        try { this.mediaStreamSource.disconnect(); } catch (e) {}
        this.mediaStreamSource = null;
      }
      if (this.scriptProcessor) {
        try {
          this.scriptProcessor.disconnect();
        } catch (e) {}
        this.scriptProcessor = null;
      }
      if (this.silentInputGain) {
        try { this.silentInputGain.disconnect(); } catch (e) {}
        this.silentInputGain = null;
      }

      const nativeRate = this.inputAudioCtx.sampleRate;
      this.mediaStreamSource = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      const bufferSize = 2048;
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(bufferSize, 1, 1);
      this.silentInputGain = this.inputAudioCtx.createGain();
      this.silentInputGain.gain.value = 0;

      this.mediaStreamSource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.silentInputGain);
      this.silentInputGain.connect(this.inputAudioCtx.destination);

      this.lastMicAudioProcessAt = 0;
      let totalChunkBytes = 0;
      let chunkCount = 0;

      this.micProcessingWatchdogTimer = setTimeout(() => {
        if (!this.sessionExpectedActive || this.userRequestedEnd) return;
        if (this.lastMicAudioProcessAt > 0) return;

        console.error('[Mic] No audio processing callback received after startup.');
        this.notify('Il microfono è autorizzato ma non sta inviando audio. Riapri la preview in una nuova scheda e controlla il dispositivo selezionato.', 'error');
        this.setVoiceState('error');
      }, 2500);

      this.scriptProcessor.onaudioprocess = (e) => {
        this.lastMicAudioProcessAt = Date.now();
        if (this.micProcessingWatchdogTimer) {
          clearTimeout(this.micProcessingWatchdogTimer);
          this.micProcessingWatchdogTimer = null;
        }
        const socket = this.activeConnection?.ws;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        if (this.voiceSessionState === 'reconnecting' || !this.sessionExpectedActive) return;

        this.micCaptureActive = true;
        this.localVadEnabled = true;

        const rawInputData = e.inputBuffer.getChannelData(0);

        let sumSq = 0;
        for (let i = 0; i < rawInputData.length; i++) {
          sumSq += rawInputData[i] * rawInputData[i];
        }
        const rms = Math.sqrt(sumSq / rawInputData.length);
        if (this.options?.onVolumeChange) {
          this.options.onVolumeChange(Math.min(1.0, rms * 5));
        }

        const now = Date.now();
        const resampledData = this.resampleTo16k(rawInputData, nativeRate);
        const pcm16 = new Int16Array(resampledData.length);
        for (let i = 0; i < resampledData.length; i++) {
          const s = Math.max(-1, Math.min(1, resampledData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const binary = String.fromCharCode(...new Uint8Array(pcm16.buffer));
        const base64Audio = btoa(binary);

        // Maintain rolling microphone buffer (last 800ms) to avoid losing utterance start on barge-in
        this.rollingMicBuffer.push({ data: base64Audio, timestamp: now });
        this.rollingMicBuffer = this.rollingMicBuffer.filter((item) => now - item.timestamp <= 800);

        const isBusy =
          this.isInitialCoachTurnPending ||
          !this.activeModelSetupComplete ||
          this.isReconnecting ||
          (this.currentTransition.status !== 'idle' && this.currentTransition.status !== 'completed');

        const isTeacherSpeaking = this.teacherPlaybackActive || this.voiceSessionState === 'speaking';

        // Local VAD & Barge-in detection during coach speech
        if (isTeacherSpeaking && !isBusy && this.turnMode !== 'tap_to_talk') {
          this.bargeInEnabled = true;
          // Higher threshold + longer sustained-speech requirement than before: the old
          // values (0.025/120ms) triggered on ordinary room noise or the coach's own
          // voice bleeding back into the mic, causing spurious self-interruptions.
          const rmsThreshold = this.turnMode === 'noise_resistant' ? 0.06 : 0.045;
          const minSpeechDurationMs = this.turnMode === 'noise_resistant' ? 280 : 220;

          if (rms > rmsThreshold) {
            if (this.bargeInState.status === 'idle' || this.bargeInState.status === 'monitoring') {
              this.bargeInState.status = 'candidate_speech';
              this.bargeInState.candidateStartedAt = now;
              if (Boolean((import.meta as any).env?.DEV)) {
                console.log(`[BargeIn] Candidate speech detected (rms=${rms.toFixed(3)}, threshold=${rmsThreshold}, mode=${this.turnMode})`);
              }
            } else if (this.bargeInState.status === 'candidate_speech') {
              const dur = now - (this.bargeInState.candidateStartedAt || now);
              if (dur >= minSpeechDurationMs) {
                if (Boolean((import.meta as any).env?.DEV)) {
                  console.log(`[BargeIn] Speech confirmed! Duration: ${dur}ms. Executing barge-in...`);
                }
                this.handleConfirmedBargeIn({ teacherTurnId: this.currentTeacherTurnId || undefined, reason: 'vad_barge_in' });
              }
            }
          } else {
            if (this.bargeInState.status === 'candidate_speech') {
              this.bargeInState.status = 'monitoring';
              this.bargeInState.candidateStartedAt = undefined;
            }
          }
        } else {
          this.bargeInEnabled = false;
        }

        if (rms > 0.04) {
          this.isUserSpeakingActive = true;
          if (this.voiceSessionState === 'thinking' && this.turnMode === 'automatic') {
            this.setVoiceState('listening');
          }
        } else {
          this.isUserSpeakingActive = false;
        }

        // Outbound sending check
        // Mic audio is MUTED toward Gemini while the coach is speaking. This
        // prevents the coach's own voice bleeding back through the mic from
        // triggering Gemini's native VAD, which would cause spurious
        // self-interruptions (the "starts, stops, restarts" stutter).
        // Barge-in is handled locally: when the local VAD confirms real user
        // speech, handleConfirmedBargeIn flushes the rolling buffer to Gemini,
        // which triggers Gemini's VAD with actual speech.
        const canSendAudio =
          this.turnMode === 'tap_to_talk'
            ? this.manualTurnActive && this.micOutboundEnabled
            : this.micOutboundEnabled && !isTeacherSpeaking;

        if (!canSendAudio) {
          return;
        }

        totalChunkBytes += pcm16.byteLength;
        chunkCount++;
        if (chunkCount % 10 === 0) {
          this.updateDiagnostics({
            avgChunkSizeBytes: Math.round(totalChunkBytes / chunkCount),
          });
        }

        socket.send(
          JSON.stringify({
            type: 'audio',
            data: base64Audio,
          })
        );
      };
    } catch (err) {
      console.error('Error starting mic processing:', err);
    }
  }

  private playAudioChunk(base64Pcm: string) {
    if (!this.outputAudioCtx) return;

    if (this.outputAudioCtx.state === 'suspended') {
      this.outputAudioCtx.resume().catch((err) => {
        console.warn('[AudioOutput] Error resuming output AudioContext:', err);
      });
    }

    try {
      const binaryString = atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioCtx.destination);

      const now = this.outputAudioCtx.currentTime;
      if (this.nextPlayTime < now) {
        this.nextPlayTime = now;
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.activeSourceNodes.push(source);

      source.onended = () => {
        this.activeSourceNodes = this.activeSourceNodes.filter((s) => s !== source);
        if (this.activeSourceNodes.length === 0 && this.outputAudioCtx!.currentTime >= this.nextPlayTime - 0.05) {
          this.sentAudioStreamEnd = false;
          // Only re-enable mic and transition to listening if the teacher turn
          // is actually complete. If teacherPlaybackActive is still true, more
          // audio chunks may arrive after a network gap — re-enabling the mic
          // prematurely lets Gemini hear its own audio and self-interrupt.
          if (!this.teacherPlaybackActive) {
            if (this.turnMode !== 'tap_to_talk') this.micOutboundEnabled = true;
            if (this.voiceSessionState === 'speaking') {
              this.setVoiceState('listening');
            }
          }
        }
      };
    } catch (err) {
      console.error('Error playing audio chunk:', err);
    }
  }

  public interruptTeacher() {
    const teacherIsActive = this.teacherPlaybackActive || this.voiceSessionState === 'speaking';
    if (!teacherIsActive) return;
    this.handleConfirmedBargeIn({
      teacherTurnId: this.currentTeacherTurnId || undefined,
      reason: 'manual_interrupt',
    });
  }

  public stopAudioPlayback() {
    for (const source of this.activeSourceNodes) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    }
    this.activeSourceNodes = [];
    this.nextPlayTime = 0;
  }

  public async resumeAudioContext(): Promise<void> {
    if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
      try {
        await this.outputAudioCtx.resume();
        console.log('[AudioOutput] Explicitly resumed output AudioContext');
      } catch (e) {
        console.warn('[AudioOutput] Failed to resume output AudioContext:', e);
      }
    }
    if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {
      try {
        await this.inputAudioCtx.resume();
      } catch (e) {}
    }
  }

  public terminateSession() {
    this.clearTeacherAudioWatchdog();
    this.clearTeacherStreamStallWatchdog();
    this.userRequestedEnd = true;
    this.sessionExpectedActive = false;
    this.clearTransitionTimers();

    screenWakeLockManager.releaseWakeLock();
    clearActiveSessionState();

    this.micOutboundEnabled = false;

    const socket = this.activeConnection?.ws;
    if (this.manualTurnActive && socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: 'activity_end' }));
      } catch (e) {}
    }
    this.manualTurnActive = false;
    this.sentAudioStreamEnd = false;

    this.stopAudioPlayback();

    // Explicit termination discards partial turns. It must not create new visible messages
    // after the user has chosen to clear the session.
    this.clearUserTranscriptFinalizeTimer();
    this.userAccumulatedText = '';
    this.teacherAccumulatedText = '';
    this.options?.onUserTranscript?.('', false);
    this.options?.onTeacherTranscript?.('', false);

    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: 'session_end' }));
        this.sessionEndSent = true;
      } catch (e) {}
    }

    if (this.micProcessingWatchdogTimer) {
      clearTimeout(this.micProcessingWatchdogTimer);
      this.micProcessingWatchdogTimer = null;
    }
    if (this.mediaStreamSource) {
      try { this.mediaStreamSource.disconnect(); } catch (e) {}
      this.mediaStreamSource = null;
    }
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch (e) {}
      this.scriptProcessor = null;
    }
    if (this.silentInputGain) {
      try { this.silentInputGain.disconnect(); } catch (e) {}
      this.silentInputGain = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.mediaStream = null;
    }

    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch (e) {}
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch (e) {}
      this.outputAudioCtx = null;
    }

    if (this.activeConnection) {
      try {
        this.activeConnection.ws.onopen = null;
        this.activeConnection.ws.onmessage = null;
        this.activeConnection.ws.onerror = null;
        this.activeConnection.ws.onclose = null;
        this.activeConnection.ws.close();
      } catch (e) {}
      this.activeConnection = null;
    }

    if (this.pendingConnection) {
      try {
        this.pendingConnection.ws.onopen = null;
        this.pendingConnection.ws.onmessage = null;
        this.pendingConnection.ws.onerror = null;
        this.pendingConnection.ws.onclose = null;
        this.pendingConnection.ws.close();
      } catch (e) {}
      this.pendingConnection = null;
    }

    this.closureReason = 'Chiusura volontaria da pulsante Termina sessione';
    this.setVoiceState('idle');
  }

  public stopSession() {
    this.terminateSession();
  }

  public updateRecentHistory(messages: Array<{ sender: 'user' | 'coach'; text: string }>): void {
    if (!this.options) return;
    this.options.recentHistory = (Array.isArray(messages) ? messages : [])
      .filter((message) => message && (message.sender === 'user' || message.sender === 'coach') && String(message.text || '').trim())
      .slice(-40)
      .map((message) => ({ sender: message.sender, text: String(message.text).trim() }));
    this.persistCurrentState();
  }

  public sendTextMessage(text: string): boolean {
    const socket = this.activeConnection?.ws;
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: 'text', text }));
        return true;
      } catch (e) {
        console.warn('[Engine] Error sending text message:', e);
        return false;
      }
    }
    return false;
  }
}

export const geminiLiveEngine = new GeminiLiveEngine();
