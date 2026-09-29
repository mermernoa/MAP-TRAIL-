import type { RaceEvent } from '../data/types';
import { formatDate, formatTime, relativeDays } from '../lib/dates';
import { buildIcs, courseIcsItems, downloadFile } from '../lib/ical';
import { useToday } from '../store/useToday';
import { CalendarIcon } from './Icons';

interface KeyDate {
  date: string;
  label: string;
  detail?: string;
  kind: 'registration' | 'race';
}

function keyDates(event: RaceEvent): KeyDate[] {
  const out: KeyDate[] = [];
  const { opens, closes, lottery, lotteryDate } = event.registration;
  if (opens) out.push({ date: opens, label: lottery ? 'Ouverture des pré-inscriptions' : 'Ouverture des inscriptions', kind: 'registration' });
  if (closes) out.push({ date: closes, label: lottery ? 'Clôture des pré-inscriptions' : 'Clôture des inscriptions', kind: 'registration' });
  if (lotteryDate) out.push({ date: lotteryDate, label: 'Tirage au sort', kind: 'registration' });
  const byDay = new Map<string, string[]>();
  for (const c of [...event.courses].sort((a, b) => a.start.localeCompare(b.start))) {
    const day = c.start.slice(0, 10);
    const time = formatTime(c.start);
    byDay.set(day, [...(byDay.get(day) ?? []), time ? `${c.name} à ${time}` : c.name]);
  }
  for (const [day, names] of byDay) out.push({ date: day, label: 'Départ', detail: names.join(', '), kind: 'race' });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Frise des dates importantes : inscriptions, tirage au sort, départs. */
export function KeyDates({ event }: { event: RaceEvent }) {
  const today = useToday();
  const dates = keyDates(event);
  const nextIndex = dates.findIndex((d) => d.date >= today);

  const exportIcs = () => {
    const items = event.courses.flatMap((c, i) => courseIcsItems(event, c, i === 0));
    downloadFile(`${event.id}.ics`, buildIcs(items), 'text/calendar');
  };

  return (
    <div className="key-dates">
      <ol className="timeline">
        {dates.map((d, i) => {
          const state = d.date < today ? 'past' : i === nextIndex ? 'next' : 'future';
          return (
            <li key={`${d.date}-${d.label}`} className={`timeline-item is-${state} kind-${d.kind}`}>
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <p className="timeline-date">
                  {formatDate(d.date, { weekday: true })}
                  <span className="muted small"> {state === 'past' ? '(passé)' : `(${relativeDays(d.date, today)})`}</span>
                </p>
                <p className="timeline-label">{d.label}</p>
                {d.detail && <p className="timeline-detail muted small">{d.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {event.registration.note && <p className="muted small">{event.registration.note}</p>}
      <button type="button" className="button" onClick={exportIcs}>
        <CalendarIcon size={16} /> Ajouter à mon agenda (.ics)
      </button>
    </div>
  );
}
