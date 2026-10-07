import { Link } from 'react-router-dom';
import { MONTH_SHORT, parseYMD } from '../lib/dates';
import { distanceBand } from '../lib/metrics';
import type { Suggestion } from '../lib/suggestions';
import { fmtDplus, fmtKm } from './bits';
import { SeasonToggle } from './SeasonToggle';

/** Cartes des courses proposées, avec les raisons de chaque proposition. */
export function SuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <ul className="suggestions">
      {suggestions.map(({ event, course, reasons }) => {
        const { d, m } = parseYMD(course.start.slice(0, 10));
        return (
          <li key={event.id} className="suggestion">
            <div className={`suggestion-date band-edge-${distanceBand(course.distanceKm)}`} aria-hidden="true">
              <span className="suggestion-day">{d}</span>
              <span className="suggestion-month">{MONTH_SHORT[m - 1]}</span>
            </div>
            <div className="suggestion-body">
              <Link className="suggestion-title" to={`/course/${event.id}?parcours=${course.id}`}>
                {event.name}
              </Link>
              <p className="suggestion-meta">
                <strong>{course.name}</strong> · {fmtKm(course.distanceKm)}, {fmtDplus(course.elevationGain)} · {event.city}
              </p>
              {reasons.length > 0 && (
                <ul className="suggestion-reasons" aria-label="Pourquoi cette course">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
            <SeasonToggle eventId={event.id} courseId={course.id} courseName={course.name} compact />
          </li>
        );
      })}
    </ul>
  );
}
