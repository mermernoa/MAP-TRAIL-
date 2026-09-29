import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fmtHours, fmtKm, fmtM, fmtNum, PopularityLabel, TechnicityMeter } from '../components/bits';
import { CourseMap } from '../components/CourseMap';
import { ElevationProfile, ProfileHorizon } from '../components/ElevationProfile';
import { GpxPanel } from '../components/GpxPanel';
import { ExternalIcon } from '../components/Icons';
import { KeyDates } from '../components/KeyDates';
import { SeasonToggle } from '../components/SeasonToggle';
import { TerrainHero } from '../components/TerrainHero';
import { derivedLinks } from '../data';
import type { Course, RaceEvent } from '../data/types';
import { formatDate, formatRange, formatTime, relativeDays } from '../lib/dates';
import { altitudeAt, profileFromCheckpoints, profileFromTrack, type ProfilePoint } from '../lib/gpx';
import {
  countryFlag,
  countryName,
  distanceBand,
  itraPoints,
  kmEffort,
  runningStones,
  TECHNICITY_LABELS,
  utmbCategory,
} from '../lib/metrics';
import { useRace } from '../store/races';
import { useCourseTrack } from '../store/useCourseTrack';
import { useToday } from '../store/useToday';

export function RacePage() {
  const { id } = useParams();
  const event = useRace(id);
  if (!event) {
    return (
      <div className="page-message">
        <h1>Course introuvable</h1>
        <p>Cette course n’existe pas ou a été supprimée de votre navigateur.</p>
        <Link to="/" className="button button-primary">
          Revenir à la carte
        </Link>
      </div>
    );
  }
  return <RaceDetail event={event} />;
}

function RaceDetail({ event }: { event: RaceEvent }) {
  const [params, setParams] = useSearchParams();
  const today = useToday();
  const course = event.courses.find((c) => c.id === params.get('parcours')) ?? event.courses[0];
  const trackState = useCourseTrack(`${event.id}/${course.id}`);
  const [hoverKm, setHoverKm] = useState<number | null>(null);
  const [allCheckpoints, setAllCheckpoints] = useState(false);

  useEffect(() => {
    document.title = `${event.name} – Balise`;
    return () => {
      document.title = 'Balise — carte des trails';
    };
  }, [event.name]);

  useEffect(() => {
    setHoverKm(null);
    setAllCheckpoints(false);
  }, [course.id]);

  const profile: { points: ProfilePoint[]; markers: ProfilePoint[]; source: 'gpx' | 'checkpoints' } | null = useMemo(() => {
    if (trackState.track && trackState.track.maxEle != null) {
      const points = profileFromTrack(trackState.track);
      // Les points de passage sont posés sur la courbe du GPX, qui fait foi pour l'altitude.
      const markers = (course.checkpoints ?? [])
        .filter((cp) => cp.km <= trackState.track!.distanceKm)
        .map((cp) => ({ km: cp.km, alt: altitudeAt(points, cp.km), label: cp.name }));
      return { points, markers, source: 'gpx' };
    }
    if (course.checkpoints && course.checkpoints.length > 2) {
      const points = profileFromCheckpoints(course.checkpoints);
      return { points, markers: points, source: 'checkpoints' };
    }
    return null;
  }, [trackState.track, course.checkpoints]);

  const sortedCourses = [...event.courses].sort((a, b) => b.distanceKm - a.distanceKm);
  const links = derivedLinks(event);

  return (
    <article className="race-page">
      <header className={`race-hero ${event.image ? 'has-photo' : ''}`}>
        {event.image ? (
          <img className="race-hero-photo" src={event.image} alt="" />
        ) : (
          <TerrainHero lat={event.lat} lng={event.lng} track={trackState.track} />
        )}
        <div className="race-hero-shade" aria-hidden="true" />
        <div className="race-hero-content">
          <nav className="breadcrumb" aria-label="Fil d’Ariane">
            <Link to="/">Carte</Link>
            <span aria-hidden="true">/</span>
            <span>{countryName(event.country)}</span>
          </nav>
          <h1 className="race-title">{event.name}</h1>
          <p className="race-hero-place">
            <span aria-hidden="true">{countryFlag(event.country)}</span> {event.city}, {event.region}
          </p>
          <p className="race-hero-date">
            <span>{formatRange(event.dateStart, event.dateEnd)}</span>
            <span className="race-hero-countdown">{relativeDays(event.dateStart, today)}</span>
          </p>
          <div className="race-hero-tags">
            <PopularityLabel level={event.popularity} />
            {event.dateStatus === 'estimated' && <span className="tag tag-on-dark">Date prévisionnelle</span>}
            {event.circuits.map((c) => (
              <span key={c} className="tag tag-on-dark">
                {c}
              </span>
            ))}
          </div>
        </div>
        {profile && <ProfileHorizon points={profile.points} />}
        {event.imageCredit && <p className="race-hero-credit">{event.imageCredit}</p>}
      </header>

      <div className="race-body">
        <div className="course-tabs" role="tablist" aria-label="Parcours">
          {sortedCourses.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === course.id}
              className={`course-tab ${c.id === course.id ? 'is-on' : ''}`}
              onClick={() => setParams(c.id === event.courses[0].id ? {} : { parcours: c.id }, { replace: true })}
            >
              <span className={`course-tab-bar band-${distanceBand(c.distanceKm)}`} aria-hidden="true" />
              <span className="course-tab-name">{c.name}</span>
              <span className="course-tab-stats">
                {fmtKm(c.distanceKm)}, {fmtM(c.elevationGain)} D+
              </span>
            </button>
          ))}
        </div>

        <div className="race-grid">
          <div className="race-main">
            <CourseOverview event={event} course={course} />

            <section className="panel" aria-labelledby="profile-title">
              <div className="panel-head">
                <h2 id="profile-title">Profil</h2>
                {profile && (
                  <p className="muted small">
                    {profile.source === 'gpx'
                      ? 'D’après votre fichier GPX.'
                      : 'Profil simplifié d’après les principaux points de passage, altitudes approximatives.'}
                  </p>
                )}
              </div>
              {profile ? (
                <ElevationProfile
                  points={profile.points}
                  markers={profile.markers}
                  onHoverKm={setHoverKm}
                  ariaLabel={`Profil altimétrique de ${course.name} : ${fmtKm(course.distanceKm)} pour ${fmtM(course.elevationGain)} de dénivelé positif. Flèches gauche et droite pour parcourir.`}
                />
              ) : (
                <p className="empty-inline">
                  Pas encore de profil pour ce parcours. Importez son GPX ci-dessous pour l’afficher.
                </p>
              )}
            </section>

            <section className="panel" aria-labelledby="map-title">
              <div className="panel-head">
                <h2 id="map-title">Parcours</h2>
                {!trackState.track && <p className="muted small">Emplacement de la course. Le tracé apparaît une fois le GPX importé.</p>}
              </div>
              <CourseMap event={event} track={trackState.track} hoverKm={hoverKm} />
            </section>

            <section className="panel" aria-labelledby="gpx-title">
              <div className="panel-head">
                <h2 id="gpx-title">Trace GPX</h2>
              </div>
              {!trackState.loading && (
                <GpxPanel
                  course={course}
                  track={trackState.track}
                  fileName={trackState.fileName}
                  text={trackState.text}
                  error={trackState.error}
                  onFile={trackState.save}
                  onRemove={trackState.remove}
                />
              )}
            </section>

            {course.checkpoints && (
              <section className="panel" aria-labelledby="cp-title">
                <div className="panel-head">
                  <h2 id="cp-title">Points de passage</h2>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Lieu</th>
                        <th scope="col" className="num">
                          Km
                        </th>
                        <th scope="col" className="num">
                          Altitude
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(allCheckpoints || course.checkpoints.length <= 10
                        ? course.checkpoints
                        : course.checkpoints.slice(0, 8)
                      ).map((cp, i) => (
                        <tr key={`${cp.name}-${i}`}>
                          <th scope="row">{cp.name}</th>
                          <td className="num">{fmtNum(cp.km)}</td>
                          <td className="num">{fmtM(cp.alt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {course.checkpoints.length > 10 && (
                  <button type="button" className="link-button table-more" onClick={() => setAllCheckpoints((v) => !v)}>
                    {allCheckpoints ? 'Réduire la liste' : `Afficher les ${course.checkpoints.length} points de passage`}
                  </button>
                )}
              </section>
            )}

            <section className="panel" aria-labelledby="about-title">
              <div className="panel-head">
                <h2 id="about-title">La course</h2>
              </div>
              <p className="prose">{event.description}</p>
            </section>
          </div>

          <aside className="race-aside">
            <section className="panel" aria-labelledby="dates-title">
              <div className="panel-head">
                <h2 id="dates-title">Dates importantes</h2>
              </div>
              <KeyDates event={event} />
            </section>

            <section className="panel" aria-labelledby="links-title">
              <div className="panel-head">
                <h2 id="links-title">Liens</h2>
              </div>
              <ul className="link-list">
                {links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer">
                      {l.label}
                      <ExternalIcon size={14} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <p className="data-note">
              Données indicatives compilées à partir des éditions précédentes.
              {event.dateStatus === 'estimated' && ' Les dates sont prévisionnelles.'} Vérifiez toujours distances, dates et
              conditions d’inscription sur le site officiel avant de vous engager.
            </p>
          </aside>
        </div>
      </div>
    </article>
  );
}

function CourseOverview({ event, course }: { event: RaceEvent; course: Course }) {
  const effort = kmEffort(course);
  const cat = utmbCategory(effort);
  const stones = runningStones(event, course);
  const time = formatTime(course.start);
  return (
    <section className="panel course-overview" aria-labelledby="overview-title">
      <div className="panel-head">
        <h2 id="overview-title">{course.name}</h2>
        <SeasonToggle eventId={event.id} courseId={course.id} courseName={course.name} />
      </div>
      <dl className="stat-grid">
        <div className="stat stat-hero">
          <dt>Distance</dt>
          <dd>{fmtKm(course.distanceKm)}</dd>
        </div>
        <div className="stat stat-hero">
          <dt>Dénivelé positif</dt>
          <dd>{fmtM(course.elevationGain)}</dd>
        </div>
        <div className="stat">
          <dt>Dénivelé négatif</dt>
          <dd>{fmtM(course.elevationLoss ?? course.elevationGain)}</dd>
        </div>
        <div className="stat">
          <dt>Km-effort</dt>
          <dd>{fmtNum(Math.round(effort))}</dd>
        </div>
        <div className="stat">
          <dt>Départ</dt>
          <dd>
            {formatDate(course.start, { weekday: true, year: false })}
            {time && ` à ${time}`}
          </dd>
        </div>
        <div className="stat">
          <dt>Barrière horaire</dt>
          <dd>{course.timeLimitH ? fmtHours(course.timeLimitH) : '—'}</dd>
        </div>
        <div className="stat">
          <dt>Technicité</dt>
          <dd>
            <TechnicityMeter level={course.technicity} showLabel />
          </dd>
        </div>
        <div className="stat">
          <dt>Points ITRA</dt>
          <dd title={course.itraPoints == null ? 'Estimés d’après les km-effort' : undefined}>
            {itraPoints(course)}
            {course.itraPoints == null && <span className="muted small"> (estimés)</span>}
          </dd>
        </div>
        <div className="stat">
          <dt>Catégorie UTMB Index</dt>
          <dd>{cat ?? '—'}</dd>
        </div>
        <div className="stat">
          <dt>Running Stones</dt>
          <dd>{stones ? stones : '—'}</dd>
        </div>
        <div className="stat">
          <dt>Départ et arrivée</dt>
          <dd>
            {course.startPlace ?? event.city}
            {course.finishPlace && course.finishPlace !== (course.startPlace ?? event.city) ? `, arrivée ${course.finishPlace}` : ''}
          </dd>
        </div>
        <div className="stat">
          <dt>Places</dt>
          <dd>{course.maxRunners ? fmtNum(course.maxRunners) : '—'}</dd>
        </div>
      </dl>
      <p className="muted small">{TECHNICITY_LABELS[course.technicity].hint}</p>
    </section>
  );
}
