'use strict';

// Sound effects and background music, synthesized at runtime with the Web
// Audio API — no audio files, the same way sprites.js draws every picture
// from code. Each sound is a few short oscillator tones and/or filtered
// noise bursts (see SOUNDS), kept brief and quiet so they don't grate on the
// hundredth step. The music (see MUSIC_THEMES) is a faint looping tune with
// its own key, tempo and instruments for the menus and for each world.
//
// Browsers only let a page make sound after the player has interacted with
// it, so the AudioContext is created (or resumed) on the first key press,
// click or touch. Until then, and whenever the game is muted, playSound()
// does nothing, and no music plays. The mute setting (sound and music
// together) is a per-device preference kept in localStorage (MUTE_KEY); it
// isn't part of the synced save.

const MUTE_KEY = 'trapRoomMuted';
// Overall loudness. Every sound's own volumes are relative to this.
const MASTER_VOLUME = 0.22;

let audioCtx = null;
let masterGain = null;
let noiseBuffer = null;

function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function setMuted(muted) {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch (e) {
    // best-effort, like every other setting
  }
  updateMusic();
}

// Creates or wakes the AudioContext. Safe to call on every gesture.
function unlockAudio() {
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!Ctx) return;
  if (!audioCtx) {
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = MASTER_VOLUME;
    masterGain.connect(audioCtx.destination);
    // One second of white noise, reused by every noise burst.
    noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (audioCtx.state === 'suspended' && !document.hidden) audioCtx.resume();
  updateMusic();
}

if (typeof document !== 'undefined') {
  ['keydown', 'pointerdown', 'touchstart'].forEach((type) => {
    document.addEventListener(type, unlockAudio, { capture: true, passive: true });
  });
  // Go quiet in a background tab (timers there are throttled, which would
  // make the music stumble anyway), and pick up again on return.
  document.addEventListener('visibilitychange', () => {
    if (!audioCtx) return;
    if (document.hidden) audioCtx.suspend();
    else audioCtx.resume();
  });
}

// A quick attack then an exponential fade to silence over `dur` seconds.
function envelope(gainNode, at, vol, dur) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, at);
  g.exponentialRampToValueAtTime(vol, at + Math.min(0.01, dur / 4));
  g.exponentialRampToValueAtTime(0.0001, at + dur);
}

// One oscillator note: `freq` Hz (gliding to `to` Hz if given) for `dur`
// seconds, starting `delay` seconds from now.
function tone({ freq, to = null, dur = 0.1, type = 'square', vol = 0.3, delay = 0 }) {
  const at = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  envelope(gain, at, vol, dur);
  osc.connect(gain).connect(masterGain);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

// A burst of filtered noise: `filter` is a BiquadFilter type, centred on
// `freq` Hz (sweeping to `to` Hz if given).
function noise({ freq = 1000, to = null, filter = 'bandpass', dur = 0.1, vol = 0.3, delay = 0, q = 1 }) {
  const at = audioCtx.currentTime + delay;
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;
  const biquad = audioCtx.createBiquadFilter();
  biquad.type = filter;
  biquad.Q.value = q;
  biquad.frequency.setValueAtTime(freq, at);
  if (to) biquad.frequency.exponentialRampToValueAtTime(to, at + dur);
  const gain = audioCtx.createGain();
  envelope(gain, at, vol, dur);
  src.connect(biquad).connect(gain).connect(masterGain);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

// Arpeggio helper: each frequency in turn, `step` seconds apart.
function arpeggio(freqs, { step = 0.07, dur = 0.12, type = 'triangle', vol = 0.3 } = {}) {
  freqs.forEach((freq, k) => tone({ freq, dur, type, vol, delay: k * step }));
}

let stepToggle = false;

// Every sound the game makes, by name.
const SOUNDS = {
  // A soft scuff, alternating pitch so a run of steps doesn't drone.
  step: () => {
    stepToggle = !stepToggle;
    noise({ freq: stepToggle ? 700 : 520, filter: 'lowpass', dur: 0.05, vol: 0.35 });
  },
  // Walking into a wall.
  bump: () => tone({ freq: 110, to: 70, dur: 0.07, type: 'square', vol: 0.18 }),
  slip: () => {
    noise({ freq: 2500, to: 6000, filter: 'highpass', dur: 0.28, vol: 0.12 });
    tone({ freq: 740, to: 440, dur: 0.22, type: 'sine', vol: 0.12 });
  },
  shove: () => noise({ freq: 300, to: 900, filter: 'lowpass', dur: 0.2, vol: 0.3 }),
  bounce: () => tone({ freq: 220, to: 720, dur: 0.16, type: 'triangle', vol: 0.3 }),
  warp: () => {
    tone({ freq: 300, to: 1400, dur: 0.18, type: 'sine', vol: 0.2 });
    tone({ freq: 1400, to: 500, dur: 0.16, type: 'sine', vol: 0.16, delay: 0.16 });
  },
  crack: () => {
    noise({ freq: 3500, filter: 'highpass', dur: 0.04, vol: 0.4 });
    noise({ freq: 2800, filter: 'highpass', dur: 0.06, vol: 0.3, delay: 0.05 });
  },
  fuse: () => noise({ freq: 5000, filter: 'bandpass', q: 3, dur: 0.3, vol: 0.18 }),
  blast: () => {
    noise({ freq: 900, to: 120, filter: 'lowpass', dur: 0.45, vol: 0.7 });
    tone({ freq: 90, to: 40, dur: 0.35, type: 'sine', vol: 0.4 });
  },
  'icicle-crack': () => tone({ freq: 1900, to: 1500, dur: 0.08, type: 'triangle', vol: 0.18 }),
  'icicle-crash': () => {
    noise({ freq: 3000, filter: 'highpass', dur: 0.25, vol: 0.4 });
    tone({ freq: 1200, to: 600, dur: 0.12, type: 'triangle', vol: 0.12 });
  },
  grab: () => noise({ freq: 700, filter: 'bandpass', q: 2, dur: 0.22, vol: 0.35 }),
  // Two clicks: the handle catching, then the latch.
  lever: () => {
    tone({ freq: 1300, dur: 0.025, type: 'square', vol: 0.18 });
    tone({ freq: 650, dur: 0.035, type: 'square', vol: 0.18, delay: 0.045 });
  },
  // A stone plate sinking, then the portcullis chains rattling.
  plate: () => {
    tone({ freq: 180, to: 120, dur: 0.1, type: 'square', vol: 0.16 });
    noise({ freq: 1800, filter: 'bandpass', q: 4, dur: 0.3, vol: 0.2, delay: 0.08 });
  },
  // A crusher hitting the floor somewhere in the room: a low thud.
  crush: () => {
    noise({ freq: 400, to: 90, filter: 'lowpass', dur: 0.22, vol: 0.28 });
    tone({ freq: 70, to: 45, dur: 0.18, type: 'sine', vol: 0.25 });
  },
  unlock: () => arpeggio([523, 659, 784, 1047], { step: 0.07, dur: 0.14 }),
  lock: () => tone({ freq: 392, to: 196, dur: 0.18, type: 'square', vol: 0.15 }),
  death: () => {
    tone({ freq: 320, to: 70, dur: 0.32, type: 'sawtooth', vol: 0.22 });
    noise({ freq: 600, filter: 'lowpass', dur: 0.15, vol: 0.3 });
  },
  win: () => arpeggio([523, 659, 784, 1047, 1319], { step: 0.09, dur: 0.22, vol: 0.28 }),
  // Story cutscenes (story.js): a page turned over, stone grinding open,
  // and a ghostly shimmer.
  page: () => {
    noise({ freq: 3200, to: 1800, filter: 'bandpass', q: 1.5, dur: 0.12, vol: 0.25 });
    noise({ freq: 2400, filter: 'bandpass', q: 1.5, dur: 0.1, vol: 0.18, delay: 0.1 });
  },
  rumble: () => {
    noise({ freq: 220, to: 90, filter: 'lowpass', dur: 1.1, vol: 0.55 });
    tone({ freq: 55, to: 40, dur: 1, type: 'sine', vol: 0.3 });
  },
  shimmer: () => arpeggio([880, 1109, 1319, 1661, 1319, 1109], { step: 0.08, dur: 0.3, type: 'sine', vol: 0.12 }),
  // A chapter badge (badges.js): a rising fanfare, then a held chord as the
  // medal lands.
  badge: () => {
    arpeggio([392, 523, 659, 784], { step: 0.1, dur: 0.18, type: 'square', vol: 0.14 });
    [523, 659, 784, 1047].forEach((freq) => tone({ freq, dur: 0.9, type: 'triangle', vol: 0.12, delay: 0.5 }));
    tone({ freq: 2093, to: 2637, dur: 0.25, type: 'sine', vol: 0.08, delay: 0.85 });
  },
  timeup: () => {
    tone({ freq: 330, dur: 0.12, type: 'square', vol: 0.18 });
    tone({ freq: 247, dur: 0.2, type: 'square', vol: 0.18, delay: 0.15 });
  },
};

function playSound(name) {
  if (!audioCtx || audioCtx.state !== 'running' || isMuted()) return;
  const sound = SOUNDS[name];
  if (sound) sound();
}

// --- Background music ------------------------------------------------------------
//
// A tiny sequencer: every eighth note it may play a bass note, a soft pad
// chord (on the first beat of each bar) and a melody note, all through
// musicGain — kept well under the sound effects (MUSIC_VOLUME). Each area
// is the same loop with its own key, scale, tempo, chords, tune and
// instruments, so the worlds sound related but distinct:
//   home  — a calm A-minor wander for the title and menus
//   lava  — darker (D phrygian), lower and a little faster
//   ice   — slow, high E-lydian chimes with an echo
//   grass — a bouncy G-major tune with a walking bass
//   castle — a slow harmonic-minor waltz
//   story — the cutscenes' slow, echoing question
// Melodies are 32 eighth-note steps (4 bars) of scale degrees (0 = the key
// note an octave above the bass; negative goes lower), null for a rest.

const MUSIC_VOLUME = 0.1;
const MINOR_PENTATONIC = [0, 3, 5, 7, 10];
const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const _ = null;

const MUSIC_THEMES = {
  home: {
    bpm: 76, root: 57, scale: MINOR_PENTATONIC,
    chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], // Am F C G
    pad: 'triangle', lead: 'sine', bass: 'sine', bassSteps: [0, 4],
    melody: [
      2, _, _, 1, 0, _, _, _, 3, _, 2, _, 1, _, _, _,
      2, _, _, 4, 3, _, _, _, 1, _, 0, _, -1, _, _, _,
    ],
  },
  lava: {
    bpm: 92, root: 50, scale: PHRYGIAN,
    chords: [[0, 'm'], [1, 'M'], [0, 'm'], [-2, 'M']], // Dm Eb Dm C
    pad: 'sawtooth', lead: 'square', bass: 'square', bassSteps: [0, 3, 4, 6], padFilter: 700, leadFilter: 1400,
    melody: [
      0, _, 1, _, 0, _, _, -1, 0, _, _, _, 2, _, 1, _,
      0, _, 1, _, 3, _, 2, _, 1, _, _, 0, -1, _, _, _,
    ],
  },
  ice: {
    bpm: 66, root: 64, scale: LYDIAN,
    chords: [[0, 'M'], [2, 'M'], [-3, 'm'], [2, 'M']], // E F# C#m F#
    pad: 'sine', lead: 'sine', bass: 'triangle', bassSteps: [0], echo: true,
    melody: [
      7, _, _, 4, _, _, 6, _, _, _, _, _, 4, _, _, _,
      9, _, _, 7, _, _, 6, _, 4, _, _, _, 3, _, _, _,
    ],
  },
  grass: {
    bpm: 104, root: 55, scale: MAJOR_PENTATONIC,
    chords: [[0, 'M'], [5, 'M'], [-3, 'm'], [7, 'M']], // G C Em D
    pad: 'triangle', lead: 'triangle', bass: 'triangle', bassSteps: [0, 2, 4, 6], walkingBass: true,
    melody: [
      0, _, 2, 3, 4, _, 3, _, 2, _, 0, _, 1, _, _, _,
      2, _, 3, 4, 5, _, 4, 3, 2, _, 1, _, 0, _, _, _,
    ],
  },
  // The castle: a slow organ-ish waltz in harmonic minor, echoing through
  // empty halls.
  castle: {
    bpm: 58, root: 50, scale: HARMONIC_MINOR,
    chords: [[0, 'm'], [-4, 'M'], [-7, 'm'], [-5, 'M']], // Dm Bb Gm A
    pad: 'sawtooth', lead: 'triangle', bass: 'sine', bassSteps: [0, 4], padFilter: 900, echo: true,
    melody: [
      4, _, _, 3, 2, _, 1, _, 2, _, _, _, 0, _, _, _,
      4, _, 5, _, 6, _, _, 5, 4, _, 3, _, 2, _, _, _,
    ],
  },
  // The story cutscenes (story.js): slow, sparse A harmonic minor with long
  // echoes — a question more than a tune.
  story: {
    bpm: 50, root: 45, scale: HARMONIC_MINOR,
    chords: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'M']], // Am F G E
    pad: 'sine', lead: 'triangle', bass: 'sine', bassSteps: [0], echo: true,
    melody: [
      4, _, _, _, _, _, 3, _, 2, _, _, _, _, _, _, _,
      4, _, _, 6, _, _, 5, _, 4, _, _, _, 3, _, _, _,
    ],
  },
};

let musicArea = null; // what should be playing (setMusic)
let playingArea = null; // what is playing
let musicGain = null;
let musicTimer = null;
let musicStep = 0;
let nextStepAt = 0;

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// A scale degree (see MUSIC_THEMES) as a MIDI note, `octave` octaves up
// from the key's root.
function degreeToMidi(theme, degree, octave) {
  const len = theme.scale.length;
  const oct = Math.floor(degree / len);
  return theme.root + 12 * (octave + oct) + theme.scale[((degree % len) + len) % len];
}

function musicNote(midi, at, dur, { type = 'sine', vol = 0.3, attack = 0.02, filter = null } = {}) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(midiToHz(midi), at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let out = osc.connect(gain);
  if (filter) {
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filter;
    out = out.connect(lp);
  }
  out.connect(musicGain);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function playMusicStep(theme, step, at, stepDur) {
  const bar = Math.floor(step / 8) % theme.chords.length;
  const beat = step % 8;
  const [offset, quality] = theme.chords[bar];
  const chordRoot = theme.root + offset;
  const third = quality === 'm' ? 3 : 4;

  if (beat === 0) {
    [0, third, 7].forEach((interval) => {
      musicNote(chordRoot + interval, at, stepDur * 8, { type: theme.pad, vol: 0.09, attack: 0.4, filter: theme.padFilter });
    });
  }
  const bassHit = theme.bassSteps.indexOf(beat);
  if (bassHit !== -1) {
    const walk = theme.walkingBass ? [0, 7, 12, 7][bassHit % 4] : (bassHit % 2) * 7;
    musicNote(chordRoot - 12 + walk, at, stepDur * 1.6, { type: theme.bass, vol: 0.22, filter: 600 });
  }
  const degree = theme.melody[step % theme.melody.length];
  if (degree !== null) {
    const midi = degreeToMidi(theme, degree, 1);
    musicNote(midi, at, stepDur * 2.2, { type: theme.lead, vol: 0.16, filter: theme.leadFilter });
    if (theme.echo) musicNote(midi, at + stepDur * 3, stepDur * 2.2, { type: theme.lead, vol: 0.06 });
  }
}

// Schedules the next ~0.3s of music. Runs every 100ms while music is on.
function scheduleMusic() {
  if (!playingArea || audioCtx.state !== 'running') return;
  const theme = MUSIC_THEMES[playingArea];
  const stepDur = 60 / theme.bpm / 2;
  // After a stall (a throttled timer), skip ahead rather than cramming the
  // missed notes in all at once.
  if (nextStepAt < audioCtx.currentTime) nextStepAt = audioCtx.currentTime + 0.05;
  while (nextStepAt < audioCtx.currentTime + 0.3) {
    playMusicStep(theme, musicStep, nextStepAt, stepDur);
    musicStep++;
    nextStepAt += stepDur;
  }
}

// Brings what's playing in line with what should be: fades the old tune
// out and the new one in, or fades out for silence (muted, or no area).
function updateMusic() {
  if (!audioCtx) return;
  const want = isMuted() ? null : musicArea;
  if (want === playingArea) return;
  if (!musicGain) {
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(audioCtx.destination);
  }
  const now = audioCtx.currentTime;
  const g = musicGain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0, now + 0.4);
  playingArea = want;
  if (want) {
    musicStep = 0;
    nextStepAt = now + 0.45;
    g.linearRampToValueAtTime(MUSIC_VOLUME, now + 2);
  }
  if (!musicTimer) musicTimer = setInterval(scheduleMusic, 100);
}

// Which tune to play: 'home', a world's theme ('lava' | 'ice' | 'grass'),
// or null for none. Safe to call before the audio is unlocked; the music
// starts with the first key press, click or touch.
function setMusic(area) {
  musicArea = MUSIC_THEMES[area] ? area : null;
  updateMusic();
}
