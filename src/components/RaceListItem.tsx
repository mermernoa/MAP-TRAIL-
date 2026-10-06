import type { Course, RaceEvent } from '../data/types';
import { formatRange, MONTH_SHORT, parseYMD } from '../lib/dates';
import { countryFlag, distanceBand } from '../lib/metrics';
import { fmtKm, fmtM, PopularityLabel } from './bits';

interface Props {
  event: RaceEvent;
  courses: Course[];
  selected?: boolean;
  onSelect: () => void;
  onHover?: (hovering: boolean) => void;
}

/** Ligne de résultat : date façon dossard, nom, lieu et échelle des distances. */
export function RaceListItem({ event, courses, selected, onSelect, onHover }: Props) {
  const { d, m } = parseYMD(event.dateStart);
  const longest = Math.max(...event.courses.map((c) => c.distanceKm));
  return (
    <li>
      <button
        type="button"
        className={`race-item ${selected ? 'is-selected' : ''}`}
        onClick={onSelect}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
        onFocus={() => onHover?.(true)}
        onBlur={() => onHover?.(false)}
        aria-current={selected ? 'true' : undefined}
      >
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
              </span>
            ))}
          </span>
        </span>
        <span className="race-item-meta">
          <PopularityLabel level={event.popularity} />
          {event.massif && event.massif !== 'Plaine / campagne' && <span className="tag">{event.massif}</span>}
          {courses.every((c) => c.full === 'yes') && <span className="tag tag-full">Complet</span>}
          {event.custom && <span className="tag">Ajoutée par vous</span>}
        </span>
      </button>
    </li>
  );
}
