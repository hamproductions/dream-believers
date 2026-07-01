type Getter = () => AnalyserNode | null;

let current: Getter | null = null;

/**
 * Bridges the audio analyser (owned by the player in +Page) to the visualizer
 * (mounted in +Layout, a parent). The canvas polls every frame, so a shared
 * getter is enough and avoids drilling props across the SSR layout boundary.
 */
export const analyserBus = {
  set(fn: Getter | null): void {
    current = fn;
  },
  node(): AnalyserNode | null {
    return current ? current() : null;
  }
};
