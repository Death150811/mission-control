// Tiny synthesised audio (Web Audio): engine rumble that follows the throttle, countdown ticks, alarms, success chime.
// Nothing is downloaded; browsers only allow audio after a user gesture, so the context starts on first use.

let ctx: AudioContext | null = null;
let noise: AudioBufferSourceNode | null = null;
let engGain: GainNode | null = null;
let engFilter: BiquadFilterNode | null = null;
let enabled = true;
try { enabled = localStorage.getItem('mission-control.sound') !== 'off'; } catch { /* ignore */ }

function ensure(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const sound = {
  get enabled() { return enabled; },
  set(on: boolean) {
    enabled = on;
    try { localStorage.setItem('mission-control.sound', on ? 'on' : 'off'); } catch { /* ignore */ }
    if (!on) sound.engine(0, false);
  },
  /** Continuous engine noise: gain and low-pass cutoff follow throttle. */
  engine(throttle: number, burning: boolean) {
    const c = ensure();
    if (!c) { if (engGain) engGain.gain.value = 0; return; }
    if (!noise) {
      const len = c.sampleRate * 2;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 8; }
      noise = c.createBufferSource(); noise.buffer = buf; noise.loop = true;
      engFilter = c.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 200;
      engGain = c.createGain(); engGain.gain.value = 0;
      noise.connect(engFilter).connect(engGain).connect(c.destination); noise.start();
    }
    const t = c.currentTime;
    engGain!.gain.setTargetAtTime(burning ? 0.05 + 0.2 * throttle : 0, t, 0.08);
    engFilter!.frequency.setTargetAtTime(160 + 700 * throttle, t, 0.1);
  },
  beep(freq = 880, dur = 0.12, vol = 0.12) {
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  },
  alarm() { sound.beep(660, 0.18, 0.14); setTimeout(() => sound.beep(520, 0.22, 0.14), 200); },
  chime() { [523, 659, 784].forEach((f, i) => setTimeout(() => sound.beep(f, 0.3, 0.1), i * 140)); },
  boom() {
    const c = ensure();
    if (!c) return;
    const len = c.sampleRate * 1.4;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = c.createGain(); g.gain.value = 0.5;
    s.connect(f).connect(g).connect(c.destination); s.start();
  },
  stop() { sound.engine(0, false); },
};
