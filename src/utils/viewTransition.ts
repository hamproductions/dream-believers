import { flushSync } from 'react-dom';

type WithVT = Document & { startViewTransition?: (cb: () => void) => unknown };

// Run a React state update inside a View Transition so the swap between the
// home / game / reveal / player views animates. flushSync forces the DOM to
// update inside the transition callback (React batches otherwise). Falls back to
// a plain update when unsupported or the user prefers reduced motion.
export function viewTransition(update: () => void): void {
  const doc = document as WithVT;
  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof doc.startViewTransition !== 'function') {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}
