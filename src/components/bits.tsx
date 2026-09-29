import type { Popularity, Technicity } from '../data/types';
import { distanceBand, POPULARITY_LABELS, TECHNICITY_LABELS } from '../lib/metrics';

const nfInt = new Intl.NumberFormat('fr-FR');
const nfDec = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
// Intl sépare les milliers par une espace fine insécable (U+202F), absente de
// certaines polices : on la remplace par une espace insécable classique.
const nf = { format: (n: number) => nfInt.format(n).replace(/\u202f/g, '\u00a0') };
const nf1 = { format: (n: number) => nfDec.format(n).replace(/\u202f/g, '\u00a0') };

export function fmtKm(km: number): string {
  return `${km < 10 ? nf1.format(km) : nf.format(Math.round(km))} km`;
}

export function fmtM(m: number): string {
  return `${nf.format(Math.round(m))} m`;
}

export function fmtNum(n: number): string {
  return nf.format(n);
}

export function fmtHours(h: number): string {
  const hours = Math.floor(h);
  const min = Math.round((h - hours) * 60);
  return min ? `${hours} h ${String(min).padStart(2, '0')}` : `${hours} h`;
}

/** Pastille de couleur de la tranche de distance (même code couleur que la carte). */
export function BandSwatch({ km }: { km: number }) {
  return <span className={`band-swatch band-${distanceBand(km)}`} aria-hidden="true" />;
}

export function TechnicityMeter({ level, showLabel = false }: { level: Technicity; showLabel?: boolean }) {
  const { label, hint } = TECHNICITY_LABELS[level];
  return (
    <span className="tech-meter" title={`Technicité ${level}/5 : ${label}. ${hint}`}>
      <span className="tech-meter-bars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= level ? 'on' : ''} />
        ))}
      </span>
      <span className={showLabel ? 'tech-meter-label' : 'sr-only'}>
        {showLabel ? label : `Technicité ${level} sur 5, ${label}`}
      </span>
    </span>
  );
}

export function PopularityLabel({ level }: { level: Popularity }) {
  const { label, hint } = POPULARITY_LABELS[level];
  return (
    <span className={`popularity pop-${level}`} title={hint}>
      <span className="popularity-steps" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= level ? 'on' : ''} />
        ))}
      </span>
      {label}
    </span>
  );
}
