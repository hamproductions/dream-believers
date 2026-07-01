import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
  primaryCut,
  unifiedPool,
  versionByKey,
  type CutName,
  type SyncGroup,
  type Version
} from '~/utils/dream-believers/data';

export const REVEAL_STEPS = [1, 2, 4, 7, 11] as const;
export const MAX_ATTEMPTS = REVEAL_STEPS.length;
export type GameMode = 'normal' | 'hard';

export interface DbStats {
  played: number;
  won: number;
  streak: number;
  bestStreak: number;
  byAttempt: number[];
}

export interface DbRound {
  targetCut: CutName;
  poolKeys: string[];
  targetKey: string;
  startPosition: number;
  sectionLabel: string | null;
  attempt: number;
  guesses: string[];
  status: 'playing' | 'won' | 'lost';
}

interface VocalWindow {
  start: number;
  end: number;
  label: string;
}

const GROUP_FULL_WINDOWS: VocalWindow[] = [
  { start: 111.2, end: 133.4, label: 'Aメロ2' },
  { start: 136.4, end: 157.1, label: 'Bメロ2' },
  { start: 190.8, end: 222.2, label: 'Cメロ' }
];

const GROUP_FULL_HARD_WINDOWS: VocalWindow[] = [
  { start: 25.8, end: 48.2, label: 'Aメロ' },
  { start: 50.6, end: 72.3, label: 'Bメロ' },
  { start: 74.2, end: 98.2, label: 'サビ' },
  ...GROUP_FULL_WINDOWS,
  { start: 160.2, end: 186.2, label: 'サビ2' },
  { start: 229.0, end: 271.0, label: '大サビ' }
];

const SAKURA_FULL_WINDOWS: VocalWindow[] = [
  { start: 110.4, end: 131.9, label: 'Aメロ2' },
  { start: 134.4, end: 153.8, label: 'Bメロ2' },
  { start: 187.6, end: 219.2, label: 'Cメロ' }
];

const SAKURA_FULL_HARD_WINDOWS: VocalWindow[] = [
  { start: 25.8, end: 47.2, label: 'Aメロ' },
  { start: 49.0, end: 69.8, label: 'Bメロ' },
  { start: 71.8, end: 96.0, label: 'サビ' },
  ...SAKURA_FULL_WINDOWS,
  { start: 155.8, end: 182.6, label: 'サビ2' },
  { start: 226.4, end: 267.0, label: '大サビ' }
];

const NORMAL_WINDOWS: Record<string, VocalWindow[]> = {
  original: GROUP_FULL_WINDOWS,
  '4nin': [{ start: 52.0, end: 72.2, label: 'Bメロ' }],
  '104': GROUP_FULL_WINDOWS,
  '105': [
    { start: 111.4, end: 131.5, label: 'Aメロ2' },
    { start: 136.5, end: 156.8, label: 'Bメロ2' },
    { start: 190.6, end: 222.0, label: 'Cメロ' }
  ],
  bgp: GROUP_FULL_WINDOWS,
  aikatsu: GROUP_FULL_WINDOWS,
  sakura: SAKURA_FULL_WINDOWS,
  'sakura-kaho': SAKURA_FULL_WINDOWS,
  'sakura-sayaka': SAKURA_FULL_WINDOWS,
  'sakura-kozue': SAKURA_FULL_WINDOWS,
  'sakura-tsuzuri': SAKURA_FULL_WINDOWS,
  'sakura-rurino': SAKURA_FULL_WINDOWS,
  'sakura-megumi': SAKURA_FULL_WINDOWS
};

const HARD_WINDOWS: Record<string, VocalWindow[]> = {
  original: GROUP_FULL_HARD_WINDOWS,
  '4nin': [
    { start: 28.2, end: 50.2, label: 'Aメロ' },
    { start: 52.0, end: 72.2, label: 'Bメロ' }
  ],
  '104': GROUP_FULL_HARD_WINDOWS,
  '105': GROUP_FULL_HARD_WINDOWS,
  bgp: GROUP_FULL_HARD_WINDOWS,
  aikatsu: GROUP_FULL_HARD_WINDOWS,
  sakura: SAKURA_FULL_HARD_WINDOWS,
  'sakura-kaho': SAKURA_FULL_HARD_WINDOWS,
  'sakura-sayaka': SAKURA_FULL_HARD_WINDOWS,
  'sakura-kozue': SAKURA_FULL_HARD_WINDOWS,
  'sakura-tsuzuri': SAKURA_FULL_HARD_WINDOWS,
  'sakura-rurino': SAKURA_FULL_HARD_WINDOWS,
  'sakura-megumi': SAKURA_FULL_HARD_WINDOWS
};

const EMPTY_STATS: DbStats = {
  played: 0,
  won: 0,
  streak: 0,
  bestStreak: 0,
  byAttempt: Array.from({ length: MAX_ATTEMPTS }, () => 0)
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todaySeed(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

interface BuildRoundArgs {
  pool: Version[];
  rng: () => number;
  approxDuration: number;
  mode: GameMode;
}

function buildRound({ pool, rng, approxDuration, mode }: BuildRoundArgs): DbRound {
  const target = pool[Math.floor(rng() * pool.length)];
  const { name: targetCut } = primaryCut(target);

  const windows = (mode === 'normal' ? NORMAL_WINDOWS : HARD_WINDOWS)[target.key] ?? [];
  let startPosition: number;
  let sectionLabel: string | null = null;
  if (windows.length > 0) {
    const pick = windows[Math.floor(rng() * windows.length)];
    const longestReveal = REVEAL_STEPS.at(-1)!;
    const span = pick.end - pick.start;
    const lo = pick.start + 0.5;
    const hi = Math.max(lo, Math.min(pick.start + span * 0.35, pick.end - longestReveal - 2));
    startPosition = lo + rng() * (hi - lo);
    sectionLabel = pick.label;
  } else {
    const usable = Math.max(approxDuration - 15, 5);
    startPosition = Math.min(5 + rng() * (usable - 5), usable);
  }

  return {
    targetCut,
    poolKeys: pool.map((v) => v.key),
    targetKey: target.key,
    startPosition,
    sectionLabel,
    attempt: 0,
    guesses: [],
    status: 'playing'
  };
}

export function useDreamBelieversGame(approxDuration = 130) {
  const [solosRaw, setIncludeSolos] = useLocalStorage<boolean>('db-solos', true);
  const [modeRaw, setMode] = useLocalStorage<GameMode>('db-mode', 'normal');
  const [statsRaw, setStats] = useLocalStorage<DbStats>('db-stats', EMPTY_STATS);
  const [round, setRound] = useState<DbRound | null>(null);

  const includeSolos = solosRaw ?? true;
  const mode: GameMode = modeRaw === 'hard' ? 'hard' : 'normal';
  const stats: DbStats = statsRaw ?? EMPTY_STATS;

  // ONE pool of every version. Each version plays its own primary cut (full if
  // it exists, else game-size — so 4人 Ver. is in as-is). The guess list is this
  // same list every round; there is no short/full "round type".
  const pool = useMemo(() => unifiedPool(includeSolos), [includeSolos]);

  const newRound = useCallback(
    (daily = false) => {
      const rng = daily
        ? mulberry32(hashStr(`${todaySeed()}`))
        : mulberry32((Math.floor(performance.now()) ^ 0x9e3779b9) >>> 0);
      setRound(buildRound({ pool, rng, approxDuration, mode }));
    },
    [pool, approxDuration, mode]
  );

  const quit = useCallback(() => setRound(null), []);

  const recordResult = useCallback(
    (won: boolean, attempt: number) => {
      setStats((prev) => {
        const p = prev ?? EMPTY_STATS;
        const byAttempt = [...p.byAttempt];
        if (won) byAttempt[attempt] = (byAttempt[attempt] ?? 0) + 1;
        const streak = won ? p.streak + 1 : 0;
        return {
          played: p.played + 1,
          won: p.won + (won ? 1 : 0),
          streak,
          bestStreak: Math.max(p.bestStreak, streak),
          byAttempt
        };
      });
    },
    [setStats]
  );

  const guess = useCallback((key: string) => {
    setRound((prev) => {
      if (!prev || prev.status !== 'playing') return prev;
      const guesses = [...prev.guesses, key];
      if (key === prev.targetKey) return { ...prev, guesses, status: 'won' };
      const attempt = prev.attempt + 1;
      if (attempt >= MAX_ATTEMPTS) return { ...prev, guesses, attempt, status: 'lost' };
      return { ...prev, guesses, attempt };
    });
  }, []);

  const skip = useCallback(() => {
    setRound((prev) => {
      if (!prev || prev.status !== 'playing') return prev;
      const attempt = prev.attempt + 1;
      const guesses = [...prev.guesses, ''];
      if (attempt >= MAX_ATTEMPTS) return { ...prev, guesses, attempt, status: 'lost' };
      return { ...prev, guesses, attempt };
    });
  }, []);

  // Record stats exactly once per finished round, after commit (never inside an
  // updater — that double-counts under StrictMode's double-invoke).
  const recordedRef = useRef<DbRound | null>(null);
  useEffect(() => {
    if (!round || round.status === 'playing') return;
    if (recordedRef.current === round) return;
    recordedRef.current = round;
    recordResult(round.status === 'won', round.attempt);
  }, [round, recordResult]);

  // The guess list is the whole pool, every round. The target's own cut decides
  // which arrangement its audio + sections use.
  const activeCut: CutName = round ? round.targetCut : 'full';
  const activeSyncGroup: SyncGroup = 'standard';
  const activeVersions: Version[] = useMemo(
    () =>
      round
        ? round.poolKeys.map((k) => versionByKey(k)).filter((v): v is Version => v != null)
        : pool,
    [round, pool]
  );

  const revealDuration = round
    ? REVEAL_STEPS[Math.min(round.attempt, REVEAL_STEPS.length - 1)]
    : REVEAL_STEPS[0];

  return {
    includeSolos,
    setIncludeSolos,
    mode,
    setMode,
    pool,
    activeVersions,
    activeCut,
    activeSyncGroup,
    round,
    revealDuration,
    newRound,
    guess,
    skip,
    quit,
    stats,
    maxAttempts: MAX_ATTEMPTS
  };
}
