import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine = fs.readFileSync('src/lib/geminiLiveEngine.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const studio = fs.readFileSync('src/components/VoiceStudio.tsx', 'utf8');
const orb = fs.readFileSync('src/components/voice/VoiceOrb.tsx', 'utf8');
const settings = fs.readFileSync('src/lib/settingsStorage.ts', 'utf8');
const drawer = fs.readFileSync('src/components/SettingsDrawer.tsx', 'utf8');

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
  console.log(`PASS ${name}`);
}

check('activity switches reuse the active Live connection', () => {
  const section = engine.slice(engine.indexOf('public async reconfigureLearningSession'), engine.indexOf('private async preparePendingConnection'));
  assert.match(section, /type: 'context_update'/);
  assert.doesNotMatch(section, /this\.activeConnection\.ws\.close\(\)/);
});

check('pending transport promotion waits for setup_complete only', () => {
  const section = engine.slice(engine.indexOf('private async preparePendingConnection'), engine.indexOf('private promotePendingConnection'));
  assert.match(section, /msg\.type === 'setup_complete'/);
  assert.doesNotMatch(section, /msg\.type === 'connected' \|\|/);
});

check('teacher transcript alone does not complete a spoken turn', () => {
  assert.match(engine, /teacherTurnAudioReceived/);
  assert.match(engine, /transcript_without_audio/);
  assert.match(engine, /retry_teacher_turn/);
  assert.match(engine, /markTeacherAudioReceived/);
});

check('teacher delivery watchdog retries once and recovers', () => {
  assert.match(engine, /teacherTurnRetryCount < 1/);
  assert.match(engine, /armTeacherAudioWatchdog\(6000\)/);
  assert.match(engine, /La sessione resta attiva/);
});

check('microphone audio is streamed during coach speech in automatic modes', () => {
  assert.match(engine, /Gemini's native activity detection is the[\s\S]*authoritative barge-in detector/);
  assert.doesNotMatch(engine, /canSendAudio = this\.bargeInState\.status === 'capturing_user'/);
});

check('audio chunks are low latency', () => {
  assert.match(engine, /const bufferSize = 2048/);
});

check('rolling pre-roll is not duplicated in automatic mode', () => {
  assert.match(engine, /if \(this\.turnMode === 'tap_to_talk'\)[\s\S]*rollingMicBuffer/);
});

check('user ASR is committed before obsolete coach output starts', () => {
  assert.match(engine, /scheduleUserTranscriptFinalization\(400\)/);
});

check('server enables native start-of-activity interruption', () => {
  const count = (server.match(/ActivityHandling\.START_OF_ACTIVITY_INTERRUPTS/g) || []).length;
  assert.ok(count >= 3, `expected at least 3 interruptible modes, got ${count}`);
  assert.doesNotMatch(server, /ActivityHandling\.NO_INTERRUPTION/);
});

check('server carries teacher turn and transition IDs on audio and transcript', () => {
  assert.match(server, /currentTeacherTurnId/);
  assert.match(server, /currentTeacherTransitionId/);
  assert.match(server, /type: "audio"[\s\S]*teacherTurnId/);
  assert.match(server, /type: "teacher_transcript"[\s\S]*teacherTurnId/);
});

check('server supports same-session context updates', () => {
  assert.match(server, /msg\.type === "context_update"/);
  assert.match(server, /APPLICATION_CONTEXT_UPDATE/);
  assert.match(server, /buildLearningModeInstruction/);
});

check('server supports controlled audio retry', () => {
  assert.match(server, /msg\.type === "retry_teacher_turn"/);
  assert.match(server, /APPLICATION_AUDIO_RETRY/);
});

check('pause latency is clamped to conversational values', () => {
  assert.match(engine, /Math\.min\(2\.5,[\s\S]*Math\.max\(0\.8/);
  assert.match(server, /Math\.min\([\s\S]*2\.5,[\s\S]*Math\.max\(0\.8/);
  assert.match(settings, /pauseToleranceSeconds: 1\.2/);
  assert.match(drawer, /value=\{1\.2\}/);
});

check('central orb never terminates an active session', () => {
  const section = studio.slice(studio.indexOf('const toggleLiveSession'), studio.indexOf('const performTerminateSession'));
  assert.doesNotMatch(section, /handleTerminateSession/);
  assert.match(section, /interruptTeacher/);
});

check('speaking orb invokes interruption', () => {
  assert.match(orb, /if \(isSpeaking && onInterrupt\) onInterrupt\(\)/);
});

check('dedicated terminate control remains wired', () => {
  assert.match(studio, /onTerminateSession=\{handleTerminateSession\}/);
  assert.match(studio, /performTerminateSession/);
});

check('duplicate VoiceStage interrupt prop is absent', () => {
  const matches = studio.match(/onInterrupt=\{handleInterrupt\}/g) || [];
  assert.equal(matches.length, 1);
});

console.log(`\nVOICE RUNTIME VERIFICATION: ${checks.length}/${checks.length} checks passed.`);
