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
 * imagerie satellite. La caméra tourne lentement autour du site, comme un
 * drone, tant que l'en-tête est à l'écran.
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
      // Rotation lente, seulement visible et onglet actif : aucun rendu inutile hors de l'écran.
      let raf = 0;
      let last = 0;
      let speed = 0;
      let visible = true;
      const step = (now: number) => {
        raf = 0;
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
        last = now;
        // Démarrage en douceur jusqu'à 2,4° par seconde.
        speed = Math.min(2.4, speed + dt * 0.8);
        map.jumpTo({ bearing: map.getBearing() + speed * dt });
        schedule();
      };
      const schedule = () => {
        if (!raf && visible && !document.hidden) raf = requestAnimationFrame(step);
      };
      const halt = () => {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      };
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) schedule();
        else halt();
      });
      const onVisibility = () => (document.hidden ? halt() : schedule());
      if (relief && !reduce) {
        map.once('idle', () => {
          observer.observe(container);
          document.addEventListener('visibilitychange', onVisibility);
          schedule();
        });
      }
      map.on('error', (e) => {
        console.warn('[relief]', e.error?.message ?? e);
      });
      return () => {
        halt();
        observer.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
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
