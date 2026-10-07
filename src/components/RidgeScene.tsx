import { useEffect, useRef } from 'react';
import { introDelay, prefersReducedMotion } from '../lib/motion';
import { createNoise2D, fbm, ridged } from '../lib/noise';

interface Props {
  /** Élément qui reçoit la position de l'horizon et de la lune (variables CSS). */
  host: React.RefObject<HTMLElement | null>;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

// Couleurs de la marque : du rose (près) au violet sombre (loin), sur fond marine.
const NIGHT = hex('#071c3f');
const HAZE = hex('#2e2257');
const LINE_RAMP = [hex('#fe66c4'), hex('#c554a5'), hex('#854183'), hex('#472f61')];
const lineColor = (t: number): RGB => {
  const x = clamp01(t) * (LINE_RAMP.length - 1);
  const i = Math.min(LINE_RAMP.length - 2, Math.floor(x));
  return mix(LINE_RAMP[i], LINE_RAMP[i + 1], x - i);
};

const DZ = 0.9;
const Z_NEAR = 0.55;
const RUNNERS = 9;

/**
 * Paysage de nuit en lignes de crête : le relief défile vers le spectateur, un
 * sentier rose serpente jusqu'au col où se lève la lune, et des frontales le
 * remontent. Dessin 2D : chaque crête cache celles de derrière (peintre).
 */
export function RidgeScene({ host }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const hostEl = host.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !hostEl || !ctx) return;
    const reduce = prefersReducedMotion();
    const noiseA = createNoise2D(11);
    const noiseB = createNoise2D(29);

    let W = 0;
    let H = 0;
    let rows = 60;
    let cols = 100;
    let horizon = 0;
    let vpX = 0;
    let focal = 1;
    let stars: { x: number; y: number; r: number; phase: number }[] = [];

    // Caméra : avance continue, légère dérive selon le pointeur, s'élève au défilement.
    let travel = 40;
    let camX = 0;
    let camXTarget = 0;
    let camLift = 0;
    let liftTarget = 0;
    let clock = 0;
    let introStart = performance.now() + introDelay();

    const zFar = () => Z_NEAR + rows * DZ;
    // Le sentier serpente près de la caméra et rejoint le col (axe de visée) au loin.
    const trailX = (zw: number, z: number) =>
      (1.7 * Math.sin(zw * 0.075) + 0.8 * Math.sin(zw * 0.033 + 1.3)) * Math.max(0, 1 - z / (zFar() * 0.72));
    const heightAt = (x: number, zw: number, z: number) => {
      const big = ridged(noiseA, x * 0.075, zw * 0.075, 4);
      const detail = fbm(noiseB, x * 0.3, zw * 0.3, 2) * 0.2;
      const grow = 0.42 + z * 0.083;
      const d = x - trailX(zw, z);
      const width = 1.1 + z * 0.07;
      const valley = 1 - Math.exp(-(d * d) / (2 * width * width));
      return Math.max(0, (big * 2.3 + detail) * grow * (0.18 + 0.82 * valley));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      if (!W || !H) return;
      const mobile = W < 760;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.5);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rows = mobile ? 44 : 62;
      cols = mobile ? 64 : 104;
      horizon = H * (mobile ? 0.37 : 0.47);
      vpX = W * (mobile ? 0.5 : 0.64);
      focal = Math.max(W * (mobile ? 1.15 : 0.62), H * 0.8);
      hostEl.style.setProperty('--horizon', `${horizon.toFixed(1)}px`);
      hostEl.style.setProperty('--vp-x', `${vpX.toFixed(1)}px`);
      // Ciel étoilé : positions fixes, seule leur lueur varie.
      let seed = 7;
      const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      stars = Array.from({ length: Math.round((W * horizon) / 9000) }, () => ({
        x: rand() * W,
        y: rand() * horizon * 0.92,
        r: 0.4 + rand() * 1.1,
        phase: rand() * Math.PI * 2,
      }));
      if (!running) draw(performance.now());
    };

    const draw = (now: number) => {
      if (!W || !H) return;
      const intro = reduce ? 1 : clamp01((now - introStart) / 1700);
      ctx.clearRect(0, 0, W, H);

      // Étoiles.
      for (const s of stars) {
        const a = (0.35 + 0.35 * Math.sin(clock * 1.3 + s.phase)) * intro;
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }

      const camH = 1.45 + camLift * 1.4;
      const far = zFar();
      const base = Math.floor(travel / DZ) + 1;
      const xs = new Float32Array(cols);
      const ys = new Float32Array(cols);
      // Rangées de la plus lointaine à la plus proche.
      let prevTrail: { x: number; y: number; z: number } | null = null;
      const runnerZ: number[] = [];
      for (let i = 0; i < RUNNERS; i++) {
        runnerZ.push(Z_NEAR + 2.2 + (((i + 0.37) / RUNNERS + clock * 0.006) % 1) * far * 0.62);
      }
      for (let k = rows - 1; k >= 0; k--) {
        const zw = (base + k) * DZ;
        const z = zw - travel;
        if (z < Z_NEAR * 0.6) continue;
        const t = (z - Z_NEAR) / (far - Z_NEAR);
        // Apparition au chargement : du lointain vers le proche.
        const reveal = clamp01((intro * 1.35 - (1 - t)) * 3.5);
        if (reveal <= 0) continue;
        const scale = focal / z;
        for (let i = 0; i < cols; i++) {
          const sx = (i / (cols - 1)) * (W + 40) - 20;
          const x = camX + (sx - vpX) / scale;
          xs[i] = sx;
          ys[i] = horizon + (camH - heightAt(x, zw, z)) * scale;
        }
        // Remplissage opaque : la crête cache tout ce qui est derrière (lune comprise).
        ctx.beginPath();
        ctx.moveTo(xs[0], H + 2);
        for (let i = 0; i < cols; i++) ctx.lineTo(xs[i], ys[i]);
        ctx.lineTo(xs[cols - 1], H + 2);
        ctx.closePath();
        // Les rangées qui naissent au loin apparaissent en fondu, sans saut.
        ctx.fillStyle = rgba(mix(NIGHT, HAZE, Math.pow(t, 1.4)), reveal * clamp01((1 - t) * 10));
        ctx.fill();
        // Trait de crête : fondu à l'horizon et en sortant par le bas.
        const fadeFar = clamp01((1 - t) * 6);
        const fadeNear = clamp01((z - Z_NEAR * 0.6) / 1.2);
        const alpha = (0.28 + 0.62 * (1 - t)) * fadeFar * fadeNear * reveal;
        ctx.beginPath();
        ctx.moveTo(xs[0], ys[0]);
        for (let i = 1; i < cols; i++) ctx.lineTo(xs[i], ys[i]);
        ctx.strokeStyle = rgba(lineColor(t), alpha);
        ctx.lineWidth = 0.6 + (1 - t) * 1.5;
        ctx.stroke();

        // Sentier : segment entre cette rangée et la précédente (plus lointaine).
        const tx = trailX(zw, z);
        const trail = {
          x: vpX + (tx - camX) * scale,
          y: horizon + (camH - heightAt(tx, zw, z) - 0.03) * scale,
          z,
        };
        if (prevTrail) {
          const w = 0.7 + 2.6 / z;
          const a = clamp01((1 - t) * 3) * fadeNear * reveal;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(prevTrail.x, prevTrail.y);
          ctx.lineTo(trail.x, trail.y);
          ctx.strokeStyle = `rgba(254,102,196,${(a * 0.22).toFixed(3)})`;
          ctx.lineWidth = w * 4;
          ctx.stroke();
          ctx.strokeStyle = `rgba(255,190,232,${a.toFixed(3)})`;
          ctx.lineWidth = w;
          ctx.stroke();
          // Frontales entre ces deux rangées.
          for (const rz of runnerZ) {
            if (rz > prevTrail.z || rz <= z) continue;
            const u = (prevTrail.z - rz) / (prevTrail.z - z);
            const rx = prevTrail.x + (trail.x - prevTrail.x) * u;
            const ry = prevTrail.y + (trail.y - prevTrail.y) * u - (0.16 * focal) / rz;
            const r = 1.2 + 9 / rz;
            const glow = a * (0.75 + 0.25 * Math.sin(clock * 9 + rz * 3));
            const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, r * 5);
            g.addColorStop(0, `rgba(255,255,255,${(glow * 0.9).toFixed(3)})`);
            g.addColorStop(0.25, `rgba(255,214,240,${(glow * 0.45).toFixed(3)})`);
            g.addColorStop(1, 'rgba(254,102,196,0)');
            ctx.fillStyle = g;
            ctx.fillRect(rx - r * 5, ry - r * 5, r * 10, r * 10);
          }
        }
        prevTrail = trail;
      }
    };

    let raf = 0;
    let last = 0;
    let running = false;
    let visible = true;
    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      clock += dt;
      camX += (camXTarget - camX) * (1 - Math.exp(-dt * 2.5));
      camLift += (liftTarget - camLift) * (1 - Math.exp(-dt * 6));
      travel += dt * (0.55 + camLift * 1.6);
      draw(now);
      schedule();
    };
    const schedule = () => {
      if (!raf && running && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const halt = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      camXTarget = (e.clientX / window.innerWidth - 0.5) * 1.6;
      hostEl.style.setProperty('--pointer-x', (e.clientX / window.innerWidth - 0.5).toFixed(3));
      hostEl.style.setProperty('--pointer-y', (e.clientY / window.innerHeight - 0.5).toFixed(3));
    };
    const onScroll = () => {
      liftTarget = clamp01(window.scrollY / Math.max(1, H));
      hostEl.style.setProperty('--lift', smooth(liftTarget).toFixed(3));
      if (!running) draw(performance.now());
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else halt();
    });
    const onVisibility = () => (document.hidden ? halt() : schedule());
    const resizeObserver = new ResizeObserver(resize);

    resizeObserver.observe(canvas);
    resize();
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    if (reduce) {
      introStart = 0;
      draw(performance.now());
    } else {
      running = true;
      observer.observe(canvas);
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pointermove', onPointer, { passive: true });
      schedule();
    }
    return () => {
      running = false;
      halt();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [host]);

  return <canvas ref={ref} className="ridge-scene" aria-hidden="true" />;
}
