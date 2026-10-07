/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STYLE_PLAN?: string;
  readonly VITE_TOPO_TILES?: string;
  readonly VITE_SATELLITE_TILES?: string;
  readonly VITE_DEM_TILES?: string;
  readonly VITE_GLYPHS_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Adresse de contact (formulaires), si les messages ne passent pas par Supabase. */
  readonly VITE_CONTACT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
