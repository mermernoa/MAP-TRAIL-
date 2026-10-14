import { createNoise2D, ridged } from './noise';

/**
 * Relief de l'accueil : un massif imaginaire, toujours le même (bruit avec
 * graine), lu comme une carte topographique en relief. Ce module calcule la
 * grille d'altitudes, le sentier du départ au sommet et les matrices de la
 * caméra ; le dessin WebGL est dans TopoScene.
 */

export interface Terrain {
  /** Points par côté. */
  n: number;
  /** Altitudes normalisées (0 à 1), ligne par ligne, de z = -1 à z = 1. */
  heights: Float32Array;
  /** Normales (x, y, z) de chaque point, pour l'ombrage. */
  normals: Float32Array;
  /** Sommet le plus haut, en coordonnées du plan. */
  summit: { x: number; z: number };
}

/** Hauteur du relief dans la scène, pour une altitude normalisée de 1. */
export const RELIEF_HEIGHT = 0.42;

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Silhouette du massif : un sommet dominant (accueil) ou une longue ligne de crête. */
export type TerrainShape = 'sommet' | 'crete';

function rawHeight(noise: (x: number, y: number) => number, x: number, z: number, shape: TerrainShape = 'sommet'): number {
  const r = Math.hypot(x, z);
  // Le massif s'efface vers les bords : pas de coupure franche.
  const envelope = 1 - smoothstep(0.5, 0.98, r);
  if (shape === 'crete') {
    // Crête en diagonale, de l'arrière-gauche à l'avant-droite, avec trois pointes.
    const ax = -0.62;
    const az = -0.42;
    const bx = 0.58;
    const bz = 0.3;
    const lx = bx - ax;
    const lz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * lx + (z - az) * lz) / (lx * lx + lz * lz)));
    const d = Math.hypot(x - (ax + lx * t), z - (az + lz * t));
    const tops = Math.max(0.55, Math.exp(-((t - 0.42) ** 2) / 0.012), 0.82 * Math.exp(-((t - 0.72) ** 2) / 0.008), 0.7 * Math.exp(-((t - 0.16) ** 2) / 0.01));
    const crest = Math.exp(-(d * d) / (2 * 0.13 ** 2)) * tops;
    const ridges = ridged(noise, x * 2.6 - 3.3, z * 2.6 + 2.2, 5);
    return envelope * (0.62 * crest + 0.38 * ridges * (0.4 + 0.6 * envelope));
  }
  const peak = Math.exp(-((x - 0.1) ** 2 + (z + 0.06) ** 2) / (2 * 0.2 ** 2));
  const shoulder = 0.62 * Math.exp(-((x + 0.42) ** 2 + (z + 0.38) ** 2) / (2 * 0.17 ** 2));
  const ridges = ridged(noise, x * 2.3 + 4.1, z * 2.3 - 1.7, 5);
  return envelope * (0.58 * Math.max(peak, shoulder) + 0.42 * ridges * (0.45 + 0.55 * envelope));
}

export function buildTerrain(n: number, seed = 7, shape: TerrainShape = 'sommet'): Terrain {
  const noise = createNoise2D(seed);
  const heights = new Float32Array(n * n);
  let max = 0;
  let summit = { x: 0, z: 0 };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      const z = (j / (n - 1)) * 2 - 1;
      const h = rawHeight(noise, x, z, shape);
      heights[j * n + i] = h;
      if (h > max) {
        max = h;
        summit = { x, z };
      }
    }
  }
  for (let k = 0; k < heights.length; k++) heights[k] /= max;
  const normals = new Float32Array(n * n * 3);
  const step = 2 / (n - 1);
  const at = (i: number, j: number) => heights[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))] * RELIEF_HEIGHT;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * step);
      const dz = (at(i, j + 1) - at(i, j - 1)) / (2 * step);
      const len = Math.hypot(dx, 1, dz);
      const k = (j * n + i) * 3;
      normals[k] = -dx / len;
      normals[k + 1] = 1 / len;
      normals[k + 2] = -dz / len;
    }
  }
  return { n, heights, normals, summit };
}

/** Altitude normalisée en un point du plan (interpolation bilinéaire). */
export function heightAt(t: Terrain, x: number, z: number): number {
  const fx = Math.min(t.n - 1.001, Math.max(0, ((x + 1) / 2) * (t.n - 1)));
  const fz = Math.min(t.n - 1.001, Math.max(0, ((z + 1) / 2) * (t.n - 1)));
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const h = (a: number, b: number) => t.heights[b * t.n + a];
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}

/**
 * Sentier du départ (dans la vallée, au premier plan) jusqu'au sommet, avec des
 * lacets dans la montée finale. Points réguliers sur le plan (x, z).
 */
export function buildTrail(t: Terrain, samples = 240): { x: number; z: number }[] {
  const s = t.summit;
  const way = [
    { x: -0.34, z: 0.64 },
    { x: -0.1, z: 0.52 },
    { x: -0.3, z: 0.38 },
    { x: -0.03, z: 0.29 },
    { x: -0.18, z: 0.15 },
    { x: 0.04, z: 0.08 },
    { x: s.x - 0.03, z: s.z + 0.06 },
    s,
  ];
  // Catmull-Rom, puis rééchantillonnage à pas constant.
  const dense: { x: number; z: number }[] = [];
  for (let k = 0; k < way.length - 1; k++) {
    const p0 = way[Math.max(0, k - 1)];
    const p1 = way[k];
    const p2 = way[k + 1];
    const p3 = way[Math.min(way.length - 1, k + 2)];
    for (let q = 0; q < 40; q++) {
      const u = q / 40;
      const u2 = u * u;
      const u3 = u2 * u;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      dense.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  dense.push(s);
  const lengths = [0];
  for (let k = 1; k < dense.length; k++) lengths.push(lengths[k - 1] + Math.hypot(dense[k].x - dense[k - 1].x, dense[k].z - dense[k - 1].z));
  const total = lengths[lengths.length - 1];
  const out: { x: number; z: number }[] = [];
  let k = 1;
  for (let q = 0; q < samples; q++) {
    const d = (q / (samples - 1)) * total;
    while (k < dense.length - 1 && lengths[k] < d) k++;
    const u = (d - lengths[k - 1]) / Math.max(1e-9, lengths[k] - lengths[k - 1]);
    out.push({ x: dense[k - 1].x + (dense[k].x - dense[k - 1].x) * u, z: dense[k - 1].z + (dense[k].z - dense[k - 1].z) * u });
  }
  return out;
}

// ---------- Matrices (colonnes d'abord, comme WebGL)

export type Mat4 = Float32Array;

export function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function lookAt(eye: number[], target: number[], up = [0, 1, 0]): Mat4 {
  const norm = (v: number[]) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const z = norm([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = norm(cross(up, z));
  const y = cross(z, x);
  const m = new Float32Array(16);
  m.set([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  return m;
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const m = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
      m[c * 4 + r] = v;
    }
  }
  return m;
}

/** Position à l'écran (pixels) d'un point de la scène, ou null s'il est derrière la caméra. */
export function project(m: Mat4, p: [number, number, number], width: number, height: number, shift: [number, number] = [0, 0]) {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  if (w <= 0) return null;
  return { x: ((x / w + shift[0] + 1) / 2) * width, y: ((1 - (y / w + shift[1])) / 2) * height };
}
