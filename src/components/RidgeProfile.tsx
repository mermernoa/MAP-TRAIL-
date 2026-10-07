import { useMemo } from 'react';
import type { ReliefKind } from '../lib/massifs';
import { createNoise2D, fbm, ridged } from '../lib/noise';

interface Props {
  kind: ReliefKind;
  seed: number;
  className?: string;
}

const W = 600;
const H = 90;
const N = 120;

/** Hauteur (0 à 1) du profil stylisé d'un type de relief, en x de 0 à 1. */
function profile(kind: ReliefKind, seed: number): number[] {
  const noise = createNoise2D(seed);
  const at = (x: number) => {
    switch (kind) {
      case 'aiguilles':
        return 0.25 + 0.75 * ridged(noise, x * 5, 0.5, 5) ** 1.3;
      case 'hautes':
        return 0.2 + 0.7 * ridged(noise, x * 3.6, 1.5, 4);
      case 'calcaire': {
        // Un grand dôme isolé (le Ventoux) au-dessus de crêtes calcaires.
        const dome = Math.exp(-((x - 0.62) ** 2) / 0.018) * 0.7;
        return 0.15 + Math.max(dome, 0.35 * ridged(noise, x * 4, 2.5, 3));
      }
      case 'puys': {
        // Cônes volcaniques alignés.
        let h = 0.12 + 0.08 * fbm(noise, x * 4, 3, 2);
        for (const [c, s, a] of [
          [0.18, 0.05, 0.45],
          [0.33, 0.04, 0.6],
          [0.47, 0.06, 0.8],
          [0.6, 0.035, 0.5],
          [0.78, 0.05, 0.42],
        ] as const) {
          h = Math.max(h, a * Math.max(0, 1 - Math.abs(x - c) / s) ** 1.2);
        }
        return h;
      }
      case 'ballons':
        return 0.2 + 0.5 * (0.5 + 0.5 * fbm(noise, x * 2.2, 4, 2, 0.35));
      case 'plis':
        return 0.25 + 0.22 * (0.5 + 0.5 * Math.sin(x * 26)) * (0.7 + 0.3 * fbm(noise, x * 2, 5, 2)) + 0.12 * x;
      case 'collines':
        return 0.15 + 0.3 * (0.5 + 0.5 * fbm(noise, x * 3, 6, 3, 0.45));
      case 'ile':
        return Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (x - 0.08) / 0.84)))) ** 0.6 * (0.45 + 0.55 * ridged(noise, x * 4, 7, 3));
      case 'volcan': {
        const cone = Math.max(0, 1 - Math.abs(x - 0.5) / 0.38) ** 1.6;
        const crater = Math.exp(-((x - 0.5) ** 2) / 0.0012) * 0.08;
        return 0.05 + 0.85 * cone - crater + 0.05 * fbm(noise, x * 6, 8, 2);
      }
      case 'cote': {
        // Falaise qui tombe dans la mer.
        const land = x < 0.62 ? 0.42 + 0.12 * fbm(noise, x * 4, 9, 3) : 0.04 + 0.01 * Math.sin(x * 60);
        return land;
      }
      case 'plaine':
        return 0.12 + 0.12 * (0.5 + 0.5 * fbm(noise, x * 3, 10, 3, 0.4));
    }
  };
  const raw = Array.from({ length: N }, (_, i) => at(i / (N - 1)));
  // Chaque type de relief occupe sa hauteur propre : aiguilles hautes, plaine presque plate.
  const lo = Math.min(...raw);
  const hi = Math.max(...raw);
  const span = AMPLITUDE[kind];
  return raw.map((v) => 0.04 + ((v - lo) / (hi - lo || 1)) * span);
}

const AMPLITUDE: Record<ReliefKind, number> = {
  aiguilles: 0.94,
  hautes: 0.82,
  calcaire: 0.72,
  puys: 0.62,
  ballons: 0.5,
  plis: 0.42,
  ile: 0.86,
  volcan: 0.9,
  collines: 0.3,
  cote: 0.46,
  plaine: 0.14,
};

/** Silhouette stylisée d'un massif (pas un profil réel) : aiguilles, ballons, puys, falaises… */
export function RidgeProfile({ kind, seed, className = '' }: Props) {
  const { line, area } = useMemo(() => {
    const h = profile(kind, seed);
    const pts = h.map((v, i) => `${((i / (N - 1)) * W).toFixed(1)},${(H - 4 - v * (H - 10)).toFixed(1)}`);
    return { line: `M${pts.join('L')}`, area: `M0,${H}L${pts.join('L')}L${W},${H}Z` };
  }, [kind, seed]);
  return (
    <svg className={`ridge-profile ${className}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="ridge-profile-area" d={area} />
      <path className="ridge-profile-line" d={line} />
    </svg>
  );
}
