import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtKm, fmtM, fmtPrice } from '../components/bits';
import { TerrainHero } from '../components/TerrainHero';
import type { Course, RaceEvent } from '../data/types';
import { formatRange, MONTH_SHORT, parseYMD } from '../lib/dates';
import { introDelay, prefersReducedMotion, useReveal, useTilt } from '../lib/motion';
import { cardPhoto } from '../lib/photos';
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
 * « À la une » : les courses mises en avant, sans filtre ni formulaire. En tête,
 * la course du moment sur le relief 3D réel de son lieu ; puis nos coups de cœur
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
  // En tête : le premier coup de cœur, sinon la prochaine mythique.
  const lead = featured[0] ?? spots.find((s) => s.id === 'mythique')?.event ?? spots[0]?.event;
  const leadReason = featured[0] ? 'Notre coup de cœur du moment' : 'La prochaine course de légende';
  const others = featured.filter((e) => e.id !== lead?.id);
  const spotList = spots.filter((s) => s.event.id !== lead?.id);

  return (
    <div className="highlights-page">
      {lead && <LeadHero event={lead} course={mainCourse(lead, today)} reason={leadReason} today={today} />}

      <div ref={bodyRef} className="highlights-body">
        {others.length > 0 && (
          <section className="highlights-section" aria-labelledby="hl-favs">
            <SectionBar id="hl-favs" title="Nos coups de cœur" text="Choisies à la main par l’équipe Take Ton Trail." />
            <ul className="spot-grid">
              {others.map((e) => (
                <RaceCard key={e.id} event={e} course={mainCourse(e, today)} kicker="Coup de cœur" />
              ))}
            </ul>
          </section>
        )}

        <section className="highlights-section" aria-labelledby="hl-spots">
          <SectionBar id="hl-spots" title="Coups de projecteur" text="Une course par thème, choisie dans la base et renouvelée au fil des jours." />
          <ul className="spot-grid">
            {spotList.map((s) => (
              <RaceCard key={s.id} event={s.event} course={s.course} spot={s} />
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
              {weekendTop.map((e) => (
                <RaceCard key={e.id} event={e} course={mainCourse(e, today)} />
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

/** Position du lieu dans l'en-tête : à droite du texte sur ordinateur, au-dessus sur mobile. */
const leadFocus = () => (window.matchMedia('(max-width: 760px)').matches ? { x: 0.5, y: 0.3 } : { x: 0.68, y: 0.5 });

/**
 * En tête : le relief réel du lieu de départ, en 3D sous imagerie satellite,
 * qui tourne lentement comme vu d'un drone. Une épingle rose marque le lieu ;
 * la photo de la course flotte à côté comme une carte postale et suit la souris.
 */
function LeadHero({ event, course, reason, today }: { event: RaceEvent; course: Course; reason: string; today: string }) {
  const heroRef = useRef<HTMLElement>(null);
  const [failed, setFailed] = useState(false);
  const photo = cardPhoto(event);
  const showPhoto = photo && !failed;
  const days = Math.max(0, Math.round((Date.parse(`${course.start.slice(0, 10)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5));
  const minPrice = Math.min(...event.courses.map((c) => c.priceEur ?? Infinity));

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    hero.style.setProperty('--intro', `${Math.round(introDelay())}ms`);
    if (prefersReducedMotion()) return;
    let raf = 0;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    const tick = () => {
      raf = 0;
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      hero.style.setProperty('--px', cur.x.toFixed(4));
      hero.style.setProperty('--py', cur.y.toFixed(4));
      if (Math.abs(target.x - cur.x) > 0.001 || Math.abs(target.y - cur.y) > 0.001) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      target.x = e.clientX / window.innerWidth - 0.5;
      target.y = e.clientY / window.innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      const h = hero.offsetHeight || 1;
      hero.style.setProperty('--scroll', Math.min(1, Math.max(0, window.scrollY / h)).toFixed(3));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <section ref={heroRef} className="hl-hero" aria-labelledby="hl-title">
      <div className="hl-ground" aria-hidden="true">
        {showPhoto ? <img className="hl-ground-photo" src={photo.src} alt="" referrerPolicy="no-referrer" /> : <span className="hl-ground-blank" />}
        <TerrainHero lat={event.lat} lng={event.lng} track={null} focus={leadFocus} />
      </div>
      <div className="hl-shade" aria-hidden="true" />
      <div className="hl-pin" aria-hidden="true">
        <span className="hl-pin-ring" />
        <span className="hl-pin-ring" />
        <span className="hl-pin-dot" />
        <span className="hl-pin-label">{event.city}</span>
      </div>
      {showPhoto && (
        <figure className="hl-postcard">
          <img src={photo.thumb ?? photo.src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
          <figcaption>
            <a href={photo.src} target="_blank" rel="noreferrer">
              Photo : {photo.credit}
            </a>
          </figcaption>
        </figure>
      )}
      <div className="hl-hero-inner">
        <p className="hl-eyebrow">
          <span>À la une</span> {reason}
        </p>
        <h1 id="hl-title" className="hl-name">
          {event.name}
        </h1>
        <p className="hl-place">
          {event.city}, {event.department ?? event.region} · {formatRange(event.dateStart, event.dateEnd)}
        </p>
        <p className="hl-countdown">
          <b>J-{days}</b> avant le départ
        </p>
        <ul className="hl-stats" aria-label="En chiffres">
          <li>
            <b>{fmtKm(course.distanceKm)}</b> le plus long
          </li>
          {course.elevationGain != null && (
            <li>
              <b>{fmtM(course.elevationGain)}</b> de D+
            </li>
          )}
          <li>
            <b>{event.courses.length}</b> parcours
          </li>
          {Number.isFinite(minPrice) && (
            <li>
              dès <b>{fmtPrice(minPrice)}</b>
            </li>
          )}
        </ul>
        <Link to={`/course/${event.id}`} className="button button-primary hl-cta">
          Voir la course
        </Link>
      </div>
    </section>
  );
}

function RaceCard({ event, course, spot, kicker }: { event: RaceEvent; course: Course; spot?: Spotlight; kicker?: string }) {
  const [failed, setFailed] = useState(false);
  const photo = cardPhoto(event);
  const showPhoto = photo && !failed;
  const { d, m } = parseYMD(course.start.slice(0, 10));
  const label = spot?.title ?? kicker;
  return (
    <li className="reveal-item">
      <Link to={`/course/${event.id}?parcours=${course.id}`} className={`spot-card ${showPhoto ? 'has-photo' : ''}`}>
        {showPhoto && <img src={photo.thumb ?? photo.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
        <span className="spot-shade" aria-hidden="true" />
        <span className="spot-glare" aria-hidden="true" />
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
