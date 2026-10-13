import type { Course, RaceEvent, UtmbCategory } from '../data/types';
import { courseUtmbCategory, isUtmbSeries, itraPoints } from '../lib/metrics';

/**
 * Logos officiels ITRA, UTMB Index et UTMB World Series (public/badges/).
 * Affichés seulement pour des valeurs publiées, jamais pour des estimations.
 */
type Size = 'sm' | 'md' | 'lg';

export function ItraBadge({ points, size = 'sm' }: { points: number; size?: Size }) {
  return (
    <img
      className={`brand-badge brand-badge-${size}`}
      src={`badges/itra-${points}.webp`}
      alt={`${points} ${points > 1 ? 'points' : 'point'} ITRA`}
      title={`${points} ${points > 1 ? 'points' : 'point'} ITRA`}
      loading="lazy"
    />
  );
}

export function UtmbBadge({ category, size = 'sm' }: { category: UtmbCategory | null; size?: Size }) {
  const label = category ? `UTMB Index ${category}` : 'UTMB Index';
  return (
    <img
      className={`brand-badge brand-badge-${size}`}
      src={`badges/${category ? `utmb-${category.toLowerCase()}` : 'utmb-index'}.webp`}
      alt={label}
      title={label}
      loading="lazy"
    />
  );
}

export function WorldSeriesBadge({ size = 'md', plate = false }: { size?: Size; plate?: boolean }) {
  const img = <img className={`brand-badge brand-badge-${size}`} src="badges/utmb-world-series.webp" alt="UTMB World Series" title="UTMB World Series" loading="lazy" />;
  return plate ? <span className="brand-plate">{img}</span> : img;
}

/** Badges d'un parcours : points ITRA et catégorie UTMB Index publiés. */
export function CourseBadges({ course, size = 'sm' }: { course: Course; size?: Size }) {
  const points = itraPoints(course);
  const cat = courseUtmbCategory(course);
  if (points == null && !course.utmbIndex && !cat) return null;
  return (
    <span className="brand-badges">
      {(course.utmbIndex || cat) && <UtmbBadge category={cat} size={size} />}
      {points != null && <ItraBadge points={points} size={size} />}
    </span>
  );
}

/** Le meilleur badge d'un événement, pour les listes : World Series, sinon UTMB Index. */
export function EventBadge({ event }: { event: RaceEvent }) {
  if (isUtmbSeries(event)) return <WorldSeriesBadge size="sm" />;
  if (event.courses.some((c) => c.utmbIndex || c.utmbCategory)) return <UtmbBadge category={null} size="sm" />;
  return null;
}
