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
import { trailsTitle } from '../lib/seoTitles';
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

/** Même titre que la page pré-rendue (Google lit celui de la page affichée). */
function useTitle(title: string) {
  useEffect(() => {
    document.title = trailsTitle(title);
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
        <dt>Événements à venir</dt>
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
          <dt>Prochain départ</dt>
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
  useTitle(page.title);
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = page.photo && !photoFailed ? page.photo : null;
  const terrain = page.center != null || photo != null;
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
      <header ref={heroRef} className={`race-hero ${terrain ? 'massif-hero' : 'collection-hero'} ${photo ? 'has-photo' : ''}`}>
        {photo ? (
          <img className="race-hero-photo" src={photo} alt={page.h1} onError={() => setPhotoFailed(true)} />
        ) : page.center ? (
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

        {page.story && (
          <section className="trails-story" aria-labelledby="trails-story-title">
            <p className="trails-story-kicker">Le mot de Take Ton Trail</p>
            <h2 id="trails-story-title">{page.story.title}</h2>
            {page.story.paragraphs.map((t) => (
              <p key={t.slice(0, 24)}>{t}</p>
            ))}
          </section>
        )}

        <Sections sections={page.sections} />
      </div>
    </article>
  );
}

function TrailsIndex({ page }: { page: TrailsPageData }) {
  const events = useAllRaces();
  const today = useToday();
  const heroRef = useParallax<HTMLElement>(0.35);
  const bodyRef = useReveal<HTMLDivElement>('.trails-block', [page.sections.length]);
  const [photoFailed, setPhotoFailed] = useState(false);
  useTitle(page.title);
  const totals = useMemo(() => {
    const upcoming = events.filter((e) => !e.custom && e.dateEnd >= today);
    return { events: upcoming.length, courses: upcoming.reduce((n, e) => n + e.courses.filter((c) => c.start.slice(0, 10) >= today).length, 0) };
  }, [events, today]);
  const regions = page.sections.find((s) => s.look === 'regions')?.links.length ?? 0;
  const photo = page.photo && !photoFailed ? page.photo : null;

  return (
    <article className="collection-page trails-page trails-index">
      <header ref={heroRef} className={`race-hero trails-index-hero ${photo ? 'has-photo' : 'collection-hero'}`}>
        {photo ? (
          <img className="race-hero-photo" src={photo} alt={page.h1} onError={() => setPhotoFailed(true)} />
        ) : (
          <div className="collection-hero-night" aria-hidden="true">
            <RidgeProfile kind="aiguilles" seed={page.seed} className="collection-hero-ridge" />
          </div>
        )}
        <div className="race-hero-shade" aria-hidden="true" />
        <div className="race-hero-content">
          <Breadcrumb links={page.breadcrumb} />
          <h1 className="race-title">{page.h1}</h1>
          <p className="collection-lede">{page.intro}</p>
          <ul className="trails-facts" aria-label="La base en chiffres">
            <li>
              <b>{nf.format(totals.events)}</b> événements
            </li>
            <li>
              <b>{nf.format(totals.courses)}</b> courses
            </li>
            {regions > 0 && (
              <li>
                <b>{regions}</b> régions
              </li>
            )}
          </ul>
        </div>
        <RidgeProfile kind="hautes" seed={page.seed} className="massif-hero-ridge" />
      </header>

      <div ref={bodyRef} className="collection-body trails-index-body">
        {page.sections.map((s) =>
          s.look === 'regions' ? (
            <RegionCards key={s.title} section={s} />
          ) : s.look === 'cities' ? (
            <CityCards key={s.title} section={s} />
          ) : s.look === 'formats' ? (
            <FormatTiles key={s.title} section={s} />
          ) : s.look === 'months' ? (
            <MonthTiles key={s.title} section={s} />
          ) : s.look === 'departements' ? (
            <DepartementSigns key={s.title} section={s} pink={page.sections.filter((o) => o.look === 'departements').indexOf(s) % 2 === 1} />
          ) : (
            <nav key={s.title} className="massif-others trails-block" aria-label={s.title}>
              <h2 className="trails-block-title">{s.title}</h2>
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
          ),
        )}
      </div>
    </article>
  );
}

const eventsLabel = (n: number) => `${nf.format(n)} ${n > 1 ? 'événements' : 'événement'}`;

/** Régions en vignettes photo, dans le style des affiches de collections. */
function RegionCards({ section }: { section: LinkSection }) {
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  return (
    <nav className="trails-block" aria-label={section.title}>
      <h2 className="trails-block-title">{section.title}</h2>
      <ul className="trails-region-grid">
        {section.links.map((l, i) => {
          const photo = l.photo && !broken.has(l.photo) ? l.photo : null;
          return (
            <li key={l.path} style={{ '--tilt': `${[-1.2, 0.9, -0.5, 1.3, -0.9][i % 5]}deg` } as React.CSSProperties}>
              <Link to={to(l.path)} className={`poster trails-region ${photo ? 'has-photo' : ''}`}>
                {photo ? (
                  <img className="poster-photo" src={photo} alt="" loading="lazy" onError={() => setBroken((b) => new Set(b).add(photo))} />
                ) : (
                  <RidgeProfile kind={(['hautes', 'puys', 'ballons', 'aiguilles', 'plis'] as const)[i % 5]} seed={i + 5} className="poster-ridge" />
                )}
                <span className="poster-shade" aria-hidden="true" />
                {l.count != null && <span className="poster-count">{eventsLabel(l.count)}</span>}
                <span className="poster-title">{l.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Grandes villes : vignettes photo (comme une carte postale épinglée) pour celles qui ont
 * une photo, pastilles pour les autres.
 */
function CityCards({ section }: { section: LinkSection }) {
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const withPhoto = section.links.filter((l) => l.photo && !broken.has(l.photo));
  const others = section.links.filter((l) => !l.photo || broken.has(l.photo));
  return (
    <nav className="trails-block" aria-label={section.title}>
      <h2 className="trails-block-title">{section.title}</h2>
      {withPhoto.length > 0 && (
        <ul className="trails-city-grid">
          {withPhoto.map((l, i) => {
            const name = l.label.replace(/^Près (de |d’|du )/, '');
            const prefix = l.label.slice(0, l.label.length - name.length);
            return (
              <li key={l.path} style={{ '--tilt': `${[1.1, -0.8, 0.6, -1.3, 0.9, -0.5][i % 6]}deg` } as React.CSSProperties}>
                <Link to={to(l.path)} className="trails-city">
                  <span className="trails-city-frame">
                    <img src={l.photo!} alt="" loading="lazy" onError={() => setBroken((b) => new Set(b).add(l.photo!))} />
                    {l.count != null && <span className="poster-count trails-city-count">{eventsLabel(l.count)}</span>}
                  </span>
                  <span className="trails-city-name">
                    <small>{prefix.trim()}</small> {name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {others.length > 0 && (
        <div className="massif-others trails-city-others">
          {withPhoto.length > 0 && <h3 className="trails-city-others-title">Et aussi</h3>}
          <ul>
            {others.map((l) => (
              <li key={l.path}>
                <Link to={to(l.path)} className="chip-link">
                  {l.label}
                  {l.count != null && ` · ${l.count}`}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}

/** Formats en cartes photo ; sans photo, la carte garde son aplat rose ou bleu nuit. */
function FormatTiles({ section }: { section: LinkSection }) {
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  return (
    <nav className="trails-block" aria-label={section.title}>
      <h2 className="trails-block-title">{section.title}</h2>
      <ul className="trails-format-grid">
        {section.links.map((l) => {
          const photo = l.photo && !broken.has(l.photo) ? l.photo : null;
          return (
            <li key={l.path}>
              <Link to={to(l.path)} className={photo ? 'trails-format has-photo' : 'trails-format'}>
                {photo && <img src={photo} alt="" loading="lazy" onError={() => setBroken((b) => new Set(b).add(photo))} />}
                {l.count != null && <span className="trails-format-count">{eventsLabel(l.count)}</span>}
                <span className="trails-format-text">
                  <span className="trails-format-label">{l.label}</span>
                  {l.hint && <span className="trails-format-hint">{l.hint}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Départements en panneaux de randonnée : photo, puis flèche avec le numéro et le nom.
 * Une région sur deux a ses panneaux en rose. */
function DepartementSigns({ section, pink }: { section: LinkSection; pink: boolean }) {
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  return (
    <nav className="trails-block" aria-label={section.title}>
      <h2 className="trails-block-title">{section.title}</h2>
      <ul className={pink ? 'trails-dep-grid is-pink' : 'trails-dep-grid'}>
        {section.links.map((l) => {
          const photo = l.photo && !broken.has(l.photo) ? l.photo : null;
          return (
            <li key={l.path}>
              <Link to={to(l.path)} className="trails-dep">
                <span className={photo ? 'trails-dep-photo' : 'trails-dep-photo is-empty'}>
                  {photo ? (
                    <img src={photo} alt="" loading="lazy" onError={() => setBroken((b) => new Set(b).add(photo))} />
                  ) : (
                    <span aria-hidden="true">{l.code}</span>
                  )}
                </span>
                <span className="trails-dep-sign">
                  {l.code && <span className="trails-dep-code">{l.code}</span>}
                  <span className="trails-dep-text">
                    <span className="trails-dep-name">{l.label}</span>
                    {l.count != null && <span className="trails-dep-count">{eventsLabel(l.count)}</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Ce que chaque mois réserve aux traileurs, au-dessus du nom du mois (« La chaleur de juillet »). */
const MONTH_LINES: Record<string, string> = {
  janvier: 'Les trails blancs de',
  fevrier: 'La neige de',
  mars: 'La boue de',
  avril: 'Les premiers dossards d’',
  mai: 'Les crêtes fleuries de',
  juin: 'Les longues journées de',
  juillet: 'La chaleur de',
  aout: 'Les grands ultras d’',
  septembre: 'Les derniers cols de',
  octobre: 'Les feuilles mortes d’',
  novembre: 'Le brouillard de',
  decembre: 'Les nocturnes de',
};
const monthLine = (path: string) => MONTH_LINES[path.replace(/^trails\//, '').replace(/-\d{4}$/, '')] ?? '';

/** Mois en cartes postales : photo de saison, timbre du nombre d'événements, cachet de l'année. */
function MonthTiles({ section }: { section: LinkSection }) {
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  return (
    <nav className="trails-block" aria-label={section.title}>
      <h2 className="trails-block-title">{section.title}</h2>
      <ul className="trails-month-grid">
        {section.links.map((l, i) => {
          const [name, year] = l.label.split(' ');
          const photo = l.photo && !broken.has(l.photo) ? l.photo : null;
          return (
            <li key={l.path} style={{ '--tilt': `${[-1, 0.8, -0.5, 1.2, -0.9, 0.5][i % 6]}deg` } as React.CSSProperties}>
              <Link to={to(l.path)} className="trails-month">
                {photo && <img src={photo} alt="" loading="lazy" onError={() => setBroken((b) => new Set(b).add(photo))} />}
                {l.count != null && (
                  <span className="trails-month-stamp">
                    <span>
                      <b>{nf.format(l.count)}</b>
                      <small>{l.count > 1 ? 'événements' : 'événement'}</small>
                    </span>
                  </span>
                )}
                <span className="trails-month-postmark" aria-hidden="true">
                  <span>Take Ton Trail</span>
                  <b>{year}</b>
                </span>
                <span className="trails-month-text">
                  <small>{monthLine(l.path)}</small>
                  <span className="trails-month-name">{name}</span>
                  <span className="trails-month-year">{year}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
