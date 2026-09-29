import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 charge son worker à côté de son propre module ; une fois empaqueté
// par Vite, on lui indique explicitement l'URL du worker compilé.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);

export default maplibregl;
export type { Map as MapLibreMap, GeoJSONSource, LngLatBoundsLike } from 'maplibre-gl';

/** Vrai si le navigateur sait afficher une carte WebGL. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
