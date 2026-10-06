import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import type { Match } from '../lib/filters';
import maplibregl, { supportsWebGL, type GeoJSONSource, type MapLibreMap } from '../lib/maplibre';
import { BAND_COLORS, INK } from '../lib/colors';
import { formatRange } from '../lib/dates';
import { DISTANCE_BANDS, distanceBand } from '../lib/metrics';
import { basemapStyle, BASEMAPS, DEM_SOURCE, LABEL_FONT, type BasemapId } from '../lib/mapStyles';
import { LayersIcon, MountainIcon } from './Icons';

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface Props {
  matches: Match[];
  selectedId: string | null;
  hoveredId: string | null;
  /** Change à chaque demande de recentrage sur `selectedId`. */
  focusNonce: number;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
}

const SRC = 'races';
const FOCUS_SRC = 'race-focus';

function toGeoJSON(matches: Match[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: matches.map(({ event, courses }) => {
      const maxKm = Math.max(...courses.map((c) => c.distanceKm));
      return {
        type: 'Feature',
        id: event.id,
        geometry: { type: 'Point', coordinates: [event.lng, event.lat] },
        properties: {
          id: event.id,
          name: event.name,
          band: distanceBand(maxKm),
          popularity: event.popularity,
          dates: formatRange(event.dateStart, event.dateEnd),
          distances: courses
            .map((c) => `${Math.round(c.distanceKm)} km`)
            .slice(0, 5)
            .join(', '),
        },
      };
    }),
  };
}

const bandColorExpr = [
  'match',
  ['get', 'band'],
  ...Object.entries(BAND_COLORS).flat(),
  INK,
] as unknown as maplibregl.ExpressionSpecification;

// Rayon selon la notoriété ; `zoom` doit rester l'entrée d'un interpolate de premier niveau.
function radiusExpr(extra = 0): maplibregl.ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    3,
    ['+', 3 + extra, ['*', 1.2, ['get', 'popularity']]],
    9,
    ['+', 6 + extra, ['*', 1.8, ['get', 'popularity']]],
  ] as unknown as maplibregl.ExpressionSpecification;
}

function addRaceLayers(map: MapLibreMap, basemap: BasemapId, data: FeatureCollection<Point>) {
  if (!map.getSource('dem')) map.addSource('dem', DEM_SOURCE);
  if (basemap === 'plan' && !map.getLayer('hillshade')) {
    if (!map.getSource('dem-shade')) map.addSource('dem-shade', DEM_SOURCE);
    const firstLine = map.getStyle().layers.find((l) => l.type === 'line' || l.type === 'symbol')?.id;
    map.addLayer(
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'dem-shade',
        paint: {
          'hillshade-exaggeration': 0.35,
          'hillshade-shadow-color': '#3d4d44',
          'hillshade-highlight-color': '#ffffff',
          'hillshade-accent-color': '#5d6b5f',
        },
      },
      firstLine,
    );
  }

  const onImagery = basemap === 'satellite';
  map.addSource(SRC, {
    type: 'geojson',
    data,
    cluster: true,
    clusterRadius: 42,
    clusterMaxZoom: 7,
  });
  map.addSource(FOCUS_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  map.addLayer({
    id: 'race-clusters',
    type: 'circle',
    source: SRC,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': INK,
      'circle-opacity': 0.88,
      'circle-radius': ['step', ['get', 'point_count'], 14, 5, 18, 12, 23],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'race-cluster-count',
    type: 'symbol',
    source: SRC,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': LABEL_FONT,
      'text-size': 13,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  });
  map.addLayer({
    id: 'race-points',
    type: 'circle',
    source: SRC,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': bandColorExpr,
      'circle-radius': radiusExpr(),
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'race-labels',
    type: 'symbol',
    source: SRC,
    filter: ['!', ['has', 'point_count']],
    minzoom: 5.5,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': LABEL_FONT,
      'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 11, 13],
      'text-offset': [0, 1.3],
      'text-anchor': 'top',
      'text-max-width': 9,
      'symbol-sort-key': ['-', 10, ['get', 'popularity']],
    },
    paint: onImagery
      ? { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.2 }
      : { 'text-color': '#1f2d27', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.2 },
  });
  // Couche « focus » hors clusters : le repère survolé ou sélectionné reste visible.
  map.addLayer({
    id: 'race-focus-ring',
    type: 'circle',
    source: FOCUS_SRC,
    paint: {
      'circle-color': 'rgba(0,0,0,0)',
      'circle-radius': radiusExpr(6),
      'circle-stroke-color': INK,
      'circle-stroke-width': ['case', ['==', ['get', 'role'], 'selected'], 3, 2],
    },
  });
  map.addLayer({
    id: 'race-focus-point',
    type: 'circle',
    source: FOCUS_SRC,
    paint: {
      'circle-color': bandColorExpr,
      'circle-radius': radiusExpr(),
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });
}

export function RaceMap({ matches, selectedId, hoveredId, focusNonce, onSelect, onHover, onBoundsChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>('plan');
  const [terrain, setTerrain] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  // Dernières valeurs des props, lues depuis les gestionnaires MapLibre.
  const latest = useRef({ matches, selectedId, hoveredId, onSelect, onHover, onBoundsChange, basemap, terrain });
  latest.current = { matches, selectedId, hoveredId, onSelect, onHover, onBoundsChange, basemap, terrain };

  useEffect(() => {
    if (!containerRef.current) return;
    if (!supportsWebGL()) {
      setFailed(true);
      return;
    }
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapStyle('plan'),
      center: [2.6, 46.6],
      zoom: window.innerWidth < 700 ? 4.3 : 5,
      maxPitch: 75,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false } }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('style.load', () => {
      const { matches: m, basemap: b, terrain: t } = latest.current;
      addRaceLayers(map, b, toGeoJSON(m));
      if (t) map.setTerrain({ source: 'dem', exaggeration: 1.4 });
      syncFocus(map);
    });

    map.on('click', 'race-clusters', async (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const source = map.getSource(SRC) as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number);
      map.easeTo({ center: (feature.geometry as Point).coordinates as [number, number], zoom: zoom + 0.3 });
    });

    const pick = (e: maplibregl.MapMouseEvent) =>
      map.queryRenderedFeatures(e.point, { layers: ['race-focus-point', 'race-points'] })[0];

    map.on('click', (e) => {
      if (map.queryRenderedFeatures(e.point, { layers: ['race-clusters'] }).length) return;
      const f = pick(e);
      latest.current.onSelect(f ? (f.properties.id as string) : null);
    });

    map.on('mousemove', (e) => {
      const f = pick(e);
      const overCluster = !f && map.queryRenderedFeatures(e.point, { layers: ['race-clusters'] }).length > 0;
      map.getCanvas().style.cursor = f || overCluster ? 'pointer' : '';
      const id = f ? (f.properties.id as string) : null;
      if (id !== latest.current.hoveredId) latest.current.onHover(id);
      if (f) {
        const p = f.properties;
        popupRef.current ??= new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'map-tooltip' });
        popupRef.current
          .setLngLat((f.geometry as Point).coordinates as [number, number])
          .setHTML(
            `<strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.dates)}</span><span>${escapeHtml(p.distances)}</span>`,
          )
          .addTo(map);
      } else {
        popupRef.current?.remove();
      }
    });
    map.getCanvas().addEventListener('mouseleave', () => {
      popupRef.current?.remove();
      latest.current.onHover(null);
    });

    const emitBounds = () => {
      const b = map.getBounds();
      latest.current.onBoundsChange?.({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    };
    map.on('moveend', emitBounds);
    map.on('load', emitBounds);
    map.on('error', (e) => console.warn('[carte]', e.error?.message ?? e));

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function syncFocus(map: MapLibreMap) {
    const src = map.getSource(FOCUS_SRC) as GeoJSONSource | undefined;
    if (!src) return;
    const { matches: m, selectedId: sel, hoveredId: hov } = latest.current;
    const all = toGeoJSON(m).features;
    const features = all
      .filter((f) => f.properties?.id === sel || f.properties?.id === hov)
      .map((f) => ({ ...f, properties: { ...f.properties, role: f.properties?.id === sel ? 'selected' : 'hover' } }));
    src.setData({ type: 'FeatureCollection', features });
  }

  // Données filtrées.
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource(SRC) as GeoJSONSource | undefined;
    if (!map || !src) return;
    src.setData(toGeoJSON(matches));
    syncFocus(map);
  }, [matches]);

  // Survol et sélection.
  useEffect(() => {
    if (mapRef.current) syncFocus(mapRef.current);
  }, [selectedId, hoveredId]);

  // Recentrage demandé depuis la liste.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusNonce || !selectedId) return;
    const match = latest.current.matches.find((m) => m.event.id === selectedId);
    if (!match) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo({
      center: [match.event.lng, match.event.lat],
      zoom: Math.max(map.getZoom(), 8),
      essential: true,
      duration: reduce ? 0 : 1400,
      padding: window.innerWidth >= 900 ? { right: 380, left: 0, top: 0, bottom: 0 } : { bottom: 280, top: 0, left: 0, right: 0 },
    });
  }, [focusNonce, selectedId]);

  // Fond de carte.
  const firstStyle = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (firstStyle.current) {
      firstStyle.current = false;
      return;
    }
    map.setStyle(basemapStyle(basemap));
  }, [basemap]);

  // Relief 3D.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (terrain) {
      map.setTerrain({ source: 'dem', exaggeration: 1.4 });
      map.easeTo({ pitch: 60, duration: 900 });
    } else {
      map.setTerrain(null);
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    }
  }, [terrain]);

  if (failed) {
    return (
      <div className="map-fallback">
        <p>La carte nécessite WebGL, indisponible dans ce navigateur. La liste et le calendrier restent utilisables.</p>
      </div>
    );
  }

  return (
    <div className="race-map">
      <div ref={containerRef} className="race-map-canvas" role="region" aria-label="Carte des courses" />
      <div className="map-tools">
        <div className="map-tool-group">
          <button
            type="button"
            className="map-tool"
            aria-expanded={menuOpen}
            aria-controls="basemap-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <LayersIcon size={16} />
            {BASEMAPS.find((b) => b.id === basemap)?.label}
          </button>
          {menuOpen && (
            <div id="basemap-menu" className="map-menu" role="radiogroup" aria-label="Fond de carte">
              {BASEMAPS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={basemap === b.id}
                  className={basemap === b.id ? 'is-on' : ''}
                  onClick={() => {
                    setBasemap(b.id);
                    setMenuOpen(false);
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className={`map-tool ${terrain ? 'is-on' : ''}`} aria-pressed={terrain} onClick={() => setTerrain((v) => !v)}>
          <MountainIcon size={16} />
          Relief 3D
        </button>
      </div>
      <div className="map-legend" aria-label="Légende : distance du plus long parcours">
        {DISTANCE_BANDS.map((b) => (
          <span key={b.id} className="map-legend-item">
            <span className={`band-swatch band-${b.id}`} aria-hidden="true" />
            {b.short}
          </span>
        ))}
      </div>
    </div>
  );
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
