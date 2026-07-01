#!/usr/bin/env python3
"""Visualize every Dream Believers audio file grouped by sync cluster, detect the
chorus/hook of each, shade it on the plot, and write data/chorus.json."""
import json
import subprocess
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

REPO = Path(__file__).resolve().parents[1]
AUDIO = REPO / "public/assets/dream-believers"
MANIFEST = REPO / "data/dream-believers.json"
OUT_PNG = REPO / "dogfood-output/audio-map.png"
CHORUS = REPO / "data/chorus.json"
SR = 8000
HOP = 400  # 50ms frames


def decode(audio: str) -> np.ndarray:
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(AUDIO / f"{audio}.webm"),
         "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(out, dtype=np.float32)


def rms_env(x: np.ndarray) -> np.ndarray:
    n = len(x) // HOP
    return np.sqrt(np.mean(x[: n * HOP].reshape(n, HOP) ** 2, axis=1) + 1e-9)


def detect_chorus(env: np.ndarray, win_s=14.0) -> tuple[float, float]:
    """Loudest sustained window, biased toward the later (climactic) occurrence."""
    fps = SR / HOP
    w = int(win_s * fps)
    if len(env) <= w:
        return 0.0, len(env) / fps
    csum = np.cumsum(np.insert(env, 0, 0))
    means = (csum[w:] - csum[:-w]) / w
    peak = means.max()
    # among windows within 3% of the peak energy, take the latest before the outro
    cutoff = int(len(means) * 0.9)
    cand = np.where(means[:cutoff] >= peak * 0.97)[0]
    start_f = int(cand[-1]) if len(cand) else int(means.argmax())
    return start_f / fps, (start_f + w) / fps


def main():
    m = json.loads(MANIFEST.read_text())
    clusters: dict[tuple, list] = {}
    for v in m["versions"]:
        for cut in ("short", "full"):
            c = v.get(cut)
            if c:
                clusters.setdefault((v["syncGroup"], cut), []).append(
                    (v["label"]["en"], c["audio"], c.get("offsetMs", 0.0))
                )

    order = [("standard", "short"), ("standard", "full"), ("sakura", "short"), ("sakura", "full")]
    order = [k for k in order if k in clusters]
    fig, axes = plt.subplots(len(order), 1, figsize=(15, 3.1 * len(order)), facecolor="#0f0d14")
    if len(order) == 1:
        axes = [axes]

    chorus_out: dict[str, dict] = {}
    for ax, key in zip(axes, order):
        sg, cut = key
        ax.set_facecolor("#17131f")
        rows = clusters[key]
        n = len(rows)
        for i, (label, audio, off) in enumerate(rows):
            x = decode(audio)
            env = rms_env(x)
            env = env / (env.max() + 1e-9)
            fps = SR / HOP
            t = np.arange(len(env)) / fps - off / 1000.0  # align within cluster
            base = n - 1 - i
            ax.fill_between(t, base, base + env * 0.9, color="#e24e8e", alpha=0.55, linewidth=0)
            ax.plot(t, base + env * 0.9, color="#f39ac0", linewidth=0.6)
            cs, ce = detect_chorus(env)
            chorus_out[audio] = {"start": round(cs, 2), "end": round(ce, 2)}
            ax.axvspan(cs - off / 1000.0, ce - off / 1000.0, base, base + 0.9,
                       color="#4fb286", alpha=0.18)
            ax.text(-2, base + 0.4, label, color="#f4eff7", fontsize=8, ha="right", va="center")
            ax.text(cs - off / 1000.0, base + 0.95, "chorus", color="#4fb286", fontsize=6, va="bottom")
        ax.set_title(f"{sg} / {cut}  —  {n} version(s), offset-aligned", color="#a99cbb",
                     fontsize=10, loc="left")
        ax.set_xlim(-30, max(len(rms_env(decode(r[1]))) / (SR / HOP) for r in rows) + 2)
        ax.set_ylim(0, n)
        ax.set_yticks([])
        ax.tick_params(colors="#7d7091", labelsize=7)
        ax.set_xlabel("seconds", color="#7d7091", fontsize=7)
        for s in ax.spines.values():
            s.set_color("#241c30")

    fig.suptitle("Dream Believers — all audio, by sync cluster (green = detected chorus)",
                 color="#f4eff7", fontsize=13, y=0.995)
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout(rect=(0, 0, 1, 0.985))
    fig.savefig(OUT_PNG, dpi=110, facecolor="#0f0d14")
    CHORUS.write_text(json.dumps(chorus_out, indent=2) + "\n")
    print(f"wrote {OUT_PNG}")
    print(f"wrote {CHORUS} ({len(chorus_out)} tracks)")
    for a, c in chorus_out.items():
        print(f"  {a:20s} chorus {c['start']:6.1f}-{c['end']:6.1f}s")


if __name__ == "__main__":
    main()
