import { createClient } from '@supabase/supabase-js';

/**
 * ¿Se llegó por el link del mail de "olvidé mi contraseña"? Hay que mirarlo ANTES de
 * crear el cliente: supabase-js procesa el link al crearse, emite PASSWORD_RECOVERY
 * antes de que React se suscriba y borra el hash de la URL.
 */
export const llegoPorRecuperacion = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY (ver .env.example).');
}

const ESPERA_MAX_MS = 10_000;

/** Corta los pedidos colgados: sin esto, una conexión caída dejaría la pantalla cargando para siempre. */
const fetchConTimeout: typeof fetch = (input, init) => {
  const limite = AbortSignal.timeout(ESPERA_MAX_MS);
  return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, limite]) : limite });
};

/** Cliente único. Usa solo la clave pública: lo que puede hacer lo decide RLS. */
export const supabase = createClient(url, key, {
  global: { fetch: fetchConTimeout },
  // Sin reintentos internos (la librería hace 4 intentos con espera): con la conexión caída el error
  // tardaba más de un minuto. Falla rápido y la pantalla ofrece "Reintentar".
  db: { retry: false },
});
