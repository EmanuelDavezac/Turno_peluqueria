/**
 * Qué origen de datos usa la app. "local" (default) es la demo con localStorage
 * y PIN; "supabase" usa la base real y el login del panel.
 */
export type Backend = 'local' | 'supabase';

export const BACKEND: Backend = import.meta.env.VITE_BACKEND === 'supabase' ? 'supabase' : 'local';
