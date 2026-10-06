import { useEffect, useRef, useState } from 'react';
import type { RaceEvent } from '../data/types';
import type { ParsedTrack } from '../lib/gpx';
import maplibregl, { supportsWebGL, type GeoJSONSource, type MapLibreMap } from '../lib/maplibre';
import { ACCENT, INK } from '../lib/colors';
import { basemapStyle, BASEMAPS, LABEL_FONT, type BasemapId } from '../lib/mapStyles';

interface Props {
  event: RaceEvent;
  track: ParsedTrack | null;
  /** Position survolée sur le profil, en km depuis le départ. */
  hoverKm: number | null;
}

function pointAtKm(track: ParsedTrack, km: number): [number, number] {
  const pts = track.points;
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].km < km) lo = mid + 1;
    else hi = mid;
  }
  return [pts[lo].lng, pts[lo].lat];
}

/** Carte du parcours : trace GPX importée, départ, arrivée et position survolée. */
export function CourseMap({ event, track, hoverKm }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>('topo');
  const [styleVersion, setStyleVersion] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    if (!supportsWebGL()) {
      setFailed(true);
      return;
    }
    const map = new maplibregl.Map({
      container: ref.current,
      style: basemapStyle('topo'),
      center: [event.lng, event.lat],
      zoom: 10,
      cooperativeGestures: true,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.on('style.load', () => setStyleVersion((v) => v + 1));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [event.lng, event.lat]);

  const firstStyle = useRef(true);
  useEffect(() => {
    if (firstStyle.current) {
      firstStyle.current = false;
      return;
    }
    mapRef.current?.setStyle(basemapStyle(basemap));
  }, [basemap]);

  // (Re)dessine la trace ou le repère à chaque changement de fond ou de trace.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion) return;
    for (const id of ['cm-hover', 'cm-ends-label', 'cm-ends', 'cm-line', 'cm-casing', 'cm-point']) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of ['cm-track', 'cm-ends', 'cm-hover', 'cm-point']) {
      if (map.getSource(id)) map.removeSource(id);
    }
    if (!track) {
      map.addSource('cm-point', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [event.lng, event.lat] } },
      });
      map.addLayer({
        id: 'cm-point',
        type: 'circle',
        source: 'cm-point',
        paint: { 'circle-radius': 9, 'circle-color': ACCENT, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
      });
      map.jumpTo({ center: [event.lng, event.lat], zoom: 10 });
      return;
    }
    const coords = track.points.map((p) => [p.lng, p.lat]);
    map.addSource('cm-track', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
    });
    map.addLayer({
      id: 'cm-casing',
      type: 'line',
      source: 'cm-track',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.85 },
    });
    map.addLayer({
      id: 'cm-line',
      type: 'line',
      source: 'cm-track',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ACCENT, 'line-width': 3 },
    });
    const first = track.points[0];
    const last = track.points[track.points.length - 1];
    const loop = Math.abs(first.lat - last.lat) + Math.abs(first.lng - last.lng) < 0.002;
    map.addSource('cm-ends', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { label: loop ? 'Départ / arrivée' : 'Départ' }, geometry: { type: 'Point', coordinates: [first.lng, first.lat] } },
          ...(loop
            ? []
            : [{ type: 'Feature' as const, properties: { label: 'Arrivée' }, geometry: { type: 'Point' as const, coordinates: [last.lng, last.lat] } }]),
        ],
      },
    });
    map.addLayer({
      id: 'cm-ends',
      type: 'circle',
      source: 'cm-ends',
      paint: { 'circle-radius': 6, 'circle-color': INK, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
    });
    map.addLayer({
      id: 'cm-ends-label',
      type: 'symbol',
      source: 'cm-ends',
      layout: { 'text-field': ['get', 'label'], 'text-font': LABEL_FONT, 'text-size': 12, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
      paint:
        basemap === 'satellite'
          ? { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.2 }
          : { 'text-color': INK, 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.2 },
    });
    map.addSource('cm-hover', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'cm-hover',
      type: 'circle',
      source: 'cm-hover',
      paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': INK, 'circle-stroke-width': 3 },
    });
    map.fitBounds(track.bounds, { padding: 40, duration: 0 });
  }, [track, styleVersion, basemap, event.lat, event.lng]);

  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource('cm-hover') as GeoJSONSource | undefined;
    if (!src || !track) return;
    src.setData(
      hoverKm == null
        ? { type: 'FeatureCollection', features: [] }
        : { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pointAtKm(track, hoverKm) } },
    );
  }, [hoverKm, track]);

  if (failed) {
    return <div className="map-fallback">La carte nécessite WebGL, indisponible dans ce navigateur.</div>;
  }

  return (
    <div className="course-map">
      <div ref={ref} className="course-map-canvas" role="region" aria-label={`Carte du parcours, ${event.name}`} />
      <div className="course-map-tools segmented segmented-small" role="radiogroup" aria-label="Fond de carte">
        {BASEMAPS.map((b) => (
          <button key={b.id} type="button" role="radio" aria-checked={basemap === b.id} className={basemap === b.id ? 'is-on' : ''} onClick={() => setBasemap(b.id)}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
