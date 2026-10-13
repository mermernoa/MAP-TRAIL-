import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fmtKm, fmtM, fmtPrice } from '../components/bits';
import type { Course, RaceEvent } from '../data/types';
import { MONTH_SHORT, parseYMD } from '../lib/dates';
import {
  criteriaFromParams,
  criteriaToFilters,
  criteriaToParams,
  type Criteria,
  DISTANCE_OPTIONS,
  EXTRA_OPTIONS,
  type Extra,
  findRaces,
  hasCriteria,
  NO_CRITERIA,
  type Spotlight,
  spotlights,
  TERRAIN_OPTIONS,
  WHEN_OPTIONS,
} from '../lib/finder';
import { eventPhoto } from '../lib/photos';
import { useFilterStore } from '../store/filters';
import { useAllRaces } from '../store/races';
import { useToday } from '../store/useToday';

const PAGE = 12;

/**
 * « Trouve ta course » : une phrase à compléter (« Je cherche une course de 15 à
 * 30 km, en montagne, dans le mois… ») et les courses qui y répondent, en cartes.
 * Sans critère, une course mise en avant par thème.
 */
export function FinderPage() {
  const events = useAllRaces();
  const today = useToday();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const criteria = useMemo(() => criteriaFromParams(params), [params]);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    document.title = 'Trouve ta course – Take Ton Trail';
    return () => {
      document.title = 'Take Ton Trail';
    };
  }, []);

  const update = (patch: Partial<Criteria>) => {
    setParams(criteriaToParams({ ...criteria, ...patch }), { replace: true });
    setShown(PAGE);
  };
  const toggleExtra = (x: Extra) =>
    update({ extras: criteria.extras.includes(x) ? criteria.extras.filter((y) => y !== x) : [...criteria.extras, x] });

  const regions = useMemo(
    () => [...new Set(events.filter((e) => !e.custom && e.dateEnd >= today).map((e) => e.region))].sort((a, b) => a.localeCompare(b, 'fr')),
    [events, today],
  );
  const active = hasCriteria(criteria);
  const results = useMemo(() => (active ? findRaces(events, criteria, today) : []), [active, events, criteria, today]);
  const spots = useMemo(() => spotlights(events, today), [events, today]);

  const openMap = () => {
    const store = useFilterStore.getState();
    store.reset();
    store.setFilters(criteriaToFilters(criteria, today));
    navigate('/carte');
  };

  const phrase = <T extends string>(options: { id: T; phrase: string }[], id: T) => options.find((o) => o.id === id)?.phrase ?? '';
  const extrasLeft = EXTRA_OPTIONS.filter((o) => !criteria.extras.includes(o.id));

  return (
    <div className="finder-page">
      <section className="finder-head" aria-labelledby="finder-title">
        <p className="finder-kicker" id="finder-title">
          Trouve ta course
        </p>
        <p className="finder-sentence">
          Je cherche une course{' '}
          <Blank label="Distance" value={phrase(DISTANCE_OPTIONS, criteria.distance)} set={criteria.distance !== 'any'}>
            {(close) =>
              DISTANCE_OPTIONS.map((o) => (
                <Option key={o.id} on={criteria.distance === o.id} hint={o.hint} onPick={() => (update({ distance: o.id }), close())}>
                  {o.label}
                </Option>
              ))
            }
          </Blank>
          ,{' '}
          <Blank label="Terrain" value={phrase(TERRAIN_OPTIONS, criteria.terrain)} set={criteria.terrain !== 'any'}>
            {(close) =>
              TERRAIN_OPTIONS.map((o) => (
                <Option key={o.id} on={criteria.terrain === o.id} hint={o.hint} onPick={() => (update({ terrain: o.id }), close())}>
                  {o.label}
                </Option>
              ))
            }
          </Blank>
          ,{' '}
          <Blank label="Date" value={phrase(WHEN_OPTIONS, criteria.when)} set={criteria.when !== 'any'}>
            {(close) =>
              WHEN_OPTIONS.map((o) => (
                <Option key={o.id} on={criteria.when === o.id} onPick={() => (update({ when: o.id }), close())}>
                  {o.label}
                </Option>
              ))
            }
          </Blank>{' '}
          <Blank label="Région" value={criteria.region ? `en ${criteria.region}` : 'partout en France'} set={!!criteria.region} wide>
            {(close) => [
              <Option key="" on={!criteria.region} onPick={() => (update({ region: '' }), close())}>
                Partout
              </Option>,
              ...regions.map((r) => (
                <Option key={r} on={criteria.region === r} onPick={() => (update({ region: r }), close())}>
                  {r}
                </Option>
              )),
            ]}
          </Blank>
          {criteria.extras.map((x) => (
            <span key={x}>
              ,{' '}
              <button type="button" className="finder-blank is-set is-extra" onClick={() => toggleExtra(x)} aria-label={`Retirer : ${phrase(EXTRA_OPTIONS, x)}`}>
                {phrase(EXTRA_OPTIONS, x)}
                <span aria-hidden="true" className="finder-x">
                  ×
                </span>
              </button>
            </span>
          ))}
          .
        </p>
        <div className="finder-extras" role="group" aria-label="Ajouter une envie">
          <span>Ajouter une envie :</span>
          {extrasLeft.map((o) => (
            <button key={o.id} type="button" className="finder-add" onClick={() => toggleExtra(o.id)}>
              + {o.label}
            </button>
          ))}
        </div>
      </section>

      {active && (
        <section className="finder-section" aria-live="polite" aria-labelledby="finder-results-title">
          <div className="finder-bar">
            <h2 id="finder-results-title">
              {results.length === 0 ? 'Aucune course ne coche tout' : `${results.length} ${results.length > 1 ? 'courses pour toi' : 'course pour toi'}`}
            </h2>
            <div className="finder-bar-actions">
              {results.length > 0 && (
                <button type="button" className="button button-primary" onClick={openMap}>
                  Voir sur la carte
                </button>
              )}
              <button type="button" className="button" onClick={() => update(NO_CRITERIA)}>
                Tout effacer
              </button>
            </div>
          </div>
          {results.length === 0 ? (
            <p className="finder-empty">Enlève un critère ou élargis la période : le dénivelé et le prix ne sont pas connus pour toutes les courses.</p>
          ) : (
            <>
              <ul className="spot-grid">
                {results.slice(0, shown).map((r) => (
                  <RaceCard key={r.event.id} event={r.event} course={bestCourse(r.courses)} more={r.courses.length - 1} />
                ))}
              </ul>
              {results.length > shown && (
                <button type="button" className="button finder-more" onClick={() => setShown((n) => n + PAGE)}>
                  Voir {Math.min(PAGE, results.length - shown)} courses de plus
                </button>
              )}
            </>
          )}
        </section>
      )}

      <section className="finder-section" aria-labelledby="finder-spots-title">
        <div className="finder-bar">
          <h2 id="finder-spots-title">Coups de projecteur</h2>
          <p>Une course par thème, choisie dans la base et renouvelée au fil des jours.</p>
        </div>
        <ul className="spot-grid">
          {spots.map((s) => (
            <RaceCard key={s.id} event={s.event} course={s.course} spot={s} />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Le parcours le plus parlant d'un événement : le plus long qui répond aux critères. */
function bestCourse(courses: Course[]): Course {
  return [...courses].sort((a, b) => b.distanceKm - a.distanceKm)[0];
}

/** Un trou de la phrase : affiche le choix courant, ouvre la liste au clic. */
function Blank({
  label,
  value,
  set,
  wide,
  children,
}: {
  label: string;
  value: string;
  set: boolean;
  wide?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <span ref={ref} className="finder-slot">
      <button
        type="button"
        className={`finder-blank ${set ? 'is-set' : ''} ${open ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label} : ${value}`}
        onClick={() => setOpen((v) => !v)}
      >
        {value}
      </button>
      {open && (
        <span className={`finder-menu ${wide ? 'is-wide' : ''}`} role="listbox" aria-label={label}>
          {children(() => setOpen(false))}
        </span>
      )}
    </span>
  );
}

function Option({ on, hint, onPick, children }: { on: boolean; hint?: string; onPick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="option" aria-selected={on} className={`finder-option ${on ? 'is-on' : ''}`} onClick={onPick}>
      <span>{children}</span>
      {hint && <small>{hint}</small>}
    </button>
  );
}

function RaceCard({ event, course, spot, more = 0 }: { event: RaceEvent; course: Course; spot?: Spotlight; more?: number }) {
  const [failed, setFailed] = useState(false);
  const photo = eventPhoto(event);
  const showPhoto = photo && !failed;
  const { d, m } = parseYMD(course.start.slice(0, 10));
  return (
    <li>
      <Link to={`/course/${event.id}?parcours=${course.id}`} className={`spot-card ${showPhoto ? 'has-photo' : ''}`}>
        {showPhoto && <img src={photo.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
        <span className="spot-shade" aria-hidden="true" />
        <span className="spot-date" aria-hidden="true">
          <b>{d}</b>
          {MONTH_SHORT[m - 1]}
        </span>
        {spot && <span className="spot-kicker">{spot.title}</span>}
        <span className="spot-name">{event.name}</span>
        <span className="spot-place">
          {event.city}, {event.department ?? event.region}
        </span>
        <span className="spot-figures">
          <span>{fmtKm(course.distanceKm)}</span>
          {course.elevationGain != null && <span>{fmtM(course.elevationGain)} D+</span>}
          {course.priceEur != null && <span>{fmtPrice(course.priceEur)}</span>}
          {more > 0 && <span>+ {more} parcours</span>}
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
