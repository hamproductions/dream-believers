export interface SyncedTrack {
  key: string;
  url: string;
  offsetMs: number;
  // Playback-rate correction for arrangements at a different tempo (e.g. the
  // Aikatsu cover runs ~2% faster). rate < 1 slows the source onto the shared
  // timeline. Sample read at timeline position p is: offsetSec + p * rate.
  rate?: number;
}

interface LoadedTrack {
  key: string;
  url: string;
  buffer: AudioBuffer | null;
  offsetSec: number;
  rate: number;
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  used: number;
}

// Decoded full songs are ~110MB each; iOS Safari kills the tab past ~1GB. Keep at
// most this many decoded at once and evict the least-recently-used, decoding the
// rest on demand. Bounds memory to ~450MB regardless of how many versions exist.
const MAX_RESIDENT = 4;

export interface SyncedPlayerState {
  playing: boolean;
  position: number;
  duration: number;
  activeKey: string;
  loadedKeys: string[];
  availableKeys: string[];
  pendingKey: string;
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
  private lruClock = 0;
  private pendingActive: string | null = null;
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
      loadedKeys: [...this.tracks.values()].filter((t) => t.buffer).map((t) => t.key),
      availableKeys: this.availableAt(this.position()),
      pendingKey: this.pendingActive ?? ''
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
    for (const t of this.tracks.values())
      if (t.buffer) max = Math.max(max, (t.buffer.duration - t.offsetSec) / t.rate);
    return max;
  }

  availableAt(position: number): string[] {
    const keys: string[] = [];
    for (const t of this.tracks.values()) {
      if (!t.buffer) continue;
      const readAt = t.offsetSec + position * t.rate;
      if (readAt >= 0 && readAt < t.buffer.duration) keys.push(t.key);
    }
    return keys;
  }

  // The audible (active) track always plays at its natural rate so its pitch is
  // never altered; the shared timeline instead ticks at the active track's tempo
  // (faster while a faster arrangement like Aikatsu is active). Muted tracks take
  // the small rate difference, which no one hears.
  private activeScale(): number {
    return this.tracks.get(this.activeKey)?.rate ?? 1;
  }

  position(): number {
    if (!this.playing) return this.startPosition;
    const c = 1 / this.activeScale();
    const p = this.startPosition + (sharedContext().currentTime - this.startCtxTime) * c;
    return Math.min(Math.max(p, 0), this.duration());
  }

  // Register every track's metadata + gain node (cheap), but only decode the
  // active track now. The rest decode on demand when selected, and we keep at
  // most MAX_RESIDENT buffers decoded so total memory stays bounded — otherwise
  // decoding every full song bricks the tab on iOS.
  async load(tracks: SyncedTrack[], order: string[]): Promise<void> {
    const ctx = this.ctx();
    if (!this.activeKey) this.activeKey = order.find((k) => tracks.some((t) => t.key === k)) ?? '';
    for (const t of tracks) {
      if (this.tracks.has(t.key)) continue;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.masterNode());
      this.tracks.set(t.key, {
        key: t.key,
        url: t.url,
        buffer: null,
        offsetSec: t.offsetMs / 1000,
        rate: t.rate ?? 1,
        gain,
        source: null,
        used: 0
      });
    }
    this.emit();
    await this.ensureLoaded(this.activeKey);
    this.emit();
  }

  private async ensureLoaded(key: string): Promise<void> {
    const t = this.tracks.get(key);
    if (!t) return;
    t.used = ++this.lruClock;
    if (t.buffer) return;
    const buffer = await decodeClip(t.url);
    if (!this.tracks.has(key)) return;
    t.buffer = buffer;
    t.used = ++this.lruClock;
    this.evict();
    if (this.playing && !t.source) this.startSource(t, this.position());
    this.emit();
  }

  private evict(): void {
    const decoded = [...this.tracks.values()]
      .filter((t) => t.buffer)
      .toSorted((a, b) => a.used - b.used);
    let excess = decoded.length - MAX_RESIDENT;
    for (const t of decoded) {
      if (excess <= 0) break;
      if (t.key === this.activeKey) continue;
      if (t.source) {
        try {
          t.source.stop();
        } catch {}
        t.source.disconnect();
        t.source = null;
      }
      t.buffer = null;
      bufferCache.delete(t.url);
      excess--;
    }
  }

  private startSource(t: LoadedTrack, position: number): void {
    if (!t.buffer) return;
    const ctx = this.ctx();
    const when = ctx.currentTime + SCHEDULE_AHEAD;
    const src = ctx.createBufferSource();
    src.buffer = t.buffer;
    const pr = t.rate / this.activeScale();
    src.playbackRate.value = pr;
    src.connect(t.gain);
    const readAt = t.offsetSec + position * t.rate;
    if (readAt >= 0 && readAt < t.buffer.duration) {
      src.start(when, readAt);
    } else if (readAt < 0) {
      src.start(when - readAt / pr);
    } else {
      src.disconnect();
      return;
    }
    t.source = src;
    t.gain.gain.setValueAtTime(t.key === this.activeKey ? 1 : 0, when);
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
    this.startCtxTime = ctx.currentTime + SCHEDULE_AHEAD;
    this.startPosition = position;
    for (const t of this.tracks.values()) if (t.buffer) this.startSource(t, position);
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
    await this.ensureLoaded(this.activeKey);
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
    const next = this.tracks.get(key);
    if (!next || key === this.activeKey) {
      this.activeKey = key;
      this.emit();
      return;
    }
    next.used = ++this.lruClock;
    // A cold track must decode before we can hear it. Mark it pending, decode,
    // then apply the crossfade — the UI shows it loading meanwhile.
    if (!next.buffer) {
      this.pendingActive = key;
      this.emit();
      void this.ensureLoaded(key).then(() => {
        if (this.pendingActive === key) {
          this.pendingActive = null;
          this.applySwitch(key);
        }
        return undefined;
      });
      return;
    }
    this.applySwitch(key);
  }

  private applySwitch(key: string): void {
    const next = this.tracks.get(key);
    if (!next) return;
    const ctx = this.ctx();
    const now = ctx.currentTime;
    const prev = this.tracks.get(this.activeKey);
    if (this.playing && !next.source) this.startSource(next, this.position());
    if (this.playing && prev) {
      prev.gain.gain.cancelScheduledValues(now);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
      prev.gain.gain.linearRampToValueAtTime(0, now + RAMP);
    }
    if (this.playing) {
      next.gain.gain.cancelScheduledValues(now);
      next.gain.gain.setValueAtTime(next.gain.gain.value, now);
      next.gain.gain.linearRampToValueAtTime(1, now + RAMP);
    }
    // If the new active track has a different tempo, the shared clock rate flips.
    // Re-anchor the position clock and retune every live source's playback rate so
    // the new active track is now the one playing at its natural rate.
    const prevScale = this.activeScale();
    this.activeKey = key;
    const nextScale = this.activeScale();
    if (this.playing && prevScale !== nextScale) {
      this.startPosition = this.startPosition + (now - this.startCtxTime) / prevScale;
      this.startCtxTime = now;
      for (const t of this.tracks.values()) {
        if (t.source) t.source.playbackRate.setValueAtTime(t.rate / nextScale, now);
      }
    }
    this.evict();
    this.emit();
  }

  destroy(): void {
    this.stopSources();
    cancelAnimationFrame(this.raf);
    this.pendingActive = null;
    for (const t of this.tracks.values()) {
      t.gain.disconnect();
      // Drop decoded audio so the memory is reclaimed when leaving the player.
      t.buffer = null;
      bufferCache.delete(t.url);
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
