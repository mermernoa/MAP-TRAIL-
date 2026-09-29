import { useEffect, useRef, useState } from 'react';
import type { Course, RaceEvent, Technicity } from '../data/types';
import maplibregl, { supportsWebGL, type MapLibreMap } from '../lib/maplibre';
import { basemapStyle } from '../lib/mapStyles';
import { countryName, TECHNICITY_LABELS } from '../lib/metrics';
import { normalize } from '../lib/filters';
import { useSeasonStore } from '../store/season';
import { CloseIcon, PlusIcon, TrashIcon } from './Icons';

interface Props {
  onClose: () => void;
  onCreated: (race: RaceEvent) => void;
}

interface CourseDraft {
  name: string;
  distanceKm: string;
  elevationGain: string;
  time: string;
  technicity: Technicity;
}

const COUNTRIES = ['FR', 'BE', 'CH', 'LU', 'IT', 'ES', 'PT', 'AD', 'DE', 'AT', 'GB', 'US', 'CA', 'MA'];

function slug(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** Formulaire pour ajouter une course absente du catalogue (stockée dans le navigateur). */
export function CustomRaceForm({ onClose, onCreated }: Props) {
  const addCustomRace = useSeasonStore((s) => s.addCustomRace);
  const add = useSeasonStore((s) => s.add);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('FR');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [website, setWebsite] = useState('');
  const [opens, setOpens] = useState('');
  const [closes, setCloses] = useState('');
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [courses, setCourses] = useState<CourseDraft[]>([
    { name: '', distanceKm: '', elevationGain: '', time: '08:00', technicity: 2 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!mapEl.current || !supportsWebGL()) return;
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: basemapStyle('plan'),
      center: [2.5, 46.5],
      zoom: 4.3,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', (e) => setPos({ lat: Number(e.lngLat.lat.toFixed(5)), lng: Number(e.lngLat.lng.toFixed(5)) }));
    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pos) return;
    markerRef.current ??= new maplibregl.Marker({ color: '#d7322b' });
    markerRef.current.setLngLat([pos.lng, pos.lat]).addTo(map);
  }, [pos]);

  const updateCourse = (i: number, patch: Partial<CourseDraft>) =>
    setCourses((list) => list.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Donnez un nom à la course.');
    if (!dateStart) return setError('Indiquez la date de la course.');
    if (!pos) return setError('Placez la course sur la carte en cliquant sur son lieu de départ.');
    const valid = courses.filter((c) => Number(c.distanceKm) > 0);
    if (!valid.length) return setError('Ajoutez au moins un parcours avec sa distance.');
    const end = dateEnd && dateEnd >= dateStart ? dateEnd : dateStart;
    const id = `perso-${slug(name) || 'course'}-${Date.now().toString(36)}`;
    const builtCourses: Course[] = valid.map((c, i) => ({
      id: `p${i + 1}`,
      name: c.name.trim() || `${Number(c.distanceKm)} km`,
      distanceKm: Number(c.distanceKm),
      elevationGain: Number(c.elevationGain) || 0,
      start: `${dateStart}T${c.time || '08:00'}`,
      technicity: c.technicity,
    }));
    const race: RaceEvent = {
      id,
      name: name.trim(),
      country,
      region: region.trim() || countryName(country),
      city: city.trim() || name.trim(),
      lat: pos.lat,
      lng: pos.lng,
      dateStart,
      dateEnd: end,
      dateStatus: 'official',
      popularity: 1,
      circuits: [],
      description: 'Course ajoutée par vous. Ses informations sont enregistrées dans ce navigateur.',
      website: website.trim() || undefined,
      links: [],
      registration: { opens: opens || undefined, closes: closes || undefined },
      courses: builtCourses,
      custom: true,
    };
    addCustomRace(race);
    add(race.id, builtCourses[0].id);
    onCreated(race);
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="custom-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="drawer-head">
          <h2 id="custom-title">Ajouter une course hors catalogue</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer">
            <CloseIcon />
          </button>
        </header>
        <div className="drawer-body form-grid">
          <label className="field field-wide">
            Nom de la course
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Trail des Crêtes du village" required />
          </label>
          <label className="field">
            Ville de départ
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="field">
            Région ou département
            <input value={region} onChange={(e) => setRegion(e.target.value)} />
          </label>
          <label className="field">
            Pays
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Site web
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
          </label>
          <label className="field">
            Premier jour
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} required />
          </label>
          <label className="field">
            Dernier jour (facultatif)
            <input type="date" value={dateEnd} min={dateStart} onChange={(e) => setDateEnd(e.target.value)} />
          </label>
          <label className="field">
            Ouverture des inscriptions
            <input type="date" value={opens} onChange={(e) => setOpens(e.target.value)} />
          </label>
          <label className="field">
            Clôture des inscriptions
            <input type="date" value={closes} onChange={(e) => setCloses(e.target.value)} />
          </label>

          <div className="field field-wide">
            <span>Lieu de départ : cliquez sur la carte</span>
            <div ref={mapEl} className="pick-map" />
            <span className="muted small">{pos ? `${pos.lat}, ${pos.lng}` : 'Aucun lieu choisi'}</span>
          </div>

          <fieldset className="field-wide course-drafts">
            <legend>Parcours</legend>
            {courses.map((c, i) => (
              <div className="course-draft" key={i}>
                <label className="field">
                  Nom
                  <input value={c.name} onChange={(e) => updateCourse(i, { name: e.target.value })} placeholder="Grand trail" />
                </label>
                <label className="field">
                  Distance (km)
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={c.distanceKm} onChange={(e) => updateCourse(i, { distanceKm: e.target.value })} />
                </label>
                <label className="field">
                  D+ (m)
                  <input type="number" min="0" step="10" inputMode="numeric" value={c.elevationGain} onChange={(e) => updateCourse(i, { elevationGain: e.target.value })} />
                </label>
                <label className="field">
                  Heure de départ
                  <input type="time" value={c.time} onChange={(e) => updateCourse(i, { time: e.target.value })} />
                </label>
                <label className="field">
                  Technicité
                  <select value={c.technicity} onChange={(e) => updateCourse(i, { technicity: Number(e.target.value) as Technicity })}>
                    {([1, 2, 3, 4, 5] as Technicity[]).map((t) => (
                      <option key={t} value={t}>
                        {t}, {TECHNICITY_LABELS[t].label}
                      </option>
                    ))}
                  </select>
                </label>
                {courses.length > 1 && (
                  <button type="button" className="icon-button" onClick={() => setCourses((l) => l.filter((_, k) => k !== i))} aria-label="Retirer ce parcours">
                    <TrashIcon />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setCourses((l) => [...l, { name: '', distanceKm: '', elevationGain: '', time: '08:00', technicity: 2 }])}
            >
              <PlusIcon size={16} /> Ajouter un parcours
            </button>
          </fieldset>
          {error && (
            <p className="form-error field-wide" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="drawer-foot">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="button button-primary">
            Ajouter la course
          </button>
        </footer>
      </form>
    </div>
  );
}
