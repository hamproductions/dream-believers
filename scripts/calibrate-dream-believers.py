#!/usr/bin/env python3
"""Compute per-track alignment offsets for Dream Believers versions.

Versions inside a sync cluster share an identical instrumental backing but differ
in lead-in silence and mastering. We cross-correlate each track against the
cluster anchor (coarse RMS envelope, then fine sample-level) and write the
resulting offsetMs back into data/dream-believers.json.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.signal import correlate

REPO = Path(__file__).resolve().parents[1]
MANIFEST = REPO / "data/dream-believers.json"
SORTER_AUDIO = REPO / "public/assets/songs/audio"
DB_AUDIO = REPO / "public/assets/dream-believers"
SR = 16000


def audio_path(audio: str, external: bool) -> Path:
    # Standalone: all audio (game-size + external) lives in one dir.
    del external
    return DB_AUDIO / f"{audio}.webm"


def decode(path: Path) -> np.ndarray:
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR),
         "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(out, dtype=np.float32)


def rms_env(x: np.ndarray, hop=160) -> np.ndarray:
    n = len(x) // hop
    return np.sqrt(np.mean((x[: n * hop].reshape(n, hop)) ** 2, axis=1) + 1e-9)


def best_lag(ref: np.ndarray, sig: np.ndarray, limit: int) -> int:
    """Lag (in samples of the given series) maximizing correlation, |lag|<=limit."""
    a = ref - ref.mean()
    b = sig - sig.mean()
    c = correlate(a, b, mode="full", method="fft")
    lags = np.arange(-len(b) + 1, len(a))
    mask = np.abs(lags) <= limit
    return int(lags[mask][np.argmax(c[mask])])


def align(ref: np.ndarray, sig: np.ndarray) -> float:
    # coarse: RMS envelope (10ms hops), search +-8s
    hop = 160
    coarse = best_lag(rms_env(ref, hop), rms_env(sig, hop), limit=800) * hop
    # fine: raw waveform in a +-150ms window around the coarse estimate
    win = int(0.15 * SR)
    w = min(SR * 25, len(ref), len(sig))
    a = ref[max(0, coarse):max(0, coarse) + w]
    b = sig[max(0, -coarse):max(0, -coarse) + w]
    m = min(len(a), len(b))
    if m < SR:
        return coarse / SR * 1000.0
    fine = best_lag(a[:m], b[:m], limit=win)
    return (coarse + fine) / SR * 1000.0


def main():
    manifest = json.loads(MANIFEST.read_text())
    versions = manifest["versions"]

    # clusters: (syncGroup, cut) -> list of (audio, external)
    clusters: dict[tuple, list] = {}
    for v in versions:
        for cut_name in ("short", "full"):
            cut = v.get(cut_name)
            if cut:
                clusters.setdefault((v["syncGroup"], cut_name), []).append(
                    (cut["audio"], cut["external"])
                )

    offsets: dict[str, float] = {}
    for (sg, cut_name), members in clusters.items():
        anchor_audio, anchor_ext = members[0]
        ref = decode(audio_path(anchor_audio, anchor_ext))
        offsets[anchor_audio] = 0.0
        print(f"[{sg}/{cut_name}] anchor={anchor_audio}")
        for audio, ext in members[1:]:
            sig = decode(audio_path(audio, ext))
            # Negate: align() returns the anchor->sig lag, but the player reads at
            # (position + offsetSec), so a track with more lead-in needs a POSITIVE
            # offset to advance its read head. Match the player's convention.
            ms = -align(ref, sig)
            offsets[audio] = round(ms, 1)
            print(f"    {audio:20s} offset={ms:8.1f} ms")

    for v in versions:
        for cut_name in ("short", "full"):
            cut = v.get(cut_name)
            if cut:
                cut["offsetMs"] = offsets.get(cut["audio"], 0.0)
        v.pop("offsetMs", None)

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"\nwrote offsets -> {MANIFEST}")


if __name__ == "__main__":
    main()
