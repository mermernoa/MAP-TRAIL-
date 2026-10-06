import { useEffect, useRef, useState } from 'react';
import type { ParsedTrack } from '../lib/gpx';
import maplibregl, { hasFastWebGL, initMapAfterPaint, supportsWebGL, type MapLibreMap } from '../lib/maplibre';
import { DEM_SOURCE, satelliteStyle } from '../lib/mapStyles';

interface Props {
  lat: number;
  lng: number;
  track: ParsedTrack | null;
}

/**
 * Image de fond d'une fiche course : le relief réel du lieu, en 3D, sous
 * imagerie satellite. Un court panoramique au chargement, puis la vue se fige.
 */
export function TerrainHero({ lat, lng, track }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    if (!supportsWebGL()) {
      setFailed(true);
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Sans accélération graphique : vue satellite à plat, dessinée une fois.
    const relief = hasFastWebGL();
    const container = ref.current;
    return initMapAfterPaint(() => {
      const map = new maplibregl.Map({
        container,
        style: satelliteStyle(),
        center: [lng, lat],
        zoom: relief ? 11.4 : 12,
        pitch: relief ? 64 : 0,
        bearing: relief ? -25 : 0,
        interactive: false,
        attributionControl: false,
        maxPitch: 80,
        // Image de fond : une résolution un peu réduite allège nettement le relief 3D sur les grands écrans.
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      });
      // En haut à droite : l'attribution ne recouvre pas le titre de la course.
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
      mapRef.current = map;
      map.on('load', () => {
        if (!relief) {
          setReady(true);
          return;
        }
        map.addSource('dem', DEM_SOURCE);
        map.setTerrain({ source: 'dem', exaggeration: 1.5 });
        map.setSky({
          'sky-color': '#9fc3d8',
          'horizon-color': '#e8eef0',
          'fog-color': '#dfe7e6',
          'sky-horizon-blend': 0.6,
          'horizon-fog-blend': 0.6,
          'fog-ground-blend': 0.4,
        });
        setReady(true);
      });
      // Un court panoramique à l'arrivée, puis la vue se fige : pas de rendu continu.
      map.once('idle', () => {
        if (relief && !reduce) map.easeTo({ bearing: 0, duration: 8000, easing: (t) => 1 - (1 - t) ** 2 });
      });
      map.on('error', (e) => {
        console.warn('[relief]', e.error?.message ?? e);
      });
      return () => {
        if (mapRef.current === map) mapRef.current = null;
        map.remove();
      };
    });
  }, [lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const id = 'hero-track';
    if (map.getLayer(`${id}-line`)) map.removeLayer(`${id}-line`);
    if (map.getLayer(`${id}-casing`)) map.removeLayer(`${id}-casing`);
    if (map.getSource(id)) map.removeSource(id);
    if (!track) return;
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: track.points.map((p) => [p.lng, p.lat]) },
      },
    });
    map.addLayer({
      id: `${id}-casing`,
      type: 'line',
      source: id,
      paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.9 },
      layout: { 'line-join': 'round', 'line-cap': 'round' },
    });
    map.addLayer({
      id: `${id}-line`,
      type: 'line',
      source: id,
      paint: { 'line-color': '#fe66c4', 'line-width': 2.5 },
      layout: { 'line-join': 'round', 'line-cap': 'round' },
    });
    const relief = hasFastWebGL();
    map.fitBounds(track.bounds, { padding: 60, pitch: relief ? 58 : 0, bearing: relief ? -20 : 0, duration: 0 });
  }, [track, ready]);

  return (
    <div className={`terrain-hero ${ready ? 'is-ready' : ''} ${failed ? 'is-fallback' : ''}`} aria-hidden="true">
      <div ref={ref} className="terrain-hero-canvas" />
    </div>
  );
}
