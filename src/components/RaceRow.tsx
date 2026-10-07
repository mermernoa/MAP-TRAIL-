import { Link } from 'react-router-dom';
import type { Course, RaceEvent } from '../data/types';
import { formatRange, MONTH_SHORT, parseYMD } from '../lib/dates';
import { countryFlag, distanceBand } from '../lib/metrics';
import { fmtKm, fmtM, fmtPrice, PopularityLabel } from './bits';

interface Props {
  event: RaceEvent;
  /** Parcours à mettre en avant (par défaut, tous). */
  courses?: Course[];
  showPrice?: boolean;
}

/** Ligne de course cliquable vers sa fiche : date façon dossard, nom, lieu, distances. */
export function RaceRow({ event, courses = event.courses, showPrice = false }: Props) {
  const day = courses.map((c) => c.start.slice(0, 10)).sort()[0] ?? event.dateStart;
  const { d, m } = parseYMD(day);
  const longest = Math.max(...event.courses.map((c) => c.distanceKm));
  const only = courses.length === 1 ? `?parcours=${courses[0].id}` : '';
  return (
    <li>
      <Link className="race-item race-row" to={`/course/${event.id}${only}`}>
        <span className="race-item-date" aria-hidden="true">
          <span className="race-item-day">{d}</span>
          <span className="race-item-month">{MONTH_SHORT[m - 1]}</span>
        </span>
        <span className="race-item-body">
          <span className="race-item-name">{event.name}</span>
          <span className="race-item-place">
            <span aria-hidden="true">{countryFlag(event.country)}</span> {event.city}, {event.department ?? event.region}
            <span className="sr-only">, {formatRange(event.dateStart, event.dateEnd)}</span>
          </span>
          <span className="race-item-courses">
            {courses.map((c) => (
              <span key={c.id} className="course-pill" title={c.name}>
                <span
                  className={`course-pill-bar band-${distanceBand(c.distanceKm)}`}
                  style={{ width: `${Math.max(8, (c.distanceKm / longest) * 36)}px` }}
                  aria-hidden="true"
                />
                <span className="course-pill-km">{fmtKm(c.distanceKm)}</span>
                {c.elevationGain != null && <span className="course-pill-dplus">{fmtM(c.elevationGain)}</span>}
                {showPrice && c.priceEur != null && <span className="course-pill-price">{fmtPrice(c.priceEur)}</span>}
              </span>
            ))}
          </span>
        </span>
        <span className="race-item-meta">
          <PopularityLabel level={event.popularity} />
          {courses.every((c) => c.full === 'yes') && <span className="tag tag-full">Complet</span>}
        </span>
      </Link>
    </li>
  );
}
