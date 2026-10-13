import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtKm, fmtM, fmtPrice } from '../components/bits';
import { TopoScene } from '../components/TopoScene';
import type { Course, RaceEvent } from '../data/types';
import { formatRange, MONTH_SHORT, parseYMD } from '../lib/dates';
import { introDelay, prefersReducedMotion, useReveal, useTilt } from '../lib/motion';
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

/** « 31 oct. », « 1er nov. » */
function shortDate(iso: string) {
  const { d, m } = parseYMD(iso);
  return `${d === 1 ? '1er' : d} ${MONTH_SHORT[m - 1]}`;
}

/**
 * « À la une » : les courses mises en avant, sans filtre ni formulaire. En tête,
 * la course du moment sur le relief 3D de l'accueil ; puis nos coups de cœur
 * (espace admin), une course par thème et le prochain week-end de course.
 */
export function HighlightsPage() {
  const events = useAllRaces();
  const today = useToday();
  const featuredIds = useSiteSettings((s) => s.featured);
  const bodyRef = useReveal<HTMLDivElement>('.reveal-item', [events.length, featuredIds.length]);
  useTilt('.spot-card', 6);

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
  // Bande défilante : les prochaines courses connues.
  const ticker = useMemo(
    () =>
      events
        .filter((e) => !e.custom && e.dateStart >= today && e.popularity >= 3)
        .sort((a, b) => a.dateStart.localeCompare(b.dateStart))
        .slice(0, 16),
    [events, today],
  );

  // En tête : le premier coup de cœur, sinon la prochaine mythique.
  const lead = featured[0] ?? spots.find((s) => s.id === 'mythique')?.event ?? spots[0]?.event;
  const leadReason = featured[0] ? 'Notre coup de cœur du moment' : 'La prochaine course de légende';
  const others = featured.filter((e) => e.id !== lead?.id);
  const spotList = spots.filter((s) => s.event.id !== lead?.id);

  return (
    <div className="highlights-page">
      {lead && <LeadHero event={lead} course={mainCourse(lead, today)} reason={leadReason} today={today} />}

      {ticker.length > 0 && <Ticker events={ticker} />}

      <div ref={bodyRef} className="highlights-body">
        {others.length > 0 && (
          <section className="highlights-section" aria-labelledby="hl-favs">
            <SectionBar id="hl-favs" title="Nos coups de cœur" text="Choisies à la main par l’équipe Take Ton Trail." />
            <ul className="spot-grid">
              {others.map((e, i) => (
                <RaceCard key={e.id} event={e} course={mainCourse(e, today)} kicker="Coup de cœur" index={i} />
              ))}
            </ul>
          </section>
        )}

        <section className="highlights-section" aria-labelledby="hl-spots">
          <SectionBar id="hl-spots" title="Coups de projecteur" text="Une course par thème, choisie dans la base et renouvelée au fil des jours." />
          <ul className="spot-grid">
            {spotList.map((s, i) => (
              <RaceCard key={s.id} event={s.event} course={s.course} spot={s} index={i} />
            ))}
          </ul>
        </section>

        {weekend && weekendTop.length > 0 && (
          <section className="highlights-section" aria-labelledby="hl-weekend">
            <SectionBar
              id="hl-weekend"
              title={weekend.isThisWeekend ? 'Ce week-end' : 'Le prochain week-end de course'}
              text={`${formatRange(weekend.saturday, weekend.sunday)} : ${weekend.events.length} courses, voici les plus attendues.`}
            />
            <ul className="spot-grid">
              {weekendTop.map((e, i) => (
                <RaceCard key={e.id} event={e} course={mainCourse(e, today)} index={i} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionBar({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <div className="highlights-bar reveal-item">
      <h2 id={id}>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

/** En tête : la course du moment, sur le relief 3D, sa photo dans un cadre qui suit la souris. */
function LeadHero({ event, course, reason, today }: { event: RaceEvent; course: Course; reason: string; today: string }) {
  const heroRef = useRef<HTMLElement>(null);
  const [failed, setFailed] = useState(false);
  const photo = eventPhoto(event);
  const showPhoto = photo && !failed;
  const days = Math.max(0, Math.round((Date.parse(`${course.start.slice(0, 10)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5));

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    hero.style.setProperty('--intro', `${Math.round(introDelay())}ms`);
    if (prefersReducedMotion()) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      hero.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    };
    hero.addEventListener('pointermove', onMove, { passive: true });
    return () => hero.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <section ref={heroRef} className="hl-hero" aria-labelledby="hl-title">
      <TopoScene host={heroRef} />
      <div className="hl-hero-scrim" aria-hidden="true" />
      <div className="hl-hero-inner">
        <div className="hl-hero-text">
          <p className="hl-eyebrow">
            <span>À la une</span> {reason}
          </p>
          <h1 id="hl-title" className="hl-name">
            {event.name}
          </h1>
          <p className="hl-place">
            {event.city}, {event.department ?? event.region} · {formatRange(event.dateStart, event.dateEnd)}
          </p>
          {event.highlights && <p className="hl-desc">{event.highlights.slice(0, 200)}</p>}
          <ul className="hl-stats" aria-label="En chiffres">
            <li>
              <b>{fmtKm(course.distanceKm)}</b>
              <span>le plus long</span>
            </li>
            {course.elevationGain != null && (
              <li>
                <b>{fmtM(course.elevationGain)}</b>
                <span>de D+</span>
              </li>
            )}
            <li>
              <b>J-{days}</b>
              <span>avant le départ</span>
            </li>
          </ul>
          <div className="hl-actions">
            <Link to={`/course/${event.id}`} className="button button-primary hl-cta">
              Voir la course
            </Link>
            {course.priceEur != null && <span className="hl-price">dès {fmtPrice(Math.min(...event.courses.map((c) => c.priceEur ?? Infinity)))}</span>}
          </div>
        </div>
        <Link to={`/course/${event.id}`} className="hl-frame" tabIndex={-1} aria-hidden="true">
          <span className="hl-frame-card">
            {showPhoto ? (
              <img src={photo.src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
            ) : (
              <span className="hl-frame-blank" />
            )}
            <span className="hl-frame-date">
              <b>{parseYMD(course.start.slice(0, 10)).d}</b>
              {MONTH_SHORT[parseYMD(course.start.slice(0, 10)).m - 1]}
            </span>
          </span>
          <span className="hl-frame-back" />
        </Link>
      </div>
      {showPhoto && (
        <a className="hl-credit" href={photo.src} target="_blank" rel="noreferrer">
          Photo : {photo.credit}
        </a>
      )}
    </section>
  );
}

/** Bande rose qui défile : les prochaines courses connues. */
function Ticker({ events }: { events: RaceEvent[] }) {
  // Deux copies côte à côte : la bande boucle sans couture.
  const run = (copy: boolean) =>
    events.map((e) => (
      <Link key={e.id} to={`/course/${e.id}`} className="hl-ticker-item" tabIndex={copy ? -1 : undefined}>
        <b>{shortDate(e.dateStart)}</b> {e.name}
      </Link>
    ));
  return (
    <nav className="hl-ticker" aria-label="Prochaines courses">
      <div className="hl-ticker-track">
        <div className="hl-ticker-run">{run(false)}</div>
        <div className="hl-ticker-run" aria-hidden="true">
          {run(true)}
        </div>
      </div>
    </nav>
  );
}

function RaceCard({ event, course, spot, kicker, index }: { event: RaceEvent; course: Course; spot?: Spotlight; kicker?: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const photo = eventPhoto(event);
  const showPhoto = photo && !failed;
  const { d, m } = parseYMD(course.start.slice(0, 10));
  const label = spot?.title ?? kicker;
  return (
    <li className="reveal-item">
      <Link to={`/course/${event.id}?parcours=${course.id}`} className={`spot-card ${showPhoto ? 'has-photo' : ''}`}>
        {showPhoto && <img src={photo.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
        <span className="spot-shade" aria-hidden="true" />
        <span className="spot-glare" aria-hidden="true" />
        <span className="spot-index" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
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
