export interface SyncedTrack {
  key: string;
  url: string;
  offsetMs: number;
}

interface LoadedTrack {
  key: string;
  buffer: AudioBuffer;
  offsetSec: number;
  gain: GainNode;
  source: AudioBufferSourceNode | null;
}

export interface SyncedPlayerState {
  playing: boolean;
  position: number;
  duration: number;
  activeKey: string;
  loadedKeys: string[];
  availableKeys: string[];
}

const RAMP = 0.03;
const SCHEDULE_AHEAD = 0.06;

// Keep one AudioContext and decoded-buffer cache across rounds so the next
// question can start from a ready AudioBuffer instead of decoding a full track.
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

const bufferCache = new Map<string, Promise<AudioBuffer>>();

function decodeClip(url: string): Promise<AudioBuffer> {
  let p = bufferCache.get(url);
  if (!p) {
    p = fetch(url, { referrerPolicy: 'no-referrer' })
      .then((r) => {
        if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((ab) => sharedContext().decodeAudioData(ab));
    p.catch(() => bufferCache.delete(url));
    bufferCache.set(url, p);
  }
  return p;
}

export function preloadClips(urls: string[]): void {
  for (const u of urls) void decodeClip(u).catch(() => {});
}

export class SyncedVersionPlayer {
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private volume = 0.8;
  private tracks = new Map<string, LoadedTrack>();
  private activeKey = '';
  private startCtxTime = 0;
  private startPosition = 0;
  private playing = false;
  private raf = 0;
  private clipStart = 0;
  private clipEnd: number | null = null;
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
    return {
      playing: this.playing,
      position: this.position(),
      duration: this.duration(),
      activeKey: this.activeKey,
      loadedKeys: [...this.tracks.keys()],
      availableKeys: this.availableAt(this.position())
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

  private masterNode(): GainNode {
    this.ctx();
    return this.master as GainNode;
  }

  setVolume(v: number): void {
    this.volume = Math.min(Math.max(v, 0), 1);
    if (this.master) this.master.gain.value = this.volume;
  }

  getVolume(): number {
    return this.volume;
  }

  // Timeline spans the longest playable track. A track is audible while its
  // read head (position + offset) sits inside its own buffer; outside that it
  // simply stays silent instead of clamping the shared timeline.
  duration(): number {
    let max = 0;
    for (const t of this.tracks.values()) max = Math.max(max, t.buffer.duration - t.offsetSec);
    return max;
  }

  availableAt(position: number): string[] {
    const keys: string[] = [];
    for (const t of this.tracks.values()) {
      const readAt = position + t.offsetSec;
      if (readAt >= 0 && readAt < t.buffer.duration) keys.push(t.key);
    }
    return keys;
  }

  position(): number {
    if (!this.playing) return this.startPosition;
    const p = this.startPosition + (sharedContext().currentTime - this.startCtxTime);
    return Math.min(Math.max(p, 0), this.duration());
  }

  // Decode one track at a time, active first, emitting after each so the UI can
  // enable playback the moment the active buffer is ready and light up the rest
  // as they stream in. Decoding all full songs at once allocates ~100MB each and
  // freezes the main thread — the whole point of the loading state is defeated.
  async load(tracks: SyncedTrack[], order: string[]): Promise<void> {
    this.ctx();
    if (!this.activeKey) this.activeKey = order.find((k) => tracks.some((t) => t.key === k)) ?? '';
    const first = tracks.filter((t) => t.key === this.activeKey);
    const rest = tracks.filter((t) => t.key !== this.activeKey);
    for (const t of [...first, ...rest]) {
      if (this.tracks.has(t.key)) continue;
      const buffer = await decodeClip(t.url);
      const gain = this.ctx().createGain();
      gain.gain.value = 0;
      gain.connect(this.masterNode());
      this.tracks.set(t.key, {
        key: t.key,
        buffer,
        offsetSec: t.offsetMs / 1000,
        gain,
        source: null
      });
      this.emit();
    }
    this.emit();
  }

  setTrackOffset(key: string, offsetMs: number): void {
    const t = this.tracks.get(key);
    if (!t) return;
    t.offsetSec = offsetMs / 1000;
    if (this.playing) this.seek(this.position());
  }

  private stopSources() {
    for (const t of this.tracks.values()) {
      if (t.source) {
        try {
          t.source.stop();
        } catch {}
        t.source.disconnect();
        t.source = null;
      }
    }
  }

  private startSources(position: number) {
    const ctx = this.ctx();
    const when = ctx.currentTime + SCHEDULE_AHEAD;
    for (const t of this.tracks.values()) {
      const src = ctx.createBufferSource();
      src.buffer = t.buffer;
      src.connect(t.gain);
      // Offsets are stored in the player's timeline direction: positive means
      // read later in the source to align with the anchor version.
      const readAt = position + t.offsetSec;
      if (readAt >= 0 && readAt < t.buffer.duration) {
        src.start(when, readAt);
      } else if (readAt < 0) {
        src.start(when - readAt);
      }
      t.source = src;
      t.gain.gain.setValueAtTime(t.key === this.activeKey ? 1 : 0, when);
    }
    this.startCtxTime = when;
    this.startPosition = position;
  }

  setClip(start: number, end: number | null): void {
    this.clipStart = Math.max(0, start);
    this.clipEnd = end;
    if (this.startPosition < this.clipStart) this.startPosition = this.clipStart;
    this.emit();
  }

  clearClip(): void {
    this.clipStart = 0;
    this.clipEnd = null;
    this.emit();
  }

  private upperBound(): number {
    return this.clipEnd != null ? Math.min(this.clipEnd, this.duration()) : this.duration();
  }

  private tick = () => {
    if (!this.playing) return;
    if (this.position() >= this.upperBound() - 0.01) {
      this.pause();
      this.seekSilent(this.clipStart);
      return;
    }
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  };

  async play(position?: number): Promise<void> {
    const ctx = this.ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    if (this.playing) return;
    this.startSources(position ?? this.startPosition);
    this.playing = true;
    this.raf = requestAnimationFrame(this.tick);
    this.emit();
  }

  pause(): void {
    if (!this.playing) return;
    const pos = this.position();
    this.stopSources();
    this.playing = false;
    this.startPosition = pos;
    cancelAnimationFrame(this.raf);
    this.emit();
  }

  private seekSilent(position: number) {
    this.startPosition = Math.min(Math.max(position, 0), this.duration());
  }

  seek(position: number): void {
    const target = Math.min(Math.max(position, 0), this.duration());
    if (this.playing) {
      this.stopSources();
      this.startSources(target);
    } else {
      this.startPosition = target;
    }
    this.emit();
  }

  switchTo(key: string): void {
    if (!this.tracks.has(key) || key === this.activeKey) {
      this.activeKey = key;
      this.emit();
      return;
    }
    const ctx = this.ctx();
    const now = ctx.currentTime;
    const prev = this.tracks.get(this.activeKey);
    const next = this.tracks.get(key);
    if (this.playing && prev) {
      prev.gain.gain.cancelScheduledValues(now);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
      prev.gain.gain.linearRampToValueAtTime(0, now + RAMP);
    }
    if (this.playing && next) {
      next.gain.gain.cancelScheduledValues(now);
      next.gain.gain.setValueAtTime(next.gain.gain.value, now);
      next.gain.gain.linearRampToValueAtTime(1, now + RAMP);
    }
    this.activeKey = key;
    this.emit();
  }

  destroy(): void {
    this.stopSources();
    cancelAnimationFrame(this.raf);
    for (const t of this.tracks.values()) t.gain.disconnect();
    this.tracks.clear();
    this.listeners.clear();
    // Player nodes are per-round; the shared context and decoded buffers stay hot.
    if (this.analyser) this.analyser.disconnect();
    if (this.master) this.master.disconnect();
    this.analyser = null;
    this.master = null;
    this.playing = false;
  }
}
