import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fmtDplus, fmtHours, fmtKm, fmtM, fmtNum, fmtPrice, PopularityLabel, TechnicityMeter } from '../components/bits';
import { CourseMap } from '../components/CourseMap';
import { ElevationProfile, ProfileHorizon } from '../components/ElevationProfile';
import { GpxPanel } from '../components/GpxPanel';
import { ExternalIcon, MountainIcon } from '../components/Icons';
import { KeyDates } from '../components/KeyDates';
import { SeasonToggle } from '../components/SeasonToggle';
import { TerrainHero } from '../components/TerrainHero';
import { derivedLinks } from '../data';
import type { Course, RaceEvent } from '../data/types';
import { formatDate, formatRange, formatTime, relativeDays } from '../lib/dates';
import { altitudeAt, profileFromCheckpoints, profileFromTrack, type ProfilePoint } from '../lib/gpx';
import { useParallax } from '../lib/motion';
import {
  countryFlag,
  courseUtmbCategory,
  distanceBand,
  itraPoints,
  kmEffort,
  runningStones,
  TECHNICITY_LABELS,
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
  return <RaceDetail key={event.id} event={event} />;
}

function RaceDetail({ event }: { event: RaceEvent }) {
  const [params, setParams] = useSearchParams();
  const today = useToday();
  const course = event.courses.find((c) => c.id === params.get('parcours')) ?? event.courses[0];
  const trackState = useCourseTrack(`${event.id}/${course.id}`, course.gpxUrl);
  const [hoverKm, setHoverKm] = useState<number | null>(null);
  const [flyKm, setFlyKm] = useState<number | null>(null);
  const [allCheckpoints, setAllCheckpoints] = useState(false);
  // Photo de la base si elle existe et se charge, sinon relief 3D du lieu.
  const [heroMode, setHeroMode] = useState<'photo' | 'relief'>(event.image ? 'photo' : 'relief');
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = !!event.image && heroMode === 'photo' && !photoFailed;
  const heroRef = useParallax<HTMLElement>(0.35);

  useEffect(() => {
    document.title = `${event.name} – Take Ton Trail`;
    return () => {
      document.title = 'Take Ton Trail';
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
      <header ref={heroRef} className={`race-hero ${showPhoto ? 'has-photo' : ''}`}>
        {showPhoto ? (
          <img
            className="race-hero-photo"
            src={event.image}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <TerrainHero lat={event.lat} lng={event.lng} track={trackState.track} />
        )}
        {event.image && !photoFailed && (
          <div className="race-hero-switch">
            <button
              type="button"
              className="map-tool"
              onClick={() => setHeroMode((m) => (m === 'photo' ? 'relief' : 'photo'))}
            >
              <MountainIcon size={16} />
              {heroMode === 'photo' ? 'Voir le relief 3D' : 'Voir la photo'}
            </button>
          </div>
        )}
        <div className="race-hero-shade" aria-hidden="true" />
        <div className="race-hero-content">
          <nav className="breadcrumb" aria-label="Fil d’Ariane">
            <Link to="/">Carte</Link>
            <span aria-hidden="true">/</span>
            <span>{event.region}</span>
          </nav>
          <h1 className="race-title">{event.name}</h1>
          <p className="race-hero-place">
            <span aria-hidden="true">{countryFlag(event.country)}</span> {event.city}
            {event.department ? `, ${event.department}` : `, ${event.region}`}
          </p>
          {(event.massif || event.edition) && (
            <p className="race-hero-meta">
              {event.massif && <span>Massif : {event.massif}</span>}
              {event.edition && <span>Édition {event.edition}</span>}
            </p>
          )}
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
        {showPhoto && event.imageCredit && <p className="race-hero-credit">Photo : {event.imageCredit}</p>}
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
                {fmtKm(c.distanceKm)}, {fmtDplus(c.elevationGain)}
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
                  playKm={profile.source === 'gpx' ? flyKm : null}
                  ariaLabel={`Profil altimétrique de ${course.name} : ${fmtKm(course.distanceKm)}${course.elevationGain != null ? ` pour ${fmtM(course.elevationGain)} de dénivelé positif` : ''}. Flèches gauche et droite pour parcourir.`}
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
              <CourseMap event={event} track={trackState.track} hoverKm={hoverKm} onFlyKm={setFlyKm} />
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
                  remote={trackState.remote}
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
              {(event.highlights || event.access) && (
                <div className="race-extra">
                  {event.highlights && (
                    <div>
                      <h3>Points forts</h3>
                      <p className="prose">{event.highlights}</p>
                    </div>
                  )}
                  {event.access && (
                    <div>
                      <h3>Accès et navettes</h3>
                      <p className="prose">{event.access}</p>
                    </div>
                  )}
                </div>
              )}
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
              {event.custom
                ? 'Course ajoutée par vous, enregistrée dans ce navigateur.'
                : `Fiche issue de la base Take Ton Trail${event.source ? ` (source : ${event.source})` : ''}${
                    event.updatedAt ? `, mise à jour le ${formatDate(event.updatedAt)}` : ''
                  }.`}
              {event.dateStatus === 'estimated' && ' Les dates sont prévisionnelles.'} Vérifiez les conditions d’inscription
              sur le site de l’organisation avant de vous engager.
            </p>
          </aside>
        </div>
      </div>
    </article>
  );
}

function CourseOverview({ event, course }: { event: RaceEvent; course: Course }) {
  const effort = kmEffort(course);
  const cat = courseUtmbCategory(course);
  const points = itraPoints(course);
  const stones = runningStones(event, course);
  const time = formatTime(course.start);
  const facts = [course.type, course.format, course.courseShape, course.terrain].filter(Boolean);
  return (
    <section className="panel course-overview" aria-labelledby="overview-title">
      <div className="panel-head">
        <div>
          <h2 id="overview-title">{course.name}</h2>
          {facts.length > 0 && <p className="course-facts">{facts.join(', ')}</p>}
        </div>
        <div className="button-row">
          {course.registrationUrl && course.full !== 'yes' && (
            <a className="button button-primary" href={course.registrationUrl} target="_blank" rel="noreferrer">
              S’inscrire
              <ExternalIcon size={14} />
            </a>
          )}
          <SeasonToggle eventId={event.id} courseId={course.id} courseName={course.name} />
        </div>
      </div>
      {course.full === 'yes' && <p className="notice notice-full">Cette course est complète.</p>}
      {course.full === 'waitlist' && <p className="notice notice-wait">Inscriptions sur liste d’attente.</p>}
      <dl className="stat-grid">
        <div className="stat stat-hero">
          <dt>Distance</dt>
          <dd>{fmtKm(course.distanceKm)}</dd>
        </div>
        <div className="stat stat-hero">
          <dt>Dénivelé positif</dt>
          <dd>{course.elevationGain != null ? fmtM(course.elevationGain) : <span className="stat-missing">Non communiqué</span>}</dd>
        </div>
        <div className="stat">
          <dt>Départ</dt>
          <dd>
            {formatDate(course.start, { weekday: true, year: false })}
            {time && ` à ${time}`}
          </dd>
        </div>
        <div className="stat">
          <dt>Lieu de départ</dt>
          <dd>
            {course.startPlace ?? event.city}
            {course.finishPlace && course.finishPlace !== (course.startPlace ?? event.city) ? `, arrivée ${course.finishPlace}` : ''}
          </dd>
        </div>
        <div className="stat">
          <dt>Technicité</dt>
          <dd>
            <TechnicityMeter level={course.technicity} showLabel />
          </dd>
        </div>
        {course.priceEur != null && (
          <div className="stat">
            <dt>Prix</dt>
            <dd>{fmtPrice(course.priceEur)}</dd>
          </div>
        )}
        {course.elevationGain != null && (
          <div className="stat">
            <dt>Km-effort</dt>
            <dd>{fmtNum(Math.round(effort))}</dd>
          </div>
        )}
        {course.elevationLoss != null && (
          <div className="stat">
            <dt>Dénivelé négatif</dt>
            <dd>{fmtM(course.elevationLoss)}</dd>
          </div>
        )}
        {course.timeLimitH != null && (
          <div className="stat">
            <dt>Barrière horaire</dt>
            <dd>{fmtHours(course.timeLimitH)}</dd>
          </div>
        )}
        {points != null && (
          <div className="stat">
            <dt>Points ITRA</dt>
            <dd title={course.itraPoints == null ? 'Estimés d’après les km-effort' : undefined}>
              {points}
              {course.itraPoints == null && <span className="muted small"> (estimés)</span>}
            </dd>
          </div>
        )}
        {cat && (
          <div className="stat">
            <dt>{course.utmbIndex ? 'Catégorie UTMB Index' : 'Catégorie (estimée)'}</dt>
            <dd>{cat}</dd>
          </div>
        )}
        {stones > 0 && (
          <div className="stat">
            <dt>Running Stones</dt>
            <dd>{stones}</dd>
          </div>
        )}
        {course.maxRunners != null && (
          <div className="stat">
            <dt>Places</dt>
            <dd>{fmtNum(course.maxRunners)}</dd>
          </div>
        )}
        {course.participantsLastEdition != null && (
          <div className="stat">
            <dt>Participants l’an dernier</dt>
            <dd>{fmtNum(course.participantsLastEdition)}</dd>
          </div>
        )}
        {course.aidStations != null && (
          <div className="stat">
            <dt>Ravitaillements</dt>
            <dd>{course.aidStations}</dd>
          </div>
        )}
        {course.requiredDocument && (
          <div className="stat">
            <dt>Document requis</dt>
            <dd>{course.requiredDocument}</dd>
          </div>
        )}
      </dl>
      {course.technicity != null && <p className="muted small">{TECHNICITY_LABELS[course.technicity].hint}</p>}
      {course.qualifierFor && <p className="small">Qualificative pour : {course.qualifierFor}</p>}
      {course.mandatoryGear && <p className="small">Matériel obligatoire : {course.mandatoryGear}</p>}
    </section>
  );
}
