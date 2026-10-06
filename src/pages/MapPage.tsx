import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterBar } from '../components/FilterBar';
import { FilterPanel } from '../components/FilterPanel';
import { ListIcon, MapIcon } from '../components/Icons';
import { RaceListItem } from '../components/RaceListItem';
import { type MapBounds, RaceMap } from '../components/RaceMap';
import { RacePreview } from '../components/RacePreview';
import { applyFilters, SORT_LABELS, sortMatches, type SortKey } from '../lib/filters';
import { useFilterStore } from '../store/filters';
import { useAllRaces } from '../store/races';
import { useToday } from '../store/useToday';

const PAGE = 60;

function inBounds(lat: number, lng: number, b: MapBounds): boolean {
  const inLng = b.west <= b.east ? lng >= b.west && lng <= b.east : lng >= b.west || lng <= b.east;
  return lat >= b.south && lat <= b.north && inLng;
}

export function MapPage() {
  const races = useAllRaces();
  const filters = useFilterStore((s) => s.filters);
  const sort = useFilterStore((s) => s.sort);
  const setSort = useFilterStore((s) => s.setSort);
  const today = useToday();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [onlyVisible, setOnlyVisible] = useState(false);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  // La liste s'affiche par pages : la base compte plusieurs centaines d'événements.
  const [visibleCount, setVisibleCount] = useState(PAGE);

  const matches = useMemo(() => sortMatches(applyFilters(races, filters, today), sort), [races, filters, today, sort]);
  const listed = useMemo(
    () => (onlyVisible && bounds ? matches.filter((m) => inBounds(m.event.lat, m.event.lng, bounds)) : matches),
    [matches, onlyVisible, bounds],
  );
  const selected = matches.find((m) => m.event.id === selectedId) ?? null;
  useEffect(() => {
    setVisibleCount(PAGE);
  }, [filters, sort, onlyVisible]);

  const selectFromList = (id: string) => {
    setSelectedId(id);
    setFocusNonce((n) => n + 1);
    setMobileView('map');
  };
  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);
  const onHover = useCallback((id: string | null) => setHoveredId(id), []);

  return (
    <div className={`map-page view-${mobileView} ${selected ? 'has-preview' : ''}`}>
      <aside className="sidebar" aria-label="Résultats">
        <FilterBar onOpenFilters={() => setFiltersOpen(true)} />
        <div className="results-head">
          <p className="results-count" aria-live="polite">
            <strong>{listed.length}</strong> {listed.length > 1 ? 'courses' : 'course'}
            {onlyVisible && bounds ? ' dans la zone' : ''}
          </p>
          <label className="select-label">
            <span className="sr-only">Trier par</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {Object.entries(SORT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="switch switch-small">
          <input type="checkbox" checked={onlyVisible} onChange={(e) => setOnlyVisible(e.target.checked)} />
          <span>Seulement la zone visible sur la carte</span>
        </label>
        {listed.length ? (
          <ul className="race-list">
            {listed.slice(0, visibleCount).map((m) => (
              <RaceListItem
                key={m.event.id}
                event={m.event}
                courses={m.courses}
                selected={m.event.id === selectedId}
                onSelect={() => selectFromList(m.event.id)}
                onHover={(h) => setHoveredId(h ? m.event.id : null)}
              />
            ))}
            {listed.length > visibleCount && (
              <li className="list-more">
                <button type="button" className="button" onClick={() => setVisibleCount((n) => n + PAGE)}>
                  Afficher {Math.min(PAGE, listed.length - visibleCount)} courses de plus
                </button>
              </li>
            )}
          </ul>
        ) : (
          <div className="empty">
            <img className="empty-illustration" src="brand/boussole.webp" alt="" width={110} height={139} />
            <p>Aucune course ne correspond à ces critères.</p>
            <p className="muted">Élargissez la distance ou la période, ou retirez un filtre ci-dessus.</p>
          </div>
        )}
      </aside>

      <section className="map-area" aria-label="Carte">
        <RaceMap
          matches={matches}
          selectedId={selectedId}
          hoveredId={hoveredId}
          focusNonce={focusNonce}
          onSelect={onSelect}
          onHover={onHover}
          onBoundsChange={setBounds}
        />
        {selected && (
          <div className="preview-dock">
            <RacePreview
              event={selected.event}
              matchingIds={selected.courses.map((c) => c.id)}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </section>

      <div className="mobile-switch" role="tablist" aria-label="Affichage">
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === 'map'}
          className={mobileView === 'map' ? 'is-on' : ''}
          onClick={() => setMobileView('map')}
        >
          <MapIcon size={16} /> Carte
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === 'list'}
          className={mobileView === 'list' ? 'is-on' : ''}
          onClick={() => setMobileView('list')}
        >
          <ListIcon size={16} /> Liste ({listed.length})
        </button>
      </div>

      <FilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} races={races} resultCount={matches.length} />
    </div>
  );
}
