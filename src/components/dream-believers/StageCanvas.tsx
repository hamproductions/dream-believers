import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { analyserBus } from '~/utils/dream-believers/analyserBus';

const DAY_PALETTE = ['#ffffff', '#ffd9ec', '#ffb3d6', '#ff8fbf', '#ffe6c7'];
const NIGHT_PALETTE = ['#ffe9f6', '#ffb0dc', '#ff7ec0', '#e46bd0', '#ffd59e'];

function petalTexture(): THREE.Texture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  // Soft teardrop petal: bright core, translucent edge.
  const grad = g.createRadialGradient(s * 0.42, s * 0.36, 2, s * 0.5, s * 0.5, s * 0.5);
  grad.addColorStop(0, 'rgba(255,255,255,0.98)');
  grad.addColorStop(0.4, 'rgba(255,225,240,0.9)');
  grad.addColorStop(1, 'rgba(255,180,215,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(s * 0.5, s * 0.06);
  g.bezierCurveTo(s * 0.92, s * 0.28, s * 0.86, s * 0.86, s * 0.5, s * 0.96);
  g.bezierCurveTo(s * 0.14, s * 0.86, s * 0.08, s * 0.28, s * 0.5, s * 0.06);
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Petal {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  scale: number;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  sway: number;
  phase: number;
}

const FIELD_W = 26;
const FIELD_H = 18;
const FIELD_D = 14;

function makePetals(count: number, rand: () => number): Petal[] {
  const out: Petal[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: (rand() - 0.5) * FIELD_W,
      y: (rand() - 0.5) * FIELD_H,
      z: (rand() - 0.5) * FIELD_D,
      vx: (rand() - 0.5) * 0.4,
      vy: -0.4 - rand() * 0.7,
      scale: 0.18 + rand() * 0.4,
      rot: new THREE.Euler(rand() * 6.28, rand() * 6.28, rand() * 6.28),
      spin: new THREE.Vector3((rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4),
      sway: 0.6 + rand() * 1.6,
      phase: rand() * 6.28
    });
  }
  return out;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readAudio(analyser: AnalyserNode, buf: Uint8Array) {
  analyser.getByteFrequencyData(buf as Uint8Array<ArrayBuffer>);
  const n = buf.length;
  let bass = 0;
  let mid = 0;
  let treble = 0;
  let all = 0;
  const bassEnd = Math.floor(n * 0.08);
  const midEnd = Math.floor(n * 0.4);
  for (let i = 0; i < n; i++) {
    const v = buf[i] / 255;
    all += v;
    if (i < bassEnd) bass += v;
    else if (i < midEnd) mid += v;
    else treble += v;
  }
  return {
    all: all / n,
    bass: bass / Math.max(1, bassEnd),
    mid: mid / Math.max(1, midEnd - bassEnd),
    treble: treble / Math.max(1, n - midEnd)
  };
}

function PetalField({
  count,
  dark,
  calm,
  bloomRef
}: {
  count: number;
  dark: boolean;
  calm: boolean;
  bloomRef: React.MutableRefObject<{ intensity: number } | null>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(() => petalTexture(), []);
  const petals = useMemo(() => makePetals(count, mulberry32(0x9e3779b9)), [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const audioBuf = useMemo(() => new Uint8Array(512), []);
  const energy = useRef(0);

  const colorArray = useMemo(() => {
    const pal = (dark ? NIGHT_PALETTE : DAY_PALETTE).map((h) => new THREE.Color(h));
    const arr = new Float32Array(count * 3);
    const r = mulberry32(0x1234abcd);
    for (let i = 0; i < count; i++) {
      const c = pal[Math.floor(r() * pal.length)];
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [count, dark]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    mesh.instanceColor.needsUpdate = true;
  }, [colorArray]);

  useFrame((_, dtRaw) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(dtRaw, 0.05);
    const analyser = calm ? null : analyserBus.node();
    let a = { all: 0, bass: 0, mid: 0, treble: 0 };
    if (analyser) a = readAudio(analyser, audioBuf);
    // Smooth the energy so the bloom breathes, not flickers.
    energy.current += (a.all - energy.current) * Math.min(1, dt * 6);
    const e = energy.current;
    // Reduced-motion: a slow, gentle drift with no audio-reactive jolts.
    const speed = calm ? 0.28 : 1 + e * 2.6;
    const swirl = calm ? 0.14 : 0.3 + a.bass * 2.4;

    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      p.phase += dt * p.sway;
      p.x += (p.vx + Math.sin(p.phase) * swirl * 0.3) * dt;
      p.y += p.vy * speed * dt;
      p.z += Math.cos(p.phase * 0.7) * 0.2 * dt;
      if (p.y < -FIELD_H / 2) {
        p.y = FIELD_H / 2;
        p.x = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * FIELD_W - FIELD_W / 2;
      }
      if (p.x > FIELD_W / 2) p.x = -FIELD_W / 2;
      if (p.x < -FIELD_W / 2) p.x = FIELD_W / 2;
      const spinMul = calm ? 0.3 : 1 + e;
      p.rot.x += p.spin.x * dt * spinMul;
      p.rot.y += p.spin.y * dt * spinMul;
      p.rot.z += p.spin.z * dt * (calm ? 0.3 : 1);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.copy(p.rot);
      const sc = p.scale * (1 + e * 0.5 + a.treble * 0.3);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    if (bloomRef.current) {
      const target = (dark ? 0.9 : 0.6) + e * 2.4 + a.bass * 0.6;
      bloomRef.current.intensity += (target - bloomRef.current.intensity) * Math.min(1, dt * 5);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={tex}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.NormalBlending}
        opacity={dark ? 0.95 : 0.9}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function Scene({ dark, calm }: { dark: boolean; calm: boolean }) {
  const { size } = useThree();
  const [tier, setTier] = useState(1);
  const bloomRef = useRef<{ intensity: number } | null>(null);
  const isMobile = size.width < 640;
  // Far fewer petals than before — the loop composes a matrix per petal each
  // frame, so count is the main CPU cost. Bloom + DPR are the GPU cost.
  const base = isMobile ? 130 : 380;
  const count = Math.round(base * tier);

  return (
    <>
      <PerformanceMonitor
        onDecline={() => setTier((t) => Math.max(0.35, t - 0.25))}
        onIncline={() => setTier((t) => Math.min(1, t + 0.15))}
      />
      <AdaptiveDpr pixelated />
      <ambientLight intensity={1.4} />
      <PetalField count={count} dark={dark} calm={calm} bloomRef={bloomRef} />
      {/* Bloom props are CONSTANT (no theme dependency) so a theme change never
          reconciles/​remounts the postprocessing pipeline — that was causing a
          WebGL context-loss + crash on every toggle. Theme brightness is driven
          per-frame through bloomRef.intensity, and colour through petal tints. */}
      <EffectComposer>
        <Bloom
          ref={bloomRef as never}
          intensity={0.85}
          luminanceThreshold={0.3}
          luminanceSmoothing={0.85}
          mipmapBlur
          resolutionScale={0.5}
        />
      </EffectComposer>
    </>
  );
}

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * The 3D dreamscape shows whenever WebGL is available — reduced-motion only
 * CALMS it (slower drift, no audio jolts), it does not delete the experience.
 * Falls back to the CSS field only when WebGL is genuinely unavailable.
 */
export function useStage3DActive(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (webglOk()) setActive(true);
  }, []);
  return active;
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

/**
 * Contains any WebGL / postprocessing failure so it can NEVER take down the app
 * or reach Sentry (whose serializer chokes on the circular Three object graph).
 * On error we silently render nothing — the CSS bloom in +Layout is the fallback.
 */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Swallow — do not rethrow, do not report. The static CSS stage remains.
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function StageCanvas({ dark }: { dark: boolean }) {
  const calm = usePrefersReducedMotion();
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <CanvasBoundary>
        {/* ONE persistent Canvas — never keyed on theme, so the WebGL context is
            never lost/recreated on a toggle. */}
        <Canvas
          gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0, 12], fov: 60 }}
          dpr={[1, 1.35]}
          style={{ background: 'transparent' }}
        >
          <Scene dark={dark} calm={calm} />
        </Canvas>
      </CanvasBoundary>
    </div>
  );
}
