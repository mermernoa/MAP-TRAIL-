import type { DistanceBandId } from './metrics';

/**
 * Rampe ordinale des tranches de distance, tirée de la charte Take Ton Trail :
 * du rose (courtes) au marine (100 miles et plus). La luminosité décroît
 * régulièrement, donc l'ordre se lit aussi en niveaux de gris ; la légende
 * double toujours la couleur. Reprise dans styles/tokens.css.
 */
export const BAND_COLORS: Record<DistanceBandId, string> = {
  xs: '#fe66c4',
  s: '#c554a5',
  m: '#854183',
  l: '#472f61',
  xl: '#071c3f',
};

export const INK = '#071c3f';
export const ACCENT = '#fe66c4';
