import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CollectionRail, MassifIndex, useCollectionEntries, useMassifEntries } from '../components/Explore';
import { HomeSearch } from '../components/HomeSearch';
import { RidgeScene } from '../components/RidgeScene';
import { MONTH_SHORT, parseYMD } from '../lib/dates';
import type { Filters } from '../lib/filters';
import { introDelay, useReveal } from '../lib/motion';
import { raceWeekend } from '../lib/weekend';
import { useFilterStore } from '../store/filters';
import { useAllRaces } from '../store/races';
import { useToday } from '../store/useToday';

const plural = (n: number) => `${n} ${n > 1 ? 'courses' : 'course'}`;
/** « 31 oct. », « 1er nov. » */
const shortDay = (iso: string) => {
  const { d, m } = parseYMD(iso);
  return `${d === 1 ? '1er' : d} ${MONTH_SHORT[m - 1]}`;
};
const NEAR_RADIUS_KM = 60;

export function HomePage() {
  const events = useAllRaces();
  const today = useToday();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const bodyRef = useReveal<HTMLDivElement>('.reveal-item', [events.length]);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const upcoming = useMemo(() => events.filter((e) => !e.custom && e.dateEnd >= today), [events, today]);
  const weekend = useMemo(() => raceWeekend(events, today), [events, today]);
  const mythics = useMemo(() => upcoming.filter((e) => e.popularity >= 4).length, [upcoming]);
  const collections = useCollectionEntries(events, today);
  const massifs = useMassifEntries(events, today);

  useEffect(() => {
    document.title = 'Take Ton Trail : toutes les courses de trail, du plus confidentiel au plus mythique';
    // Le décor de l'accueil attend la fin de l'écran de chargement.
    heroRef.current?.style.setProperty('--intro', `${Math.round(introDelay())}ms`);
    return () => {
      document.title = 'Take Ton Trail';
    };
  }, []);

  const openMap = (patch: Partial<Filters>) => {
    const store = useFilterStore.getState();
    store.reset();
    store.setFilters(patch);
    navigate('/carte');
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('La localisation n’est pas disponible sur cet appareil : cherchez plutôt une ville.');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        openMap({ near: { lat: pos.coords.latitude, lng: pos.coords.longitude, radiusKm: NEAR_RADIUS_KM, label: 'Autour de moi' } });
      },
      () => {
        setLocating(false);
        setGeoError('Position introuvable. Autorisez la localisation dans le navigateur, ou cherchez une ville.');
      },
      { timeout: 10000 },
    );
  };

  const weekendDays = weekend ? [parseYMD(weekend.saturday), parseYMD(weekend.sunday)] : null;

  return (
    <div className="home">
      <section ref={heroRef} className="home-hero" aria-labelledby="home-title">
        <div className="home-moon" aria-hidden="true">
          <div className="home-moon-disc" />
          <img className="home-moon-logo" src="brand/3t.webp" alt="" width={271} height={200} />
        </div>
        <RidgeScene host={heroRef} />
        <div className="home-hero-scrim" aria-hidden="true" />
        <div className="home-hero-content">
          <h1 id="home-title" className="home-title">
            Du petit trail du coin à l’ultra mythique.
          </h1>
          <p className="home-lede">
            {upcoming.length} courses à venir en France et outre-mer. Cherchez sur la carte en relief, feuilletez le
            calendrier, gardez les vôtres dans votre saison.
          </p>
          <HomeSearch events={events} today={today} />
          <nav className="home-doors" aria-label="Pour commencer">
            <button type="button" className="door door-near" onClick={locate} disabled={locating} aria-describedby={geoError ? 'geo-error' : undefined}>
              <span className="door-visual door-radar" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="door-title">Près de chez moi</span>
              <span className="door-text">{locating ? 'Localisation en cours…' : `Les courses à moins de ${NEAR_RADIUS_KM} km`}</span>
            </button>
            <button
              type="button"
              className="door door-weekend"
              disabled={!weekend}
              onClick={() => weekend && openMap({ dateFrom: weekend.saturday, dateTo: weekend.sunday })}
            >
              {weekendDays && (
                <span className="door-visual door-calendar" aria-hidden="true">
                  <span className="door-calendar-month">{MONTH_SHORT[weekendDays[0].m - 1]}</span>
                  <span className="door-calendar-days">
                    {weekendDays[0].d}
                    <small>–</small>
                    {weekendDays[1].d}
                  </span>
                </span>
              )}
              <span className="door-title">Ce week-end</span>
              <span className="door-text">
                {!weekend
                  ? 'Aucune course dans les six prochains mois.'
                  : weekend.isThisWeekend
                    ? `${plural(weekend.events.length)} samedi et dimanche`
                    : `Rien ce week-end. Le prochain : ${plural(weekend.events.length)} les ${shortDay(weekend.saturday)} et ${shortDay(weekend.sunday)}`}
              </span>
            </button>
            <Link to="/collection/les-mythiques" className="door door-mythic">
              <img className="door-visual door-medal" src="brand/medaille.webp" alt="" width={356} height={520} />
              <span className="door-title">Les mythiques</span>
              <span className="door-text">{plural(mythics)} de légende</span>
            </Link>
          </nav>
          {geoError && (
            <p id="geo-error" className="home-geo-error" role="alert">
              {geoError}
            </p>
          )}
        </div>
      </section>

      <div ref={bodyRef} className="home-body">
        <section className="home-section" aria-labelledby="collections-title">
          <div className="home-section-head reveal-item">
            <h2 id="collections-title">Par envie</h2>
            <p>Des sélections thématiques, toujours à jour avec la base.</p>
            <Link to="/explorer" className="home-section-link">
              Toutes les collections
            </Link>
          </div>
          <div className="reveal-item">
            <CollectionRail entries={collections} />
          </div>
        </section>

        <section className="home-section" aria-labelledby="massifs-title">
          <div className="home-section-head reveal-item">
            <h2 id="massifs-title">Par massif</h2>
            <p>Du Mont-Blanc aux landes bretonnes, chaque massif a son terrain et sa saison.</p>
          </div>
          <div className="reveal-item">
            <MassifIndex entries={massifs} />
          </div>
        </section>

        <section className="home-season reveal-item" aria-labelledby="season-title">
          <img src="brand/medaille.webp" alt="" width={178} height={260} className="home-season-medal" />
          <div>
            <h2 id="season-title">Votre saison, en un coup d’œil</h2>
            <p>
              Ajoutez vos courses, fixez vos objectifs, suivez les dates d’inscription. Avec un compte, votre saison vous suit
              sur tous vos appareils et des courses qui vous ressemblent vous sont proposées.
            </p>
            <div className="home-season-actions">
              <Link to="/ma-saison" className="button button-primary">
                Ouvrir ma saison
              </Link>
              <Link to="/compte" className="button">
                Créer un compte
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
