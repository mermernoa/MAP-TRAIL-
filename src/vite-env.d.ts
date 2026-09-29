/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STYLE_PLAN?: string;
  readonly VITE_TOPO_TILES?: string;
  readonly VITE_SATELLITE_TILES?: string;
  readonly VITE_DEM_TILES?: string;
  readonly VITE_GLYPHS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
