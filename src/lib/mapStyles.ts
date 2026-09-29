import type { StyleSpecification } from 'maplibre-gl';

/**
 * Fonds de carte sans clé d'API. Chaque URL peut être remplacée au build
 * par une variable d'environnement (voir README) pour passer sur un
 * fournisseur commercial (MapTiler, Stadia, IGN…).
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
  overlay?: { tiles: string[]; attribution: string },
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
  if (overlay) {
    style.sources.labels = { type: 'raster', tiles: overlay.tiles, tileSize: 256, maxzoom, attribution: overlay.attribution };
    style.layers.push({ id: 'labels', type: 'raster', source: 'labels' });
  }
  return style;
}

export function basemapStyle(id: BasemapId): string | StyleSpecification {
  switch (id) {
    case 'plan':
      return PLAN_STYLE_URL;
    case 'topo':
      return rasterStyle(
        TOPO_TILES,
        'Carte : © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), données © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        17,
      );
    case 'satellite':
      return rasterStyle([SATELLITE_TILES], 'Imagerie © Esri, Maxar, Earthstar Geographics', 18, {
        tiles: [SATELLITE_LABELS],
        attribution: 'Toponymes © Esri',
      });
  }
}

/** Style satellite simple pour les vues 3D (en-tête des fiches course). */
export function satelliteStyle(): StyleSpecification {
  return rasterStyle([SATELLITE_TILES], 'Imagerie © Esri, Maxar, Earthstar Geographics', 18);
}
