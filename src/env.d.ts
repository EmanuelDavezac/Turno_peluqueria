/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "supabase" = datos reales; cualquier otro valor = demo con localStorage. */
  readonly VITE_BACKEND?: string;
  readonly VITE_SUPABASE_URL?: string;
  /** Clave pública (publishable / anon). Nunca la secret ni la service_role. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
