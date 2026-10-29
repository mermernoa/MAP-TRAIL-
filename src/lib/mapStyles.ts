import type { ExpressionSpecification, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';

/**
 * Fonds de carte sans clé d'API. Chaque URL peut être remplacée au build
 * par une variable d'environnement (voir README) pour passer sur un
 * fournisseur commercial (MapTiler, Stadia…). En France, Topo et Satellite
 * prennent les fonds IGN par-dessus le fond mondial.
 */
const env = import.meta.env;

export const GLYPHS_URL: string = env.VITE_GLYPHS_URL ?? 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const LABEL_FONT = ['Noto Sans Bold'];
export const LABEL_FONT_REGULAR = ['Noto Sans Regular'];

const PLAN_STYLE_URL: string = env.VITE_STYLE_PLAN ?? 'https://tiles.openfreemap.org/styles/positron';

const TOPO_TILES: string[] = env.VITE_TOPO_TILES
  ? String(env.VITE_TOPO_TILES).split(',')
  : [
      'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
    ];

const SATELLITE_TILES: string =
  env.VITE_SATELLITE_TILES ??
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const SATELLITE_LABELS: string =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

/**
 * Fonds IGN de la Géoplateforme (gratuits, sans clé, Licence Ouverte Etalab 2.0), posés
 * par-dessus le fond mondial, en France seulement. VITE_IGN_PLAN_TILES et
 * VITE_IGN_PHOTO_TILES les remplacent ; « off » les retire.
 */
const IGN_WMTS = (layer: string, format: string) =>
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=${format}`;
const ignTiles = (value: unknown, fallback: string): string[] | null =>
  value === 'off' ? null : value ? String(value).split(',') : [fallback];
const IGN_PLAN_TILES = ignTiles(env.VITE_IGN_PLAN_TILES, IGN_WMTS('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', 'image/png'));
const IGN_PHOTO_TILES = ignTiles(env.VITE_IGN_PHOTO_TILES, IGN_WMTS('ORTHOIMAGERY.ORTHOPHOTOS', 'image/jpeg'));
const IGN_ATTRIBUTION =
  '© <a href="https://geoservices.ign.fr/">IGN – Géoplateforme</a> (<a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/">Licence Ouverte</a>)';

/**
 * Emprises où l'IGN remplace le fond mondial : métropole et Corse, puis les DROM.
 * Une source par zone, pour ne demander aucune tuile ailleurs.
 */
const IGN_ZONES: { id: string; bounds: [number, number, number, number] }[] = [
  { id: 'metropole', bounds: [-5.3, 41.3, 9.7, 51.2] },
  { id: 'guadeloupe', bounds: [-61.9, 15.8, -60.9, 16.6] },
  { id: 'martinique', bounds: [-61.3, 14.35, -60.75, 14.9] },
  { id: 'guyane', bounds: [-54.7, 2.1, -51.5, 5.85] },
  { id: 'reunion', bounds: [55.18, -21.42, 55.86, -20.85] },
  { id: 'mayotte', bounds: [44.95, -13.05, 45.35, -12.6] },
];

/** L'IGN apparaît en fondu entre les zooms 5,5 et 7 : le globe dézoomé reste celui d'aujourd'hui. */
const IGN_MINZOOM = 5.5;
const IGN_FADE: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], IGN_MINZOOM, 0, 7, 1];

/** Modèle numérique de terrain (Terrarium, AWS Open Data) pour l'ombrage et la 3D. */
export const DEM_SOURCE = {
  type: 'raster-dem' as const,
  tiles: [env.VITE_DEM_TILES ?? 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium' as const,
  tileSize: 256,
  maxzoom: 15,
  attribution: 'Relief : <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles (AWS, Mapzen)</a>',
};

export type BasemapId = 'plan' | 'topo' | 'satellite';

export const BASEMAPS: { id: BasemapId; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'topo', label: 'Topo' },
  { id: 'satellite', label: 'Satellite' },
];

function rasterStyle(
  tiles: string[],
  attribution: string,
  maxzoom: number,
  options: { labels?: { tiles: string[]; attribution: string }; france?: { tiles: string[] | null; maxzoom: number } } = {},
): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      base: { type: 'raster', tiles, tileSize: 256, maxzoom, attribution },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#dfe5dc' } },
      { id: 'base', type: 'raster', source: 'base' },
    ],
  };
  // Au-dessus du fond mondial : l'IGN, zone par zone (là où il n'y a pas de tuile, le fond mondial reste visible).
  const france = options.france;
  if (france?.tiles) {
    for (const zone of IGN_ZONES) {
      const id = `ign-${zone.id}`;
      style.sources[id] = {
        type: 'raster',
        tiles: france.tiles,
        tileSize: 256,
        bounds: zone.bounds,
        minzoom: 5,
        maxzoom: france.maxzoom,
        attribution: IGN_ATTRIBUTION,
      };
      style.layers.push({ id, type: 'raster', source: id, minzoom: IGN_MINZOOM, paint: { 'raster-opacity': IGN_FADE } });
    }
  }
  if (options.labels) {
    style.sources.labels = { type: 'raster', tiles: options.labels.tiles, tileSize: 256, maxzoom, attribution: options.labels.attribution };
    style.layers.push({ id: 'labels', type: 'raster', source: 'labels' });
  }
  return style;
}

export function basemapStyle(id: BasemapId): string | StyleSpecification {
  switch (id) {
    case 'plan':
      return PLAN_STYLE_URL;
    case 'topo':
      // Plan IGN v2 en France, OpenTopoMap ailleurs.
      return rasterStyle(
        TOPO_TILES,
        'Carte : © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), données © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        17,
        { france: { tiles: IGN_PLAN_TILES, maxzoom: 18 } },
      );
    case 'satellite':
      // Photos aériennes IGN en France, Esri ailleurs ; les noms Esri restent par-dessus partout.
      return rasterStyle([SATELLITE_TILES], 'Imagerie © Esri, Maxar, Earthstar Geographics', 18, {
        france: { tiles: IGN_PHOTO_TILES, maxzoom: 19 },
        labels: { tiles: [SATELLITE_LABELS], attribution: 'Toponymes © Esri' },
      });
  }
}

/** Style satellite simple pour les vues 3D (en-tête des fiches course et massif) : photos IGN en France, Esri ailleurs. */
export function satelliteStyle(): StyleSpecification {
  return rasterStyle([SATELLITE_TILES], 'Imagerie © Esri, Maxar, Earthstar Geographics', 18, {
    france: { tiles: IGN_PHOTO_TILES, maxzoom: 19 },
  });
}

/**
 * Le style « Plan » (Positron) est très pâle : on lui donne un peu de couleur
 * au chargement (eau, forêts, parcs, fond), sans toucher aux routes ni aux noms.
 */
export function tintPlan(map: MapLibreMap) {
  for (const layer of map.getStyle().layers) {
    const id = layer.id.toLowerCase();
    try {
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#f1eee9');
      else if (layer.type === 'fill' && /water|ocean|lake|river/.test(id)) map.setPaintProperty(layer.id, 'fill-color', '#a8cbe6');
      else if (layer.type === 'fill' && /wood|forest/.test(id)) map.setPaintProperty(layer.id, 'fill-color', '#c9dfc0');
      else if (layer.type === 'fill' && /park|grass|landcover|nature/.test(id)) map.setPaintProperty(layer.id, 'fill-color', '#d9e8cf');
      else if (layer.type === 'line' && /waterway|river/.test(id)) map.setPaintProperty(layer.id, 'line-color', '#8fb9dd');
    } catch {
      // Couche sans cette propriété : on la laisse telle quelle.
    }
  }
}
