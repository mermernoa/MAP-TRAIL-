import type { DistanceBandId } from './metrics';

/**
 * Rampe ordinale des tranches de distance (clair → foncé), reprise dans
 * styles/tokens.css. La luminosité décroît avec la distance : l'ordre se lit
 * aussi en niveaux de gris, et la légende double toujours la couleur.
 * Rampe validée (une teinte, luminosité monotone, extrémité claire ≥ 2:1).
 */
export const BAND_COLORS: Record<DistanceBandId, string> = {
  xs: '#df8f33',
  s: '#cc6328',
  m: '#b04024',
  l: '#83261f',
  xl: '#4f1915',
};

export const INK = '#14261f';
export const BLAZE = '#d7322b';
