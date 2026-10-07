import { useEffect, useRef, useState } from 'react';
import type { ExpressionSpecification } from 'maplibre-gl';
import type { RaceEvent } from '../data/types';
import type { ParsedTrack } from '../lib/gpx';
import maplibregl, { hasFastWebGL, initMapAfterPaint, supportsWebGL, type GeoJSONSource, type MapLibreMap } from '../lib/maplibre';
import { ACCENT, INK } from '../lib/colors';
import { basemapStyle, BASEMAPS, LABEL_FONT, type BasemapId } from '../lib/mapStyles';
import { MapExplorer } from '../lib/explore';
import { elevationAtKm, orbit, positionAtKm, TrackFlyover } from '../lib/flyover';
import { disableTerrain, enableTerrain, groundAltitude } from '../lib/terrain3d';
import { ExplorePad } from './ExplorePad';
import { MountainIcon, OrbitIcon, PauseIcon, PlayIcon } from './Icons';
import { fmtKm, fmtM } from './bits';

interface Props {
  event: RaceEvent;
  track: ParsedTrack | null;
  /** Position survolée sur le profil, en km depuis le départ. */
  hoverKm: number | null;
  /** Position du survol 3D, en km, ou null à l'arrêt (pour le profil). */
  onFlyKm?: (km: number | null) => void;
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

/** Trace parcourue en encre, reste du parcours en rose. */
function progressGradient(fraction: number) {
  return ['step', ['line-progress'], INK, Math.min(1, Math.max(0, fraction)), ACCENT] as ExpressionSpecification;
}

const EMPTY = { type: 'FeatureCollection' as const, features: [] };

/** Carte du parcours : trace GPX, départ, arrivée, position survolée ; relief 3D, survol et exploration. */
export function CourseMap({ event, track, hoverKm, onFlyKm }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>('topo');
  const [styleVersion, setStyleVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const [fastGpu] = useState(() => supportsWebGL() && hasFastWebGL());
  const [terrain, setTerrain] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [flyKm, setFlyKm] = useState<number | null>(null);
  const [view, setView] = useState({ bearing: 0, pitch: 0, altitude: null as number | null });
  const [wheelHint, setWheelHint] = useState(false);
  const explorerRef = useRef<MapExplorer | null>(null);
  const flyoverRef = useRef<TrackFlyover | null>(null);
  const stopOrbitRef = useRef<(() => void) | null>(null);
  const playAfterTerrain = useRef(false);
  const latest = useRef({ terrain, onFlyKm });
  latest.current = { terrain, onFlyKm };

  useEffect(() => {
    if (!ref.current) return;
    if (!supportsWebGL()) {
      setFailed(true);
      return;
    }
    const container = ref.current;
    return initMapAfterPaint(() => {
    const map = new maplibregl.Map({
      container,
      style: basemapStyle((appliedStyle.current = basemapRef.current)),
      center: [event.lng, event.lat],
      zoom: 10,
      maxPitch: 85,
      cooperativeGestures: true,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // Plein écran sur le bloc entier : les commandes 3D restent visibles.
    map.addControl(new maplibregl.FullscreenControl({ container: rootRef.current ?? undefined }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.on('style.load', () => {
      if (latest.current.terrain) enableTerrain(map);
      setStyleVersion((v) => v + 1);
    });
    let pending = 0;
    const report = () => {
      if (pending || !latest.current.terrain) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        setView({ bearing: map.getBearing(), pitch: map.getPitch(), altitude: groundAltitude(map) });
      });
    };
    map.on('move', report);
    map.on('idle', report);
    let hintTimer = 0;
    explorerRef.current = new MapExplorer(map, {
      contained: true,
      // La main reprend la caméra : le survol et le tour d'horizon s'arrêtent.
      onChange: () => {
        flyoverRef.current?.pause();
        stopOrbitRef.current?.();
      },
      onWheelIgnored: () => {
        setWheelHint(true);
        clearTimeout(hintTimer);
        hintTimer = window.setTimeout(() => setWheelHint(false), 1600);
      },
    });
    mapRef.current = map;
    return () => {
      cancelAnimationFrame(pending);
      clearTimeout(hintTimer);
      explorerRef.current?.destroy();
      explorerRef.current = null;
      if (mapRef.current === map) mapRef.current = null;
      map.remove();
    };
    });
  }, [event.lng, event.lat]);

  // Fond choisi, lu à la création de la carte (qui peut suivre un changement de fond).
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  const appliedStyle = useRef<BasemapId>(basemap);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedStyle.current === basemap) return;
    appliedStyle.current = basemap;
    map.setStyle(basemapStyle(basemap));
  }, [basemap]);

  // (Re)dessine la trace ou le repère à chaque changement de fond ou de trace.
  const framed = useRef<ParsedTrack | null | undefined>(undefined);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion) return;
    for (const id of ['cm-runner', 'cm-hover', 'cm-ends-label', 'cm-ends', 'cm-line', 'cm-casing', 'cm-point']) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of ['cm-track', 'cm-ends', 'cm-hover', 'cm-runner', 'cm-point']) {
      if (map.getSource(id)) map.removeSource(id);
    }
    // Recadrage seulement quand la trace change, pas à chaque changement de fond.
    const reframe = framed.current !== track;
    framed.current = track;
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
      if (reframe) map.jumpTo({ center: [event.lng, event.lat], zoom: 10 });
      return;
    }
    const coords = track.points.map((p) => [p.lng, p.lat]);
    map.addSource('cm-track', {
      type: 'geojson',
      lineMetrics: true,
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
    });
    map.addLayer({
      id: 'cm-casing',
      type: 'line',
      source: 'cm-track',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.85 },
    });
    const fly = flyoverRef.current;
    map.addLayer({
      id: 'cm-line',
      type: 'line',
      source: 'cm-track',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-width': 3, 'line-gradient': progressGradient(fly && fly.km > 0 ? fly.km / fly.distanceKm : 0) },
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
    map.addSource('cm-hover', { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: 'cm-hover',
      type: 'circle',
      source: 'cm-hover',
      paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': INK, 'circle-stroke-width': 3 },
    });
    map.addSource('cm-runner', {
      type: 'geojson',
      data: fly && fly.km > 0 ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: positionAtKm(track.points, fly.km) } } : EMPTY,
    });
    map.addLayer({
      id: 'cm-runner',
      type: 'circle',
      source: 'cm-runner',
      paint: { 'circle-radius': 7, 'circle-color': INK, 'circle-stroke-color': ACCENT, 'circle-stroke-width': 3.5, 'circle-pitch-alignment': 'map' },
    });
    if (reframe && !latest.current.terrain) map.fitBounds(track.bounds, { padding: 40, duration: 0 });
  }, [track, styleVersion, basemap, event.lat, event.lng]);

  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource('cm-hover') as GeoJSONSource | undefined;
    if (!src || !track) return;
    src.setData(
      hoverKm == null
        ? EMPTY
        : { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pointAtKm(track, hoverKm) } },
    );
  }, [hoverKm, track]);

  // Survol du parcours : un moteur par trace.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !track || !styleVersion) return;
    let lastReport = 0;
    const fly = new TrackFlyover(map, track, {
      onKm: (km) => {
        // Trace et coureur à chaque image ; l'interface, une dizaine de fois par seconde.
        if (map.getLayer('cm-line')) map.setPaintProperty('cm-line', 'line-gradient', progressGradient(km / fly.distanceKm));
        (map.getSource('cm-runner') as GeoJSONSource | undefined)?.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: positionAtKm(track.points, km) },
        });
        const now = performance.now();
        if (now - lastReport > 80 || km >= fly.distanceKm || km === 0) {
          lastReport = now;
          setFlyKm(km);
          latest.current.onFlyKm?.(km);
        }
      },
      onPlayingChange: setPlaying,
    });
    flyoverRef.current = fly;
    return () => {
      fly.destroy();
      if (flyoverRef.current === fly) flyoverRef.current = null;
      setPlaying(false);
      setFlyKm(null);
      latest.current.onFlyKm?.(null);
    };
    // Le moteur suit la trace ; un changement de fond ne l'interrompt pas.
  }, [track, styleVersion > 0]);

  // Relief 3D et exploration.
  useEffect(() => {
    const map = mapRef.current;
    const explorer = explorerRef.current;
    if (!map || !explorer) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (terrain) {
      if (map.isStyleLoaded()) enableTerrain(map);
      explorer.enable();
      if (playAfterTerrain.current && flyoverRef.current) {
        playAfterTerrain.current = false;
        flyoverRef.current.play();
      } else if (track) {
        map.fitBounds(track.bounds, { padding: 50, pitch: 62, bearing: map.getBearing() || -20, duration: reduce ? 0 : 1600 });
      } else {
        map.easeTo({ center: [event.lng, event.lat], zoom: 12.4, pitch: 70, bearing: -20, duration: reduce ? 0 : 1600 });
      }
      setView({ bearing: map.getBearing(), pitch: map.getPitch(), altitude: groundAltitude(map) });
    } else {
      flyoverRef.current?.pause();
      stopOrbitRef.current?.();
      explorer.disable();
      if (map.getTerrain()) disableTerrain(map);
      if (track) map.fitBounds(track.bounds, { padding: 40, pitch: 0, bearing: 0, duration: reduce ? 0 : 900 });
      else map.easeTo({ pitch: 0, bearing: 0, duration: reduce ? 0 : 900 });
    }
  }, [terrain]);

  // Arrêt du tour d'horizon en quittant la page ou la 3D.
  useEffect(() => {
    return () => stopOrbitRef.current?.();
  }, []);

  const toggleFlyover = () => {
    const fly = flyoverRef.current;
    if (!fly) return;
    if (fly.playing) {
      fly.pause();
      return;
    }
    stopOrbitRef.current?.();
    if (fastGpu && !terrain) {
      playAfterTerrain.current = true;
      setTerrain(true);
    } else {
      fly.play();
    }
  };

  const toggleOrbit = () => {
    const map = mapRef.current;
    if (!map) return;
    if (stopOrbitRef.current) {
      stopOrbitRef.current();
      return;
    }
    const stop = orbit(map);
    stopOrbitRef.current = () => {
      stop();
      stopOrbitRef.current = null;
      setPlaying(false);
    };
    setPlaying(true);
  };

  if (failed) {
    return <div className="map-fallback">La carte nécessite WebGL, indisponible dans ce navigateur.</div>;
  }

  const total = track?.distanceKm ?? 0;
  const shownKm = flyKm ?? 0;
  const altitude = track ? elevationAtKm(track.points, shownKm) : null;

  return (
    <div ref={rootRef} className={`course-map ${terrain ? 'is-3d' : ''}`}>
      <div ref={ref} className="course-map-canvas" role="region" aria-label={`Carte du parcours, ${event.name}`} />
      <div className="course-map-tools">
        <div className="segmented segmented-small" role="radiogroup" aria-label="Fond de carte">
          {BASEMAPS.map((b) => (
            <button key={b.id} type="button" role="radio" aria-checked={basemap === b.id} className={basemap === b.id ? 'is-on' : ''} onClick={() => setBasemap(b.id)}>
              {b.label}
            </button>
          ))}
        </div>
        {fastGpu && (
          <button type="button" className={`map-tool ${terrain ? 'is-on' : ''}`} aria-pressed={terrain} onClick={() => setTerrain((v) => !v)}>
            <MountainIcon size={16} />
            3D
          </button>
        )}
      </div>

      {terrain && <ExplorePad explorer={explorerRef.current} bearing={view.bearing} pitch={view.pitch} altitude={view.altitude} helpKey="parcours" compact contained autoHelp={!playAfterTerrain.current && !playing} />}

      {track ? (
        <div className="flyover-bar">
          <button type="button" className="flyover-play" onClick={toggleFlyover} aria-label={playing ? 'Mettre le survol en pause' : 'Survoler le parcours'}>
            {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
            {!playing && flyKm == null && <span>Survoler le parcours</span>}
          </button>
          {flyKm != null && (
            <>
              <input
                type="range"
                className="flyover-range"
                min={0}
                max={total}
                step={total / 500}
                value={shownKm}
                onChange={(e) => flyoverRef.current?.seek(Number(e.target.value))}
                aria-label="Position du survol"
                aria-valuetext={`${fmtKm(shownKm)} sur ${fmtKm(total)}`}
                style={{ '--progress': `${(shownKm / Math.max(total, 0.001)) * 100}%` } as React.CSSProperties}
              />
              <span className="flyover-readout">
                <strong>{fmtKm(shownKm)}</strong>
                {altitude != null && <span>{fmtM(altitude)}</span>}
              </span>
            </>
          )}
        </div>
      ) : (
        terrain && (
          <div className="flyover-bar">
            <button type="button" className="flyover-play" onClick={toggleOrbit} aria-pressed={playing}>
              {playing ? <PauseIcon size={18} /> : <OrbitIcon size={18} />}
              <span>Tour d’horizon</span>
            </button>
          </div>
        )
      )}

      {wheelHint && (
        <p className="course-map-hint" role="status">
          Cliquez dans la carte pour l’explorer au trackpad ou à la molette
        </p>
      )}
    </div>
  );
}
