import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtKm, fmtM, fmtPrice } from '../components/bits';
import type { Course, RaceEvent } from '../data/types';
import { formatRange, MONTH_SHORT, parseYMD } from '../lib/dates';
import { eventPhoto } from '../lib/photos';
import { type Spotlight, spotlights } from '../lib/spotlights';
import { raceWeekend } from '../lib/weekend';
import { useAllRaces } from '../store/races';
import { useSiteSettings } from '../store/siteSettings';
import { useToday } from '../store/useToday';

/** Parcours le plus parlant d'un événement à venir : le plus long. */
function mainCourse(e: RaceEvent, today: string): Course {
  const upcoming = e.courses.filter((c) => c.start.slice(0, 10) >= today);
  return [...(upcoming.length ? upcoming : e.courses)].sort((a, b) => b.distanceKm - a.distanceKm)[0];
}

/**
 * « À la une » : les courses mises en avant, sans filtre ni formulaire. Nos coups
 * de cœur (choisis dans l'espace admin), une course par thème et le prochain
 * week-end de course.
 */
export function HighlightsPage() {
  const events = useAllRaces();
  const today = useToday();
  const featuredIds = useSiteSettings((s) => s.featured);

  useEffect(() => {
    document.title = 'À la une – Take Ton Trail';
    return () => {
      document.title = 'Take Ton Trail';
    };
  }, []);

  const featured = useMemo(
    () => featuredIds.map((id) => events.find((e) => e.id === id)).filter((e): e is RaceEvent => !!e && e.dateEnd >= today),
    [featuredIds, events, today],
  );
  const spots = useMemo(() => spotlights(events, today), [events, today]);
  const weekend = useMemo(() => raceWeekend(events, today), [events, today]);
  const weekendTop = useMemo(
    () => (weekend ? [...weekend.events].sort((a, b) => b.popularity - a.popularity || (b.image ? 1 : 0) - (a.image ? 1 : 0)).slice(0, 4) : []),
    [weekend],
  );

  // En tête : le premier coup de cœur, sinon la prochaine mythique.
  const lead = featured[0] ?? spots.find((s) => s.id === 'mythique')?.event ?? spots[0]?.event;
  const leadReason = featured[0] ? 'Notre coup de cœur du moment' : 'La prochaine course de légende au calendrier';
  const others = featured.filter((e) => e.id !== lead?.id);
  const spotList = spots.filter((s) => s.event.id !== lead?.id);

  return (
    <div className="highlights-page">
      <header className="highlights-head">
        <h1>À la une</h1>
        <p>Les courses qu’on met en avant en ce moment : nos coups de cœur, une course par thème et le prochain week-end de course.</p>
      </header>

      {lead && <LeadStory event={lead} course={mainCourse(lead, today)} reason={leadReason} />}

      {others.length > 0 && (
        <section className="highlights-section" aria-labelledby="hl-favs">
          <div className="highlights-bar">
            <h2 id="hl-favs">Nos coups de cœur</h2>
            <p>Choisies à la main par l’équipe Take Ton Trail.</p>
          </div>
          <ul className="spot-grid">
            {others.map((e) => (
              <RaceCard key={e.id} event={e} course={mainCourse(e, today)} kicker="Coup de cœur" />
            ))}
          </ul>
        </section>
      )}

      <section className="highlights-section" aria-labelledby="hl-spots">
        <div className="highlights-bar">
          <h2 id="hl-spots">Coups de projecteur</h2>
          <p>Une course par thème, choisie dans la base et renouvelée au fil des jours.</p>
        </div>
        <ul className="spot-grid">
          {spotList.map((s) => (
            <RaceCard key={s.id} event={s.event} course={s.course} spot={s} />
          ))}
        </ul>
      </section>

      {weekend && weekendTop.length > 0 && (
        <section className="highlights-section" aria-labelledby="hl-weekend">
          <div className="highlights-bar">
            <h2 id="hl-weekend">{weekend.isThisWeekend ? 'Ce week-end' : 'Le prochain week-end de course'}</h2>
            <p>
              {formatRange(weekend.saturday, weekend.sunday)} : {weekend.events.length} courses, voici les plus attendues.
            </p>
          </div>
          <ul className="spot-grid">
            {weekendTop.map((e) => (
              <RaceCard key={e.id} event={e} course={mainCourse(e, today)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** La course en tête de page, en grand. */
function LeadStory({ event, course, reason }: { event: RaceEvent; course: Course; reason: string }) {
  const [failed, setFailed] = useState(false);
  const photo = eventPhoto(event);
  const showPhoto = photo && !failed;
  return (
    <article className="lead-story">
      <Link to={`/course/${event.id}`} className="lead-story-link">
        <span className="lead-story-media">
          {showPhoto ? (
            <img src={photo.src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
          ) : (
            <span className="lead-story-blank" aria-hidden="true" />
          )}
        </span>
        <span className="lead-story-text">
          <span className="lead-story-kicker">{reason}</span>
          <span className="lead-story-name">{event.name}</span>
          <span className="lead-story-place">
            {event.city}, {event.department ?? event.region} · {formatRange(event.dateStart, event.dateEnd)}
          </span>
          {event.highlights && <span className="lead-story-desc">{event.highlights.slice(0, 220)}</span>}
          <span className="spot-figures">
            <span>{fmtKm(course.distanceKm)}</span>
            {course.elevationGain != null && <span>{fmtM(course.elevationGain)} D+</span>}
            {course.priceEur != null && <span>{fmtPrice(course.priceEur)}</span>}
            {event.courses.length > 1 && <span>{event.courses.length} parcours</span>}
          </span>
          <span className="lead-story-cta">Voir la course →</span>
        </span>
      </Link>
      {showPhoto && (
        <a className="spot-credit" href={photo.src} target="_blank" rel="noreferrer">
          Photo : {photo.credit}
        </a>
      )}
    </article>
  );
}

function RaceCard({ event, course, spot, kicker }: { event: RaceEvent; course: Course; spot?: Spotlight; kicker?: string }) {
  const [failed, setFailed] = useState(false);
  const photo = eventPhoto(event);
  const showPhoto = photo && !failed;
  const { d, m } = parseYMD(course.start.slice(0, 10));
  const label = spot?.title ?? kicker;
  return (
    <li>
      <Link to={`/course/${event.id}?parcours=${course.id}`} className={`spot-card ${showPhoto ? 'has-photo' : ''}`}>
        {showPhoto && <img src={photo.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
        <span className="spot-shade" aria-hidden="true" />
        <span className="spot-date" aria-hidden="true">
          <b>{d}</b>
          {MONTH_SHORT[m - 1]}
        </span>
        {label && <span className="spot-kicker">{label}</span>}
        <span className="spot-name">{event.name}</span>
        <span className="spot-place">
          {event.city}, {event.department ?? event.region}
        </span>
        <span className="spot-figures">
          <span>{fmtKm(course.distanceKm)}</span>
          {course.elevationGain != null && <span>{fmtM(course.elevationGain)} D+</span>}
          {course.priceEur != null && <span>{fmtPrice(course.priceEur)}</span>}
        </span>
        {spot && <span className="spot-reason">{spot.reason}</span>}
      </Link>
      {showPhoto && (
        <a className="spot-credit" href={photo.src} target="_blank" rel="noreferrer">
          Photo : {photo.credit}
        </a>
      )}
    </li>
  );
}
