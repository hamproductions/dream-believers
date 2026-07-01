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
import { bakedSections } from '~/utils/dream-believers/sections';

// Instrumental sections carry no vocal, so they can't distinguish a version.
const INSTRUMENTAL = new Set(['イントロ', '間奏', 'アウトロ']);

export const REVEAL_STEPS = [1, 2, 4, 7, 11] as const;
export const MAX_ATTEMPTS = REVEAL_STEPS.length;

export type RoundSet = { syncGroup: SyncGroup; cut: CutName };

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
}

function buildRound({ pool, rng, approxDuration }: BuildRoundArgs): DbRound {
  const target = pool[Math.floor(rng() * pool.length)];
  const { name: targetCut } = primaryCut(target);

  // Always drop INSIDE a vocal section (not on its boundary, which catches the
  // instrumental lead-in). We pick a point a little past the section start and
  // before it ends, so the clip is singing from the first moment.
  const secs = bakedSections(`standard:${targetCut}`);
  const idxVocal = secs.map((s, i) => ({ s, i })).filter(({ s }) => !INSTRUMENTAL.has(s.label));
  let startPosition: number;
  let sectionLabel: string | null = null;
  if (idxVocal.length > 0) {
    const pick = idxVocal[Math.floor(rng() * idxVocal.length)];
    const secStart = pick.s.t;
    const next = secs[pick.i + 1];
    const secEnd = next ? next.t : secStart + 8;
    const lead = 0.6; // skip the section's instrumental pickup
    const tail = 1.6; // leave room so the clip stays within the vocal
    const lo = secStart + lead;
    const hi = Math.max(lo, secEnd - tail);
    startPosition = lo + rng() * (hi - lo);
    sectionLabel = pick.s.label;
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
  const [statsRaw, setStats] = useLocalStorage<DbStats>('db-stats', EMPTY_STATS);
  const [round, setRound] = useState<DbRound | null>(null);

  const includeSolos = solosRaw ?? true;
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
      setRound(buildRound({ pool, rng, approxDuration }));
    },
    [pool, approxDuration]
  );

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
    pool,
    activeVersions,
    activeCut,
    activeSyncGroup,
    round,
    revealDuration,
    newRound,
    guess,
    skip,
    stats,
    maxAttempts: MAX_ATTEMPTS
  };
}
