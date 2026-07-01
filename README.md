# Dream Believers Guessr

A viral guessing game for **Dream Believers** (蓮ノ空 / Link! Like! Love Live!). You get dropped into a random spot of the song and guess which version is playing — then, once revealed, switch freely between **every version locked to the same timeline in perfect sync**.

## Features

- **Guess the version** — Heardle-style progressive reveal (1 → 2 → 4 → 7 → 11s), 5 attempts.
- **Perfectly synchronized multi-version player** — all versions of a set play in lockstep on one Web Audio clock; switching the audible one is a sample-accurate gain crossfade, so the playhead never restarts.
- **Per-version offset calibration** — versions share the arrangement but differ in lead-in/master drift; offsets are auto-computed by cross-correlation and hand-tunable live (±10 ms).
- **Round sets**
  - Game-size (期 versions): Original / 4人 / 104期 / 105期 / B.G.P.
  - Full (期 versions)
  - SAKURA + solos (SAKURA Ver. + 梢 / 綴理 / 慈 solo renditions)
- **Random start position**, daily & endless modes, streak stats, shareable emoji result.
- Japanese / English, dark mode, offline-capable static build.

## Architecture

Mirrors the-sorter: **Bun + Vite + Vike (vike-react) + React 19 + Panda CSS + Park UI + react-i18next**, deployed to GitHub Pages.

- `src/utils/dream-believers/SyncedVersionPlayer.ts` — framework-agnostic Web Audio engine (shared clock, per-track gain + offset, clip windows).
- `src/utils/dream-believers/data.ts` — typed manifest access + sync-cluster grouping.
- `src/hooks/useSyncedPlayer.ts` — React binding for the engine.
- `src/hooks/useDreamBelieversGame.ts` — round selection, reveal ladder, daily seeding, stats.
- `src/components/dream-believers/SyncedPlayerPanel.tsx` — player + switcher + offset tuner.
- `src/pages/index/+Page.tsx` — the game.

## Data pipeline

- `scripts/build-dream-believers.ts` — pulls game-size audio from the LinkLike asset dump (`bgm_live_*.mp3`) and full/solo audio from the Love Live Wiki, transcodes to Opus/WebM, writes `data/dream-believers.json`.
- `scripts/calibrate-dream-believers.py` — cross-correlates tracks within each sync cluster and writes per-track `offsetMs`.

Regenerate:

```bash
bun run assets      # download + transcode audio, build manifest
bun run calibrate   # compute alignment offsets
```

## Develop

```bash
bun install
bun run dev          # http://localhost:3000
bun run type-check
bun run ci:build     # production build → dist/client
```
