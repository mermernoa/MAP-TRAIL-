import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_CIRCUITS } from '../data';
import type { Popularity, RaceEvent, Technicity, UtmbCategory } from '../data/types';
import { addDays, parseYMD } from '../lib/dates';
import { DISTANCE_STOPS, ELEVATION_STOPS, type Filters } from '../lib/filters';
import { countryFlag, countryName, POPULARITY_LABELS, TECHNICITY_LABELS } from '../lib/metrics';
import { useFilterStore } from '../store/filters';
import { useToday } from '../store/useToday';
import { fmtNum } from './bits';
import { CloseIcon, LocateIcon } from './Icons';
import { RangeSlider } from './RangeSlider';

interface Props {
  open: boolean;
  onClose: () => void;
  races: RaceEvent[];
  resultCount: number;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" className={`chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

const DISTANCE_PRESETS: { label: string; value: [number, number] }[] = [
  { label: 'Moins de 30 km', value: [0, 30] },
  { label: '30 à 50 km', value: [30, 50] },
  { label: '50 à 100 km', value: [50, 100] },
  { label: '100 km et plus', value: [100, Infinity] },
  { label: '100 miles et plus', value: [160, Infinity] },
];

const RADII = [50, 100, 200, 500, 1000];

export function FilterPanel({ open, onClose, races, resultCount }: Props) {
  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);
  const reset = useFilterStore((s) => s.reset);
  const today = useToday();
  const panelRef = useRef<HTMLDivElement>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of races) counts.set(r.country, (counts.get(r.country) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || countryName(a[0]).localeCompare(countryName(b[0])));
  }, [races]);

  const set = (patch: Partial<Filters>) => setFilters(patch);
  const nextYear = parseYMD(today).y + 1;
  const datePresets: { label: string; from: string; to: string }[] = [
    { label: '30 prochains jours', from: today, to: addDays(today, 30) },
    { label: '3 prochains mois', from: today, to: addDays(today, 91) },
    { label: '6 prochains mois', from: today, to: addDays(today, 182) },
    { label: `Saison ${nextYear}`, from: `${nextYear}-01-01`, to: `${nextYear}-12-31` },
  ];

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setGeoError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        set({
          near: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            radiusKm: filters.near?.radiusKm ?? 200,
            label: 'Autour de moi',
          },
        });
      },
      () => {
        setLocating(false);
        setGeoError("Position introuvable. Autorisez la localisation dans le navigateur, puis réessayez.");
      },
      { timeout: 10000 },
    );
  };

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filters-title"
        tabIndex={-1}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer-head">
          <h2 id="filters-title">Filtres</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer les filtres">
            <CloseIcon />
          </button>
        </header>

        <div className="drawer-body">
          <section className="filter-section">
            <RangeSlider
              label="Distance"
              stops={DISTANCE_STOPS}
              value={filters.distance}
              onChange={(distance) => set({ distance })}
              format={(v) => `${v} km`}
            />
            <div className="chips">
              {DISTANCE_PRESETS.map((p) => (
                <Chip
                  key={p.label}
                  on={filters.distance[0] === p.value[0] && filters.distance[1] === p.value[1]}
                  onClick={() => set({ distance: p.value })}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </section>

          <section className="filter-section">
            <RangeSlider
              label="Dénivelé positif"
              stops={ELEVATION_STOPS}
              value={filters.elevation}
              onChange={(elevation) => set({ elevation })}
              format={(v) => `${fmtNum(v)} m`}
            />
          </section>

          <section className="filter-section">
            <h3 className="filter-title">Technicité</h3>
            <div className="chips">
              {([1, 2, 3, 4, 5] as Technicity[]).map((t) => (
                <Chip
                  key={t}
                  on={filters.technicity.includes(t)}
                  onClick={() => set({ technicity: toggle(filters.technicity, t) })}
                  title={TECHNICITY_LABELS[t].hint}
                >
                  <span className="chip-num">{t}</span> {TECHNICITY_LABELS[t].label}
                </Chip>
              ))}
            </div>
          </section>

          <section className="filter-section">
            <h3 className="filter-title">Index</h3>
            <p className="filter-hint">Points ITRA minimum (estimés d’après les km-effort)</p>
            <div className="segmented" role="radiogroup" aria-label="Points ITRA minimum">
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={filters.itraMin === n}
                  className={filters.itraMin === n ? 'is-on' : ''}
                  onClick={() => set({ itraMin: n })}
                >
                  {n === 0 ? 'Tous' : `${n}+`}
                </button>
              ))}
            </div>
            <p className="filter-hint">Catégorie UTMB Index</p>
            <div className="chips">
              {(['20K', '50K', '100K', '100M'] as UtmbCategory[]).map((c) => (
                <Chip
                  key={c}
                  on={filters.utmbCategories.includes(c)}
                  onClick={() => set({ utmbCategories: toggle(filters.utmbCategories, c) })}
                >
                  {c}
                </Chip>
              ))}
            </div>
            <p className="filter-hint">Circuits</p>
            <div className="chips">
              {ALL_CIRCUITS.map((c) => (
                <Chip key={c} on={filters.circuits.includes(c)} onClick={() => set({ circuits: toggle(filters.circuits, c) })}>
                  {c}
                </Chip>
              ))}
            </div>
          </section>

          <section className="filter-section">
            <h3 className="filter-title">Localisation</h3>
            <div className="near-row">
              <button type="button" className="button" onClick={locate} disabled={locating}>
                <LocateIcon size={16} /> {locating ? 'Localisation…' : 'Autour de moi'}
              </button>
              <label className="select-label">
                <span className="sr-only">Rayon</span>
                <select
                  value={filters.near?.radiusKm ?? 200}
                  disabled={!filters.near}
                  onChange={(e) => filters.near && set({ near: { ...filters.near, radiusKm: Number(e.target.value) } })}
                >
                  {RADII.map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                </select>
              </label>
              {filters.near && (
                <button type="button" className="link-button" onClick={() => set({ near: null })}>
                  Retirer
                </button>
              )}
            </div>
            {geoError && <p className="form-error">{geoError}</p>}
            <p className="filter-hint">Pays</p>
            <div className="chips">
              {countries.map(([code, count]) => (
                <Chip key={code} on={filters.countries.includes(code)} onClick={() => set({ countries: toggle(filters.countries, code) })}>
                  <span aria-hidden="true">{countryFlag(code)}</span> {countryName(code)} <span className="chip-count">{count}</span>
                </Chip>
              ))}
            </div>
          </section>

          <section className="filter-section">
            <h3 className="filter-title">Date</h3>
            <div className="chips">
              {datePresets.map((p) => (
                <Chip
                  key={p.label}
                  on={filters.dateFrom === p.from && filters.dateTo === p.to}
                  onClick={() => set({ dateFrom: p.from, dateTo: p.to })}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
            <div className="date-row">
              <label>
                Du
                <input type="date" value={filters.dateFrom ?? ''} onChange={(e) => set({ dateFrom: e.target.value || null })} />
              </label>
              <label>
                au
                <input type="date" value={filters.dateTo ?? ''} onChange={(e) => set({ dateTo: e.target.value || null })} />
              </label>
            </div>
            <label className="switch">
              <input type="checkbox" checked={filters.includePast} onChange={(e) => set({ includePast: e.target.checked })} />
              <span>Inclure les courses déjà passées</span>
            </label>
          </section>

          <section className="filter-section">
            <h3 className="filter-title">Notoriété</h3>
            <div className="chips">
              {([1, 2, 3, 4, 5] as Popularity[]).map((p) => (
                <Chip
                  key={p}
                  on={filters.popularity.includes(p)}
                  onClick={() => set({ popularity: toggle(filters.popularity, p) })}
                  title={POPULARITY_LABELS[p].hint}
                >
                  {POPULARITY_LABELS[p].label}
                </Chip>
              ))}
            </div>
          </section>

          <section className="filter-section">
            <h3 className="filter-title">Inscriptions</h3>
            <label className="switch">
              <input
                type="checkbox"
                checked={filters.registrationOpen}
                onChange={(e) => set({ registrationOpen: e.target.checked })}
              />
              <span>Seulement les inscriptions ouvertes aujourd’hui</span>
            </label>
          </section>
        </div>

        <footer className="drawer-foot">
          <button type="button" className="button button-ghost" onClick={reset}>
            Réinitialiser
          </button>
          <button type="button" className="button button-primary" onClick={onClose}>
            Voir {resultCount} {resultCount > 1 ? 'courses' : 'course'}
          </button>
        </footer>
      </div>
    </div>
  );
}
