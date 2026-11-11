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
  if (x.code === '23503') return 'No se puede hacer: hay turnos o cobros que dependen de esto.';
  if (x.code === '23514' || x.code === '22P02' || x.code === '22007') return 'Hay un dato que no es válido. Revisalo y volvé a intentar.';
  if (x.code === '23505') return 'Ya existe un registro igual.';
  if (x.code === '23P01') return 'Ese horario ya está ocupado por otro turno.';
  if (x.code === 'P0001' && msg === 'turno_no_cobrable') return 'Ese turno ya no se puede cobrar (ya está cobrado o cancelado).';
  if (x.code === 'TURNO_CAMBIO') return 'Ese turno ya cambió de estado. Se actualizó la agenda: revisá y volvé a intentar.';
  return 'Algo salió mal en el servidor. Volvé a intentar en unos minutos.';
}

/**
 * Errores de negocio de `reservar` (llegan como `raise exception '<codigo>'`, SQLSTATE P0001).
 * `refrescar` = lo que el cliente veía estaba desactualizado: conviene volver a pedir horarios y ocupados.
 */
const RESERVA: Record<string, { texto: string; refrescar: boolean }> = {
  nombre_invalido: { texto: 'Escribí tu nombre.', refrescar: false },
  whatsapp_invalido: { texto: 'Escribí un WhatsApp válido (con característica).', refrescar: false },
  horario_pasado: { texto: 'Ese horario ya pasó. Elegí otro.', refrescar: true },
  fecha_fuera_de_rango: { texto: 'Todavía no se pueden sacar turnos para esa fecha.', refrescar: true },
  servicio_inexistente: { texto: 'Ese servicio ya no está disponible. Elegí otro.', refrescar: true },
  dia_cerrado: { texto: 'Ese día el local está cerrado. Elegí otro día.', refrescar: true },
  dia_sin_turnos: { texto: 'Ese día se atiende por orden de llegada, sin turno.', refrescar: true },
  fuera_de_horario: { texto: 'Ese horario ya no está disponible. Elegí otro.', refrescar: true },
  horario_invalido: { texto: 'Ese horario no es válido. Elegí otro.', refrescar: true },
  sin_profesionales: { texto: 'Por ahora no se pueden sacar turnos. Probá más tarde.', refrescar: true },
  horario_ocupado: { texto: 'Alguien acaba de tomar ese horario. Elegí otro.', refrescar: true },
  tope_turnos: { texto: 'Ya tenés el máximo de turnos reservados con ese WhatsApp.', refrescar: false },
};

export function describirErrorReserva(e: unknown): { texto: string; refrescar: boolean } {
  const msg = (e as { message?: string } | null)?.message ?? '';
  const code = codigoDe(e);
  if (code === 'P0001' && RESERVA[msg]) return RESERVA[msg];
  // Cualquier otra cosa (red, sesión…) se explica igual que en el resto de la app.
  return { texto: describirError(e), refrescar: false };
}
