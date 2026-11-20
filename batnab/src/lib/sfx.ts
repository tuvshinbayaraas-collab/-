// The games' sounds, made on the spot (Web Audio, no files to download), and a short buzz on phones that have one
// (Android; an iPhone's browser has no vibration). One switch for both, kept on this device; quiet by default level.
const KEY = 'batnab.game.sound';

export function soundOn() {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // no storage: on for this visit only
  }
}

let ctx: AudioContext | null = null;

/** The audio starts from a tap (browsers allow it only so): call it from the start button. */
export function unlock() {
  if (!soundOn()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.05) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not allowed here
  }
}

const play = (f: () => void) => {
  if (!soundOn()) return;
  try {
    f();
  } catch {
    // no sound: the game goes on
  }
};

export const sfx = {
  tick: () => play(() => tone(660, 0, 0.09, 'square', 0.025)),
  go: () => play(() => tone(990, 0, 0.18, 'square', 0.03)),
  right: () => play(() => (tone(880, 0, 0.08), tone(1320, 0.06, 0.1))),
  wrong: () =>
    play(() => {
      tone(180, 0, 0.22, 'sawtooth', 0.03);
      buzz(90);
    }),
  record: () => play(() => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.16, 'triangle', 0.05))),
  end: () =>
    play(() => {
      tone(523, 0, 0.18, 'triangle');
      tone(392, 0.16, 0.3, 'triangle');
      buzz([60, 60, 60]);
    }),
};
