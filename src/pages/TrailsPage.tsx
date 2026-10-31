import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fmtKm, fmtM } from '../components/bits';
import { CountUp } from '../components/CountUp';
import { RaceRow } from '../components/RaceRow';
import { RidgeProfile } from '../components/RidgeProfile';
import { TerrainHero } from '../components/TerrainHero';
import type { RaceEvent } from '../data/types';
import { formatDate, monthLabel, parseYMD } from '../lib/dates';
import {
  type Departement,
  type MonthPage,
  departementBySlug,
  departementEvents,
  departementOf,
  departementsWithRaces,
  introText,
  monthBySlug,
  monthEvents,
  monthPage,
  monthsWithRaces,
  summarize,
} from '../lib/departements';
import { massifByName } from '../lib/massifs';
import { useReveal, useParallax } from '../lib/motion';
import { useFilterStore } from '../store/filters';
import { useAllRaces } from '../store/races';
import { useToday } from '../store/useToday';

const PAGE = 40;

/** /trails, /trails/haute-savoie, /trails/novembre-2026 */
export function TrailsPage() {
  const { slug } = useParams();
  if (!slug) return <TrailsIndex />;
  const dep = departementBySlug(slug);
  if (dep) return <DepartementView key={slug} dep={dep} />;
  const month = monthBySlug(slug);
  if (month) return <MonthView key={slug} month={month} />;
  return (
    <div className="page-message">
      <h1>Page introuvable</h1>
      <p>Cette adresse ne correspond à aucun département ni à aucun mois.</p>
      <Link to="/trails/" className="button button-primary">
        Voir tous les départements
      </Link>
    </div>
  );
}

function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} – Take Ton Trail`;
    return () => {
      document.title = 'Take Ton Trail';
    };
  }, [title]);
}

function Stats({ list, today }: { list: RaceEvent[]; today: string }) {
  const s = summarize(list, today);
  return (
    <dl className="massif-stats">
      <div>
        <dt>Courses à venir</dt>
        <dd>
          <CountUp value={s.count} format={(n) => String(Math.round(n))} />
        </dd>
      </div>
      {s.longestKm > 0 && (
        <div>
          <dt>Plus long parcours</dt>
          <dd>{fmtKm(s.longestKm)}</dd>
        </div>
      )}
      {s.maxGain > 0 && (
        <div>
          <dt>Plus gros dénivelé</dt>
          <dd>{fmtM(s.maxGain)}</dd>
        </div>
      )}
      {list[0] && (
        <div>
          <dt>Prochaine course</dt>
          <dd>{formatDate(list[0].dateStart, { year: false })}</dd>
        </div>
      )}
    </dl>
  );
}

/** Liste paginée, avec un intertitre par mois si demandé. */
function RaceList({ list, today, byMonth }: { list: RaceEvent[]; today: string; byMonth: boolean }) {
  const [shown, setShown] = useState(PAGE);
  const visible = list.slice(0, shown);
  const groups: { label: string | null; items: RaceEvent[] }[] = [];
  for (const e of visible) {
    const { y, m } = parseYMD(e.dateStart);
    const label = byMonth ? monthLabel(y, m) : null;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return (
    <>
      {groups.map((g, i) => (
        <div key={`${g.label}-${i}`} className="collection-group">
          {g.label && <h3 className="collection-month">{g.label}</h3>}
          <ul className="race-list">
            {g.items.map((e) => (
              <RaceRow key={e.id} event={e} courses={e.courses.filter((c) => c.start.slice(0, 10) >= today)} />
            ))}
          </ul>
        </div>
      ))}
      {shown < list.length && (
        <button type="button" className="button list-more" onClick={() => setShown((n) => n + PAGE)}>
          Afficher plus de courses
        </button>
      )}
    </>
  );
}

function DepartementView({ dep }: { dep: Departement }) {
  const events = useAllRaces();
  const today = useToday();
  const list = useMemo(() => departementEvents(dep, events, today), [dep, events, today]);
  const others = useMemo(
    () => departementsWithRaces(events, today).filter((d) => d.dep.region === dep.region && d.dep !== dep),
    [events, today, dep],
  );
  const massifs = useMemo(() => [...new Set(list.map((e) => e.massif).filter(Boolean))].map((n) => massifByName(n)).filter((m) => !!m), [list]);
  const months = useMemo(() => [...new Set(list.map((e) => e.dateStart.slice(0, 7)))].sort(), [list]);
  const center = useMemo(() => {
    if (!list.length) return null;
    return { lat: list.reduce((s, e) => s + e.lat, 0) / list.length, lng: list.reduce((s, e) => s + e.lng, 0) / list.length };
  }, [list]);
  const heroRef = useParallax<HTMLElement>(0.35);
  const bodyRef = useReveal<HTMLDivElement>('.panel, .massif-intro', [dep.slug]);
  useTitle(`Trails ${dep.inName}`);
  const s = summarize(list, today);

  return (
    <article className="massif-page trails-page">
      <header ref={heroRef} className={`race-hero ${center ? 'massif-hero' : 'collection-hero'}`}>
        {center ? (
          <TerrainHero lat={center.lat} lng={center.lng} track={null} />
        ) : (
          <div className="collection-hero-night" aria-hidden="true" />
        )}
        <div className="race-hero-shade" aria-hidden="true" />
        <div className="race-hero-content">
          <nav className="breadcrumb" aria-label="Fil d’Ariane">
            <Link to="/">Accueil</Link>
            <span aria-hidden="true">/</span>
            <Link to="/trails/">Trails par département</Link>
          </nav>
          <h1 className="race-title">Trails {dep.inName}</h1>
          <p className="race-hero-place">
            {dep.name} ({dep.code}) · {dep.region}
          </p>
        </div>
        <RidgeProfile kind="hautes" seed={dep.code.charCodeAt(0) + dep.code.length * 7} className="massif-hero-ridge" />
      </header>

      <div ref={bodyRef} className="massif-body">
        <section className="massif-intro trails-intro" aria-label="Présentation">
          <div className="massif-intro-text">
            <p className="massif-lede">
              {introText(dep.inName, s, list.length ? 'Dates, distances, dénivelé, prix et ouverture des inscriptions : tout est sur chaque fiche.' : '')}
            </p>
            {list.length > 0 && <Stats list={list} today={today} />}
          </div>
        </section>

        <section className="panel" aria-labelledby="dep-races-title">
          <div className="panel-head">
            <h2 id="dep-races-title">Le calendrier des trails {dep.inName}</h2>
          </div>
          {list.length ? (
            <RaceList list={list} today={today} byMonth />
          ) : (
            <p className="muted">
              Aucune course à venir {dep.inName} pour l’instant. <Link to="/proposer-une-course">Propose une course</Link> si tu en connais une.
            </p>
          )}
        </section>

        {massifs.length > 0 && (
          <nav className="massif-others" aria-label="Massifs du département">
            <h2>Les massifs</h2>
            <ul>
              {massifs.map((m) => (
                <li key={m.slug}>
                  <Link to={`/massif/${m.slug}`} className="chip-link">
                    {m.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {months.length > 1 && (
          <nav className="massif-others" aria-label="Par mois">
            <h2>Par mois</h2>
            <ul>
              {months.map((k) => {
                const mp = monthPage(k);
                return (
                  <li key={k}>
                    <Link to={`/trails/${mp.slug}`} className="chip-link">
                      {mp.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <nav className="massif-others" aria-label="Départements voisins">
          <h2>Ailleurs en {dep.region}</h2>
          <ul>
            {others.map(({ dep: d, count }) => (
              <li key={d.slug}>
                <Link to={`/trails/${d.slug}`} className="chip-link">
                  {d.name} · {count}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/trails/" className="chip-link">
                Tous les départements
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </article>
  );
}

function MonthView({ month }: { month: MonthPage }) {
  const events = useAllRaces();
  const today = useToday();
  const navigate = useNavigate();
  const list = useMemo(() => monthEvents(month, events, today), [month, events, today]);
  const all = useMemo(() => monthsWithRaces(events, today), [events, today]);
  const busiest = useMemo(() => {
    const counts = new Map<Departement, number>();
    for (const e of list) {
      const d = departementOf(e);
      if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [list]);
  const heroRef = useParallax<HTMLElement>(0.35);
  const bodyRef = useReveal<HTMLDivElement>('.panel, .massif-intro', [month.slug]);
  useTitle(`Trails en ${month.label}`);
  const s = summarize(list, today);
  const openMap = () => {
    const store = useFilterStore.getState();
    store.reset();
    const last = new Date(month.y, month.m, 0).getDate();
    store.setFilters({ dateFrom: `${month.key}-01`, dateTo: `${month.key}-${String(last).padStart(2, '0')}` });
    navigate('/carte');
  };

  return (
    <article className="collection-page trails-page">
      <header ref={heroRef} className="race-hero collection-hero">
        <div className="collection-hero-night" aria-hidden="true">
          <RidgeProfile kind="hautes" seed={month.m * 3 + month.y} className="collection-hero-ridge" />
        </div>
        <div className="race-hero-shade" aria-hidden="true" />
        <div className="race-hero-content">
          <nav className="breadcrumb" aria-label="Fil d’Ariane">
            <Link to="/">Accueil</Link>
            <span aria-hidden="true">/</span>
            <Link to="/trails/">Trails par mois</Link>
          </nav>
          <h1 className="race-title">Trails en {month.label}</h1>
          <p className="race-hero-place">
            {list.length} {list.length > 1 ? 'courses' : 'course'} en France et outre-mer
          </p>
        </div>
      </header>

      <div ref={bodyRef} className="collection-body">
        <section className="massif-intro trails-intro" aria-label="Présentation">
          <div className="massif-intro-text">
            <p className="massif-lede">{introText(`en ${month.label}`, s)}</p>
            {list.length > 0 && <Stats list={list} today={today} />}
            {list.length > 0 && (
              <button type="button" className="button button-primary" onClick={openMap}>
                Voir les courses de {month.label} sur la carte
              </button>
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="month-races-title">
          <div className="panel-head">
            <h2 id="month-races-title">Toutes les courses de {month.label}</h2>
          </div>
          {list.length ? <RaceList list={list} today={today} byMonth={false} /> : <p className="muted">Aucune course à venir ce mois-ci pour l’instant.</p>}
        </section>

        {busiest.length > 0 && (
          <nav className="massif-others" aria-label="Départements du mois">
            <h2>Où courir en {month.label}</h2>
            <ul>
              {busiest.map(([d, count]) => (
                <li key={d.slug}>
                  <Link to={`/trails/${d.slug}`} className="chip-link">
                    {d.name} · {count}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <nav className="massif-others" aria-label="Autres mois">
          <h2>Les autres mois</h2>
          <ul>
            {all
              .filter((x) => x.month.key !== month.key)
              .map(({ month: m, count }) => (
                <li key={m.key}>
                  <Link to={`/trails/${m.slug}`} className="chip-link">
                    {m.label} · {count}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </div>
    </article>
  );
}

function TrailsIndex() {
  const events = useAllRaces();
  const today = useToday();
  const deps = useMemo(() => departementsWithRaces(events, today), [events, today]);
  const months = useMemo(() => monthsWithRaces(events, today), [events, today]);
  const regions = useMemo(() => {
    const map = new Map<string, { dep: Departement; count: number }[]>();
    for (const d of deps) map.set(d.dep.region, [...(map.get(d.dep.region) ?? []), d]);
    return [...map].sort((a, b) => (a[0] === 'Outre-mer' ? 1 : b[0] === 'Outre-mer' ? -1 : a[0].localeCompare(b[0], 'fr')));
  }, [deps]);
  const bodyRef = useReveal<HTMLDivElement>('.massif-others', [deps.length]);
  useTitle('Trails par département et par mois');

  return (
    <article className="collection-page trails-page">
      <header className="race-hero collection-hero">
        <div className="collection-hero-night" aria-hidden="true">
          <RidgeProfile kind="aiguilles" seed={11} className="collection-hero-ridge" />
        </div>
        <div className="race-hero-shade" aria-hidden="true" />
        <div className="race-hero-content">
          <nav className="breadcrumb" aria-label="Fil d’Ariane">
            <Link to="/">Accueil</Link>
          </nav>
          <h1 className="race-title">Trails par département et par mois</h1>
          <p className="collection-lede">
            Les courses de trail à venir près de chez toi, département par département, et mois par mois pour construire ta saison.
          </p>
        </div>
      </header>

      <div ref={bodyRef} className="collection-body">
        <nav className="massif-others" aria-label="Par mois">
          <h2>Par mois</h2>
          <ul>
            {months.map(({ month: m, count }) => (
              <li key={m.key}>
                <Link to={`/trails/${m.slug}`} className="chip-link">
                  {m.label} · {count}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {regions.map(([region, list]) => (
          <nav key={region} className="massif-others" aria-label={region}>
            <h2>{region}</h2>
            <ul>
              {list.map(({ dep, count }) => (
                <li key={dep.slug}>
                  <Link to={`/trails/${dep.slug}`} className="chip-link">
                    {dep.name} · {count}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </article>
  );
}
