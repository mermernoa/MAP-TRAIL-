import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fmtKm, fmtM } from '../components/bits';
import { CountUp } from '../components/CountUp';
import { PhotoCredit } from '../components/PhotoCredit';
import { RaceRow } from '../components/RaceRow';
import { RidgeProfile } from '../components/RidgeProfile';
import { TerrainHero } from '../components/TerrainHero';
import { formatDate } from '../lib/dates';
import { MASSIFS, massifBySlug, massifEvents } from '../lib/massifs';
import { useParallax, useReveal } from '../lib/motion';
import { coverPhoto } from '../lib/photos';
import { useFilterStore } from '../store/filters';
import { useAllRaces } from '../store/races';
import { useToday } from '../store/useToday';

const PAGE = 30;

export function MassifPage() {
  const { slug } = useParams();
  const massif = massifBySlug(slug);
  const events = useAllRaces();
  const today = useToday();
  const navigate = useNavigate();
  const [shown, setShown] = useState(PAGE);
  const [photoFailed, setPhotoFailed] = useState(false);
  const list = useMemo(() => (massif ? massifEvents(massif, events, today) : []), [massif, events, today]);
  const photo = useMemo(() => coverPhoto(list), [list]);
  const heroRef = useParallax<HTMLElement>(0.35);
  const bodyRef = useReveal<HTMLDivElement>('.panel, .massif-intro', [slug]);

  useEffect(() => {
    if (!massif) return;
    document.title = `Trails ${massif.title} – Take Ton Trail`;
    setShown(PAGE);
    setPhotoFailed(false);
    return () => {
      document.title = 'Take Ton Trail';
    };
  }, [massif]);

  if (!massif) {
    return (
      <div className="page-message">
        <h1>Massif introuvable</h1>
        <p>Cette adresse ne correspond à aucun massif.</p>
        <Link to="/explorer" className="button button-primary">
          Voir tous les massifs
        </Link>
      </div>
    );
  }

  const courses = list.flatMap((e) => e.courses.filter((c) => c.start.slice(0, 10) >= today));
  const longest = courses.reduce((m, c) => Math.max(m, c.distanceKm), 0);
  const maxGain = courses.reduce((m, c) => Math.max(m, c.elevationGain ?? 0), 0);
  const index = MASSIFS.indexOf(massif);
  const openMap = () => {
    const store = useFilterStore.getState();
    store.reset();
    store.setFilters({ massifs: [massif.name] });
    navigate('/carte');
  };

  return (
    <article className="massif-page">
      <header ref={heroRef} className="race-hero massif-hero">
        <TerrainHero lat={massif.view.lat} lng={massif.view.lng} track={null} />
        <div className="race-hero-shade" aria-hidden="true" />
        <div className="race-hero-content">
          <nav className="breadcrumb" aria-label="Fil d’Ariane">
            <Link to="/">Accueil</Link>
            <span aria-hidden="true">/</span>
            <Link to="/explorer">Massifs</Link>
          </nav>
          <h1 className="race-title">{massif.title}</h1>
          <p className="race-hero-place">Vue en relief : {massif.view.place}</p>
        </div>
        <RidgeProfile kind={massif.relief} seed={index * 7 + 5} className="massif-hero-ridge" />
      </header>

      <div ref={bodyRef} className="massif-body">
        <section className="massif-intro" aria-label="Présentation">
          <div className="massif-intro-text">
            <p className="massif-lede">{massif.text}</p>
            <dl className="massif-stats">
              <div>
                <dt>Courses à venir</dt>
                <dd>
                  <CountUp value={list.length} format={(n) => String(Math.round(n))} />
                </dd>
              </div>
              {longest > 0 && (
                <div>
                  <dt>Plus long parcours</dt>
                  <dd>{fmtKm(longest)}</dd>
                </div>
              )}
              {maxGain > 0 && (
                <div>
                  <dt>Plus gros dénivelé</dt>
                  <dd>{fmtM(maxGain)}</dd>
                </div>
              )}
              {list[0] && (
                <div>
                  <dt>Prochaine course</dt>
                  <dd>{formatDate(list[0].dateStart, { year: false })}</dd>
                </div>
              )}
            </dl>
            <button type="button" className="button button-primary" onClick={openMap}>
              Voir les {list.length} courses sur la carte
            </button>
          </div>
          {photo && !photoFailed && (
            <figure className="massif-photo">
              <Link to={`/course/${photo.event.id}`} className="massif-photo-frame">
                <img src={photo.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} />
              </Link>
              <figcaption>
                <Link to={`/course/${photo.event.id}`}>{photo.event.name}</Link>
                <PhotoCredit credit={photo.credit} src={photo.src} />
              </figcaption>
            </figure>
          )}
        </section>

        <section className="panel" aria-labelledby="massif-races-title">
          <div className="panel-head">
            <h2 id="massif-races-title">Les prochaines courses</h2>
          </div>
          {list.length ? (
            <>
              <ul className="race-list">
                {list.slice(0, shown).map((e) => (
                  <RaceRow key={e.id} event={e} courses={e.courses.filter((c) => c.start.slice(0, 10) >= today)} />
                ))}
              </ul>
              {shown < list.length && (
                <button type="button" className="button list-more" onClick={() => setShown((n) => n + PAGE)}>
                  Afficher plus de courses
                </button>
              )}
            </>
          ) : (
            <p className="muted">Aucune course à venir dans ce massif pour l’instant.</p>
          )}
        </section>

        <nav className="massif-others" aria-label="Autres massifs">
          <h2>Les autres massifs</h2>
          <ul>
            {MASSIFS.filter((m) => m !== massif).map((m) => (
              <li key={m.slug}>
                <Link to={`/massif/${m.slug}`} className="chip-link">
                  {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </article>
  );
}
