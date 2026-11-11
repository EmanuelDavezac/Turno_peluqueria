/** Forma común de los errores de Supabase/PostgREST (son objetos planos, no `Error`). */
interface ErrorConCodigo {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
}

const RED = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|timeout|timed out|aborted/i;

/** ¿No se pudo llegar al servidor (sin internet, caído, timeout)? */
export function esErrorDeRed(e: unknown): boolean {
  const x = (e ?? {}) as ErrorConCodigo;
  if (x.name === 'AbortError' || x.name === 'TimeoutError') return true;
  if (e instanceof TypeError) return true; // fetch() rechaza con TypeError cuando no hay red
  return !x.code && RED.test(x.message ?? '');
}

/** Código de Postgres/PostgREST (ej. "23503" = clave foránea), si lo hay. */
export const codigoDe = (e: unknown): string | undefined => (e as ErrorConCodigo | null)?.code;

/**
 * Texto para mostrarle al dueño cuando algo falla. Nunca expone mensajes técnicos
 * ni detalles de la base: solo qué pasó y qué hacer.
 */
export function describirError(e: unknown): string {
  if (esErrorDeRed(e)) return 'No hay conexión con el servidor. Revisá tu internet y volvé a intentar.';
  const x = (e ?? {}) as ErrorConCodigo;
  const msg = x.message ?? '';
  if (x.code === '42501' || x.code === 'PGRST301' || x.status === 401 || x.status === 403 || /jwt/i.test(msg)) {
    return 'Tu sesión venció o no tenés permiso para esto. Volvé a iniciar sesión.';
  }
  if (x.code === '23503') return 'No se puede hacer: hay turnos, fila o cobros que dependen de esto.';
  if (x.code === '23514' || x.code === '22P02' || x.code === '22007') return 'Hay un dato que no es válido. Revisalo y volvé a intentar.';
  if (x.code === '23505') return 'Ya existe un registro igual.';
  return 'Algo salió mal en el servidor. Volvé a intentar en unos minutos.';
}
