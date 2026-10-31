import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fmtKm, fmtM } from '../components/bits';
import { CountUp } from '../components/CountUp';
import { RaceRow } from '../components/RaceRow';
import { RidgeProfile } from '../components/RidgeProfile';
import { TerrainHero } from '../components/TerrainHero';
import type { RaceEvent } from '../data/types';
import { formatDate, monthLabel, parseYMD } from '../lib/dates';
import { summarize } from '../lib/departements';
import { useReveal, useParallax } from '../lib/motion';
import { type LinkSection, type PageLink, type TrailItem, type TrailsPageData, trailsSite } from '../lib/trailPages';
import { useFilterStore } from '../store/filters';
import { useAllRaces } from '../store/races';
import { useToday } from '../store/useToday';

const PAGE = 40;
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** /trails/, /trails/haute-savoie, /trails/pres-de-lyon, /trails/ultra-trails-occitanie, /trails/novembre-2026… */
export function TrailsPage() {
  const { slug } = useParams();
  const events = useAllRaces();
  const today = useToday();
  const page = useMemo(() => trailsSite(events, today).page(slug), [events, today, slug]);
  if (!page) {
    return (
      <div className="page-message">
        <h1>Page introuvable</h1>
        <p>Cette adresse ne correspond à aucune page de trails.</p>
        <Link to="/trails/" className="button button-primary">
          Voir toutes les pages
        </Link>
      </div>
    );
  }
  return page.kind === 'index' ? <TrailsIndex page={page} /> : <TrailsView key={page.slug} page={page} />;
}

function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} – Take Ton Trail`;
    return () => {
      document.title = 'Take Ton Trail';
    };
  }, [title]);
}

const to = (path: string) => `/${path}`;

function Breadcrumb({ links }: { links: PageLink[] }) {
  return (
    <nav className="breadcrumb" aria-label="Fil d’Ariane">
      {links.map((l, i) => (
        <Fragment key={l.path}>
          {i > 0 && <span aria-hidden="true">/</span>}
          <Link to={to(l.path)}>{l.label}</Link>
        </Fragment>
      ))}
    </nav>
  );
}

function Sections({ sections }: { sections: LinkSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <nav key={s.title} className="massif-others" aria-label={s.title}>
          <h2>{s.title}</h2>
          <ul>
            {s.links.map((l) => (
              <li key={l.path}>
                <Link to={to(l.path)} className="chip-link">
                  {l.label}
                  {l.count != null && ` · ${l.count}`}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </>
  );
}

function Stats({ items, today }: { items: TrailItem[]; today: string }) {
  const chosen = new Map(items.map((i) => [i.event, i.courses]));
  const s = summarize(
    items.map((i) => i.event),
    today,
    (e) => chosen.get(e) ?? [],
  );
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
      {s.next && (
        <div>
          <dt>Prochaine course</dt>
          <dd>{formatDate(s.next.day, { year: false })}</dd>
        </div>
      )}
    </dl>
  );
}

/** Liste paginée, avec un intertitre par mois si demandé. */
function RaceList({ items, byMonth }: { items: TrailItem[]; byMonth: boolean }) {
  const [shown, setShown] = useState(PAGE);
  const visible = items.slice(0, shown);
  const groups: { label: string | null; items: TrailItem[] }[] = [];
  for (const i of visible) {
    const { y, m } = parseYMD(i.courses.map((c) => c.start.slice(0, 10)).sort()[0] ?? i.event.dateStart);
    const label = byMonth ? monthLabel(y, m) : null;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(i);
    else groups.push({ label, items: [i] });
  }
  return (
    <>
      {groups.map((g, gi) => (
        <div key={`${g.label}-${gi}`} className="collection-group">
          {g.label && <h3 className="collection-month">{g.label}</h3>}
          <ul className="race-list">
            {g.items.map((i) => (
              <RaceRow key={i.event.id} event={i.event} courses={i.courses} note={i.km != null ? `à ${nf.format(i.km)} km` : undefined} />
            ))}
          </ul>
        </div>
      ))}
      {shown < items.length && (
        <button type="button" className="button list-more" onClick={() => setShown((n) => n + PAGE)}>
          Afficher plus de courses
        </button>
      )}
    </>
  );
}

function TrailsView({ page }: { page: TrailsPageData }) {
  const today = useToday();
  const navigate = useNavigate();
  const heroRef = useParallax<HTMLElement>(0.35);
  const bodyRef = useReveal<HTMLDivElement>('.panel, .massif-intro', [page.slug]);
  useTitle(page.h1);
  const terrain = page.center != null;
  const openMap = () => {
    if (!page.map) return;
    const store = useFilterStore.getState();
    store.reset();
    store.setFilters(page.map.filters);
    navigate('/carte');
  };
  const events: RaceEvent[] = page.items.map((i) => i.event);

  return (
    <article className={`${terrain ? 'massif-page' : 'collection-page'} trails-page`}>
      <header ref={heroRef} className={`race-hero ${terrain ? 'massif-hero' : 'collection-hero'}`}>
        {page.center ? (
          <TerrainHero lat={page.center.lat} lng={page.center.lng} track={null} />
        ) : (
          <div className="collection-hero-night" aria-hidden="true">
            <RidgeProfile kind="hautes" seed={page.seed} className="collection-hero-ridge" />
          </div>
        )}
        <div className="race-hero-shade" aria-hidden="true" />
        <div className="race-hero-content">
          <Breadcrumb links={page.breadcrumb} />
          <h1 className="race-title">{page.h1}</h1>
          {page.subtitle && <p className="race-hero-place">{page.subtitle}</p>}
        </div>
        {terrain && <RidgeProfile kind="hautes" seed={page.seed} className="massif-hero-ridge" />}
      </header>

      <div ref={bodyRef} className={terrain ? 'massif-body' : 'collection-body'}>
        <section className="massif-intro trails-intro" aria-label="Présentation">
          <div className="massif-intro-text">
            <p className="massif-lede">{page.intro}</p>
            {events.length > 0 && <Stats items={page.items} today={today} />}
            {page.map && (
              <button type="button" className="button button-primary" onClick={openMap}>
                {page.map.label}
              </button>
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="trails-list-title">
          <div className="panel-head">
            <h2 id="trails-list-title">{page.listTitle}</h2>
          </div>
          {page.items.length ? (
            <RaceList items={page.items} byMonth={page.byMonth} />
          ) : (
            <p className="muted">
              Aucune course à venir pour l’instant. <Link to="/proposer-une-course">Propose une course</Link> si tu en connais une.
            </p>
          )}
        </section>

        <Sections sections={page.sections} />
      </div>
    </article>
  );
}

function TrailsIndex({ page }: { page: TrailsPageData }) {
  const bodyRef = useReveal<HTMLDivElement>('.massif-others', [page.sections.length]);
  useTitle(page.h1);
  return (
    <article className="collection-page trails-page">
      <header className="race-hero collection-hero">
        <div className="collection-hero-night" aria-hidden="true">
          <RidgeProfile kind="aiguilles" seed={page.seed} className="collection-hero-ridge" />
        </div>
        <div className="race-hero-shade" aria-hidden="true" />
        <div className="race-hero-content">
          <Breadcrumb links={page.breadcrumb} />
          <h1 className="race-title">{page.h1}</h1>
          <p className="collection-lede">{page.intro}</p>
        </div>
      </header>

      <div ref={bodyRef} className="collection-body">
        <Sections sections={page.sections} />
      </div>
    </article>
  );
}
