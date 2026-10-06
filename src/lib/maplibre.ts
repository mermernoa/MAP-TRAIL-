import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 charge son worker à côté de son propre module ; une fois empaqueté
// par Vite, on lui indique explicitement l'URL du worker compilé.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);

export default maplibregl;
export type { Map as MapLibreMap, GeoJSONSource, LngLatBoundsLike } from 'maplibre-gl';

let fastWebGL: boolean | null = null;

/**
 * Vrai si WebGL est accéléré par la carte graphique. Sans accélération (pilote
 * bloqué, machine virtuelle, PC sans GPU), le navigateur dessine en logiciel :
 * un relief 3D peut alors occuper le processeur plusieurs secondes et figer la page.
 */
export function hasFastWebGL(): boolean {
  if (fastWebGL != null) return fastWebGL;
  try {
    const canvas = document.createElement('canvas');
    const options = { failIfMajorPerformanceCaveat: true };
    const gl = (canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options)) as WebGLRenderingContext | null;
    if (!gl) return (fastWebGL = false);
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return (fastWebGL = !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer));
  } catch {
    return (fastWebGL = false);
  }
}

/** Vrai si le navigateur sait afficher une carte WebGL. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Crée une carte une fois la nouvelle page affichée, et la détruit sans retarder
 * la page suivante. Créer ou détruire un contexte WebGL peut prendre plusieurs
 * centaines de millisecondes (davantage sans accélération graphique) : fait
 * pendant le changement de page, cela donnait l'impression que le clic ne
 * faisait rien.
 *
 * `init` crée la carte et renvoie sa fonction de nettoyage.
 */
export function initMapAfterPaint(init: () => () => void): () => void {
  let teardown: (() => void) | null = null;
  let cancelled = false;
  let second = 0;
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(() => {
      if (!cancelled) teardown = init();
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(first);
    cancelAnimationFrame(second);
    const done = teardown;
    if (done) setTimeout(done, 0);
  };
}
