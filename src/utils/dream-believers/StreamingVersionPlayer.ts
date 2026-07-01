import type { SyncedPlayerState, SyncedTrack } from './SyncedVersionPlayer';

const RAMP = 0.04;

// Streaming player for the full-song listen/compare screen. Each version is an
// <audio> element that streams from the network — the browser keeps only a few
// seconds buffered around the playhead and refills as it plays, so memory stays
// tiny (no decoding whole 5-minute songs into ~110MB buffers, which bricked iOS).
// Only the active version plays; switching seeks the target element to the same
// musical spot and crossfades — near-instant, nothing to decode up front.
interface StreamTrack {
  key: string;
  el: HTMLAudioElement;
  node: MediaElementAudioSourceNode;
  gain: GainNode;
  offsetSec: number;
  rate: number;
}

let sharedCtx: AudioContext | null = null;
function sharedContext(): AudioContext {
  if (!sharedCtx) {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

export class StreamingVersionPlayer {
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private volume = 0.8;
  private tracks = new Map<string, StreamTrack>();
  private activeKey = '';
  private playing = false;
  private raf = 0;
  private unlocked = false;
  private listeners = new Set<(s: SyncedPlayerState) => void>();

  subscribe(fn: (s: SyncedPlayerState) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const snap = this.snapshot();
    for (const fn of this.listeners) fn(snap);
  }

  private snapshot(): SyncedPlayerState {
    const pos = this.position();
    return {
      playing: this.playing,
      position: pos,
      duration: this.duration(),
      activeKey: this.activeKey,
      loadedKeys: [...this.tracks.values()].filter((t) => t.el.readyState >= 1).map((t) => t.key),
      availableKeys: this.availableAt(pos),
      pendingKey: ''
    };
  }

  private ctx(): AudioContext {
    const ctx = sharedContext();
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(ctx.destination);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.75;
      this.master.connect(this.analyser);
    }
    return ctx;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  setVolume(v: number): void {
    this.volume = Math.min(Math.max(v, 0), 1);
    if (this.master) this.master.gain.value = this.volume;
  }

  getVolume(): number {
    return this.volume;
  }

  private active(): StreamTrack | undefined {
    return this.tracks.get(this.activeKey);
  }

  duration(): number {
    let max = 0;
    for (const t of this.tracks.values()) {
      const d = t.el.duration;
      if (Number.isFinite(d)) max = Math.max(max, (d - t.offsetSec) / t.rate);
    }
    return max;
  }

  // Timeline position ⇄ a track's own currentTime: currentTime = offset + p*rate.
  private timeFor(t: StreamTrack, p: number): number {
    return t.offsetSec + p * t.rate;
  }

  position(): number {
    const t = this.active();
    if (!t) return 0;
    const p = (t.el.currentTime - t.offsetSec) / t.rate;
    return Math.min(Math.max(p, 0), this.duration() || p);
  }

  availableAt(position: number): string[] {
    const keys: string[] = [];
    for (const t of this.tracks.values()) {
      const d = t.el.duration;
      if (!Number.isFinite(d)) continue;
      const ct = this.timeFor(t, position);
      if (ct >= 0 && ct < d) keys.push(t.key);
    }
    return keys;
  }

  async load(tracks: SyncedTrack[], order: string[]): Promise<void> {
    const ctx = this.ctx();
    if (!this.activeKey) this.activeKey = order.find((k) => tracks.some((t) => t.key === k)) ?? '';
    for (const t of tracks) {
      if (this.tracks.has(t.key)) continue;
      const el = new Audio();
      el.preload = 'auto';
      el.src = t.url;
      el.crossOrigin = 'anonymous';
      // Active version always plays at natural pitch; the timeline advances at its
      // tempo instead (see position()). preservesPitch keeps that honest if a rate
      // is ever applied directly.
      el.preservesPitch = true;
      const node = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      node.connect(gain);
      gain.connect(this.master as GainNode);
      el.addEventListener('loadedmetadata', () => this.emit());
      el.addEventListener('canplay', () => this.emit());
      this.tracks.set(t.key, {
        key: t.key,
        el,
        node,
        gain,
        offsetSec: t.offsetMs / 1000,
        rate: t.rate ?? 1
      });
    }
    this.emit();
    await this.waitReady(this.activeKey);
    this.emit();
  }

  private waitReady(key: string): Promise<void> {
    const t = this.tracks.get(key);
    if (!t) return Promise.resolve();
    if (t.el.readyState >= 1) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        t.el.removeEventListener('loadedmetadata', done);
        resolve();
      };
      t.el.addEventListener('loadedmetadata', done);
    });
  }

  // iOS blocks audio until a user gesture. On the first play, "unlock" every
  // element inside the gesture so later programmatic switches are allowed.
  private unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    for (const t of this.tracks.values()) {
      if (t.key === this.activeKey) continue;
      t.el.muted = true;
      void t.el
        .play()
        .then(() => {
          t.el.pause();
          t.el.muted = false;
          return undefined;
        })
        .catch(() => {
          t.el.muted = false;
        });
    }
  }

  private tick = () => {
    if (!this.playing) return;
    const t = this.active();
    if (t && t.el.ended) {
      this.pause();
      return;
    }
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  };

  async play(position?: number): Promise<void> {
    const ctx = this.ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = this.active();
    if (!t) return;
    this.unlock();
    if (position != null) t.el.currentTime = Math.max(0, this.timeFor(t, position));
    t.gain.gain.cancelScheduledValues(ctx.currentTime);
    t.gain.gain.setValueAtTime(1, ctx.currentTime);
    await t.el.play().catch(() => {});
    this.playing = true;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
    this.emit();
  }

  pause(): void {
    const t = this.active();
    if (t) t.el.pause();
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.emit();
  }

  seek(position: number): void {
    const t = this.active();
    if (!t) return;
    const d = t.el.duration;
    const ct = this.timeFor(t, position);
    t.el.currentTime = Math.min(Math.max(ct, 0), Number.isFinite(d) ? d : ct);
    this.emit();
  }

  switchTo(key: string): void {
    const next = this.tracks.get(key);
    if (!next || key === this.activeKey) {
      this.activeKey = key;
      this.emit();
      return;
    }
    const ctx = this.ctx();
    const now = ctx.currentTime;
    const p = this.position();
    const prev = this.active();
    next.el.currentTime = Math.max(0, this.timeFor(next, p));
    if (this.playing) {
      if (prev) {
        prev.gain.gain.cancelScheduledValues(now);
        prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
        prev.gain.gain.linearRampToValueAtTime(0, now + RAMP);
        // let the fade finish, then stop the stream to free the network/decoder
        const stopping = prev;
        window.setTimeout(
          () => {
            if (this.activeKey !== stopping.key) stopping.el.pause();
          },
          RAMP * 1000 + 40
        );
      }
      next.gain.gain.cancelScheduledValues(now);
      next.gain.gain.setValueAtTime(0, now);
      next.gain.gain.linearRampToValueAtTime(1, now + RAMP);
      void next.el.play().catch(() => {});
    }
    this.activeKey = key;
    this.emit();
  }

  // Clip controls are a no-op here (the game screen uses the buffer engine).
  setClip(_start?: number, _end?: number | null): void {}
  clearClip(): void {}
  setTrackOffset(_key?: string, _ms?: number): void {}

  destroy(): void {
    cancelAnimationFrame(this.raf);
    for (const t of this.tracks.values()) {
      t.el.pause();
      t.el.removeAttribute('src');
      t.el.load();
      t.node.disconnect();
      t.gain.disconnect();
    }
    this.tracks.clear();
    this.listeners.clear();
    if (this.analyser) this.analyser.disconnect();
    if (this.master) this.master.disconnect();
    this.analyser = null;
    this.master = null;
    this.playing = false;
  }
}
