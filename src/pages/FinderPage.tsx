import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fmtKm, fmtM, fmtPrice } from '../components/bits';
import { RaceRow } from '../components/RaceRow';
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
 * « Trouve ta course » : quelques questions, et les courses qui y répondent,
 * classées. Sans critère, une course mise en avant par thème.
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

  return (
    <div className="finder-page">
      <section className="finder-hero" aria-labelledby="finder-title">
        <div className="finder-hero-inner">
          <h1 id="finder-title">Trouve ta course</h1>
          <p className="finder-lede">Dis-nous ce dont tu as envie : on te sort les courses qui collent, les plus belles en premier.</p>

          <div className="finder-steps">
            <Question n={1} title="Quand ?">
              {WHEN_OPTIONS.map((o) => (
                <Choice key={o.id} on={criteria.when === o.id} onClick={() => update({ when: o.id })}>
                  {o.label}
                </Choice>
              ))}
            </Question>
            <Question n={2} title="Combien de kilomètres ?">
              {DISTANCE_OPTIONS.map((o) => (
                <Choice key={o.id} on={criteria.distance === o.id} onClick={() => update({ distance: o.id })} hint={o.hint}>
                  {o.label}
                </Choice>
              ))}
            </Question>
            <Question n={3} title="Quel terrain ?">
              {TERRAIN_OPTIONS.map((o) => (
                <Choice key={o.id} on={criteria.terrain === o.id} onClick={() => update({ terrain: o.id })} hint={o.hint}>
                  {o.label}
                </Choice>
              ))}
            </Question>
            <Question n={4} title="Une envie en plus ?" multi>
              {EXTRA_OPTIONS.map((o) => (
                <Choice key={o.id} on={criteria.extras.includes(o.id)} onClick={() => toggleExtra(o.id)} multi>
                  {o.label}
                </Choice>
              ))}
            </Question>
            <Question n={5} title="Où ?">
              <label className="finder-select">
                <span className="sr-only">Région</span>
                <select value={criteria.region} onChange={(e) => update({ region: e.target.value })}>
                  <option value="">Partout</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </Question>
          </div>
        </div>
      </section>

      <div className="finder-body">
        {active ? (
          <section className="finder-results" aria-live="polite" aria-labelledby="finder-results-title">
            <div className="finder-results-head">
              <h2 id="finder-results-title">
                {results.length === 0
                  ? 'Aucune course ne coche tout'
                  : `${results.length} ${results.length > 1 ? 'courses pour toi' : 'course pour toi'}`}
              </h2>
              <div className="finder-results-actions">
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
              <p className="finder-empty">
                Enlève un critère ou élargis la période : le dénivelé et le prix ne sont pas connus pour toutes les courses.
              </p>
            ) : (
              <>
                <ul className="race-list">
                  {results.slice(0, shown).map((r) => (
                    <RaceRow key={r.event.id} event={r.event} courses={r.courses} showPrice={criteria.extras.includes('cheap')} />
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
        ) : (
          <p className="finder-hint">Choisis au moins un critère au-dessus, ou pioche dans nos coups de projecteur.</p>
        )}

        <section className="finder-spots" aria-labelledby="finder-spots-title">
          <div className="home-section-head">
            <h2 id="finder-spots-title">Coups de projecteur</h2>
            <p>Une course mise en avant par thème, choisie automatiquement dans la base et renouvelée au fil des jours.</p>
          </div>
          <ul className="spot-grid">
            {spots.map((s) => (
              <SpotCard key={s.id} spot={s} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Question({ n, title, multi, children }: { n: number; title: string; multi?: boolean; children: React.ReactNode }) {
  return (
    <fieldset className="finder-question">
      <legend>
        <span className="finder-step" aria-hidden="true">
          {n}
        </span>
        {title}
        {multi && <small>plusieurs choix possibles</small>}
      </legend>
      <div className="finder-choices">{children}</div>
    </fieldset>
  );
}

function Choice({ on, onClick, hint, multi, children }: { on: boolean; onClick: () => void; hint?: string; multi?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className={`finder-choice ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={onClick} data-multi={multi ? '' : undefined}>
      <span>{children}</span>
      {hint && <small>{hint}</small>}
    </button>
  );
}

function SpotCard({ spot }: { spot: import('../lib/finder').Spotlight }) {
  const { event, course } = spot;
  const [failed, setFailed] = useState(false);
  const photo = eventPhoto(event);
  const { d, m } = parseYMD(course.start.slice(0, 10));
  return (
    <li>
      <Link to={`/course/${event.id}?parcours=${course.id}`} className={`spot-card ${photo && !failed ? 'has-photo' : ''}`}>
        {photo && !failed && <img src={photo.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
        <span className="spot-shade" aria-hidden="true" />
        <span className="spot-date" aria-hidden="true">
          <b>{d}</b>
          {MONTH_SHORT[m - 1]}
        </span>
        <span className="spot-kicker">{spot.title}</span>
        <span className="spot-name">{event.name}</span>
        <span className="spot-place">
          {event.city}, {event.department ?? event.region}
        </span>
        <span className="spot-figures">
          <span>{fmtKm(course.distanceKm)}</span>
          {course.elevationGain != null && <span>{fmtM(course.elevationGain)} D+</span>}
          {course.priceEur != null && <span>{fmtPrice(course.priceEur)}</span>}
        </span>
        <span className="spot-reason">{spot.reason}</span>
      </Link>
      {photo && !failed && (
        <a className="spot-credit" href={photo.src} target="_blank" rel="noreferrer">
          Photo : {photo.credit}
        </a>
      )}
    </li>
  );
}
