"use client";

/**
 * Sound system. Everything here is synthesised (no copyrighted audio) and nothing plays until the
 * visitor's first interaction. A licensed track can be supplied later via Settings → music URL (or
 * NEXT_PUBLIC_MUSIC_URL) and it will fade in under the effects. The site is fully usable muted.
 */
export type Sfx = "paper" | "photo" | "shutter" | "flash" | "thump" | "creak" | "page" | "lidClose" | "sticker";
const KEY = "s26:muted";
const MASTER = 0.5;

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private music: HTMLAudioElement | null = null;
  private musicUrl: string | null = null;
  muted = false;
  private listeners = new Set<() => void>();

  constructor() {
    try { this.muted = localStorage.getItem(KEY) === "1"; } catch { /* private mode */ }
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((f) => f()); }

  setMusic(url: string | null) { this.musicUrl = url; }

  /** Call from a user gesture (tap). Safe to call repeatedly. */
  unlock() {
    if (typeof window === "undefined") return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : MASTER;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 1.5;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.startMusic();
    } catch { /* audio is optional */ }
  }

  private startMusic() {
    if (!this.musicUrl || this.music) return;
    try {
      const el = new Audio(this.musicUrl);
      el.loop = true;
      el.volume = 0;
      el.addEventListener("error", () => { this.music = null; }, { once: true });
      this.music = el;
      if (!this.muted) void el.play().then(() => this.fadeMusic(0.22)).catch(() => { this.music = null; });
    } catch { this.music = null; }
  }
  private fadeMusic(to: number) {
    const el = this.music; if (!el) return;
    const from = el.volume; const t0 = performance.now();
    const step = () => { const k = Math.min(1, (performance.now() - t0) / 1600); el.volume = from + (to - from) * k; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem(KEY, m ? "1" : "0"); } catch { /* ignore */ }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : MASTER, this.ctx.currentTime, 0.05);
    if (this.music) { if (m) { this.fadeMusic(0); setTimeout(() => this.music?.pause(), 1700); } else { void this.music.play().then(() => this.fadeMusic(0.22)).catch(() => {}); } }
    else if (!m) this.startMusic();
    this.emit();
  }

  private burst(opts: { dur: number; gain: number; type: BiquadFilterType; freq: number; q?: number; sweepTo?: number; at?: number }) {
    const c = this.ctx!; const t = c.currentTime + (opts.at ?? 0);
    const src = c.createBufferSource(); src.buffer = this.noise!;
    src.loop = true;
    const f = c.createBiquadFilter(); f.type = opts.type; f.frequency.setValueAtTime(opts.freq, t); f.Q.value = opts.q ?? 0.8;
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain, t + Math.min(0.012, opts.dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f); f.connect(g); g.connect(this.master!);
    src.start(t, Math.random()); src.stop(t + opts.dur + 0.05);
  }
  private tone(opts: { from: number; to: number; dur: number; gain: number; type?: OscillatorType; at?: number }) {
    const c = this.ctx!; const t = c.currentTime + (opts.at ?? 0);
    const o = c.createOscillator(); o.type = opts.type ?? "sine";
    o.frequency.setValueAtTime(opts.from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + opts.dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    o.connect(g); g.connect(this.master!); o.start(t); o.stop(t + opts.dur + 0.05);
  }

  play(name: Sfx) {
    if (this.muted || !this.ctx || !this.master || !this.noise) return;
    try {
      switch (name) {
        case "paper": this.burst({ dur: 0.16, gain: 0.16, type: "highpass", freq: 1800 }); break;
        case "photo": this.burst({ dur: 0.09, gain: 0.2, type: "bandpass", freq: 1400, q: 0.6 }); this.tone({ from: 160, to: 70, dur: 0.08, gain: 0.05 }); break;
        case "shutter":
          this.burst({ dur: 0.035, gain: 0.5, type: "bandpass", freq: 3200, q: 1.2 });
          this.burst({ dur: 0.05, gain: 0.4, type: "bandpass", freq: 2200, q: 1.0, at: 0.07 });
          this.tone({ from: 140, to: 60, dur: 0.06, gain: 0.12, type: "triangle" }); break;
        case "flash": this.tone({ from: 2400, to: 700, dur: 0.32, gain: 0.03 }); break;
        case "thump": this.tone({ from: 110, to: 42, dur: 0.28, gain: 0.32 }); this.burst({ dur: 0.12, gain: 0.1, type: "lowpass", freq: 400 }); break;
        case "lidClose": this.burst({ dur: 0.5, gain: 0.08, type: "bandpass", freq: 500, sweepTo: 240, q: 1.5 }); this.tone({ from: 120, to: 44, dur: 0.34, gain: 0.4, at: 0.42 }); break;
        case "creak": this.burst({ dur: 1.1, gain: 0.07, type: "bandpass", freq: 320, sweepTo: 720, q: 5 }); break;
        case "page": this.burst({ dur: 0.34, gain: 0.14, type: "bandpass", freq: 2200, sweepTo: 900, q: 0.5 }); break;
        case "sticker": this.burst({ dur: 0.1, gain: 0.1, type: "highpass", freq: 2600 }); break;
      }
    } catch { /* never let audio break the experience */ }
  }
}

let engine: SoundEngine | null = null;
export function getSound(): SoundEngine {
  if (!engine) engine = new SoundEngine();
  return engine;
}
