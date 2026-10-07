import type { SkySpecification } from 'maplibre-gl';
import type { MapLibreMap } from './maplibre';
import { DEM_SOURCE } from './mapStyles';

/**
 * Exagération du relief selon le zoom. De loin, le relief réel est écrasé par
 * l'échelle (les Alpes ne font que quelques pixels à l'échelle de la France) :
 * on l'accentue fortement, puis on revient à un rendu presque réaliste de près.
 */
export function exaggerationForZoom(zoom: number): number {
  const value = 1.25 + (11.5 - zoom) * 0.33;
  return Math.round(Math.min(3, Math.max(1.25, value)) * 100) / 100;
}

/** Ciel clair qui se teinte de rose à l'horizon, dans les couleurs de la marque. */
export const SKY: SkySpecification = {
  'sky-color': '#b8d3ea',
  'horizon-color': '#fbe6f3',
  'fog-color': '#f4eef5',
  'sky-horizon-blend': 0.55,
  'horizon-fog-blend': 0.75,
  'fog-ground-blend': 0.22,
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 1, 12, 0],
};

const zoomHandlers = new WeakMap<MapLibreMap, () => void>();

/** Active le relief 3D (source `dem` ajoutée si besoin), le ciel, et l'exagération qui suit le zoom. */
export function enableTerrain(map: MapLibreMap, sourceId = 'dem') {
  if (!map.getSource(sourceId)) map.addSource(sourceId, DEM_SOURCE);
  let current = exaggerationForZoom(map.getZoom());
  map.setTerrain({ source: sourceId, exaggeration: current });
  map.setSky(SKY);
  zoomHandlers.get(map)?.();
  const onZoom = () => {
    const next = exaggerationForZoom(map.getZoom());
    if (Math.abs(next - current) < 0.05) return;
    current = next;
    map.setTerrain({ source: sourceId, exaggeration: next });
  };
  map.on('zoom', onZoom);
  zoomHandlers.set(map, () => map.off('zoom', onZoom));
}

export function disableTerrain(map: MapLibreMap) {
  zoomHandlers.get(map)?.();
  zoomHandlers.delete(map);
  map.setTerrain(null);
}

/** Altitude réelle (sans exagération) du point visé, en mètres, ou null hors relief. */
export function groundAltitude(map: MapLibreMap): number | null {
  const terrain = map.getTerrain();
  if (!terrain) return null;
  const raw = map.queryTerrainElevation(map.getCenter());
  if (raw == null) return null;
  return Math.round(raw / (terrain.exaggeration || 1));
}
