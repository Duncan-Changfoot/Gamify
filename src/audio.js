// Every sound is synthesised, so there are no audio files to download or cache.

// Each note: [start Hz, end Hz, seconds, wave, delay, volume]
const SOUNDS = {
  tap: [[660, 880, 0.06, 'sine', 0, 0.25]],
  pop: [[900, 180, 0.14, 'triangle', 0, 0.5]],
  coin: [[988, 988, 0.07, 'square', 0, 0.12], [1319, 1319, 0.2, 'square', 0.07, 0.12]],
  bump: [[180, 50, 0.3, 'sawtooth', 0, 0.25]],
  wrong: [[330, 200, 0.3, 'triangle', 0, 0.4]],
  flip: [[500, 900, 0.07, 'sine', 0, 0.3]],
  jump: [[280, 760, 0.16, 'square', 0, 0.08]],
  win: [
    [523, 523, 0.12, 'triangle', 0, 0.4], [659, 659, 0.12, 'triangle', 0.12, 0.4],
    [784, 784, 0.12, 'triangle', 0.24, 0.4], [1047, 1047, 0.4, 'triangle', 0.36, 0.4],
  ],
};

let ctx = null;
let master = null;
let primed = false;

// Browsers only allow sound and speech that starts inside a tap, so this runs in the pointerdown handler.
export function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!ctx && AC) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    // iOS: keep playing when the ring/silent switch is on.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  if (!primed && 'speechSynthesis' in window) {
    primed = true;
    speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  }
}

export function sound(name) {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  for (const [f0, f1, dur, wave, delay, vol] of SOUNDS[name]) {
    const t = now + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env);
    env.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

// No voice is chosen by name: iOS lists joke voices ("Bad News", "Bubbles") among the English ones,
// and the language's default voice is always a normal one.
const lang = navigator.language && navigator.language.startsWith('en') ? navigator.language : 'en-GB';

export function say(words) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(words);
  u.lang = lang;
  u.rate = 0.9;
  u.pitch = 1.15;
  speechSynthesis.speak(u);
}

export function hush() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
