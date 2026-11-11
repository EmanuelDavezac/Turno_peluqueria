import type { Bloqueo } from '@/domain/disponibilidad';
import { PLANTILLA_DEFAULT } from '@/domain/recordatorio';
import type { ConfigDia, Excepcion, Profesional, Servicio } from '@/domain/types';
import { supabase } from './client';
import {
  aBloqueosPorFecha, aExcepcion, aProfesionalPublico, aSemana, aServicio,
  type FilaExcepcion, type FilaOcupado, type FilaProfesionalPublica, type FilaSemana, type FilaServicio,
} from './mapeo';

/**
 * Lo que puede leer cualquiera sin iniciar sesión (clave pública): configuración del local,
 * servicios, el equipo sin comisión y los rangos ocupados. Nada de datos de clientes.
 */
export interface DatosPublicos {
  local: { nombre: string; direccion: string };
  plantilla: string;
  semana: ConfigDia[];
  excepciones: Excepcion[];
  servicios: Servicio[];
  profesionales: Profesional[];
}

export async function leerPublico(): Promise<DatosPublicos> {
  const [n, s, e, sv, p] = await Promise.all([
    supabase.from('negocio').select('nombre, direccion, recordatorios').limit(1).maybeSingle(),
    supabase.from('semana').select('dia, modalidad, franjas').order('dia'),
    supabase.from('excepciones').select('id, fecha, modalidad, franjas, motivo').order('fecha'),
    supabase.from('servicios').select('id, nombre, duracion_min, precio').order('nombre'),
    // Mismo orden con el que la base elige profesional al reservar (nombre, id): el horario ofrecido y el asignado coinciden.
    supabase.from('profesionales').select('id, nombre, activo').order('nombre').order('id'),
  ]);
  for (const r of [n, s, e, sv, p]) if (r.error) throw r.error;
  const neg = n.data as { nombre: string; direccion: string; recordatorios: { plantilla?: string } | null } | null;
  return {
    local: { nombre: neg?.nombre ?? '', direccion: neg?.direccion ?? '' },
    plantilla: neg?.recordatorios?.plantilla ?? PLANTILLA_DEFAULT,
    semana: (s.data as FilaSemana[]).map(aSemana),
    excepciones: (e.data as FilaExcepcion[]).map(aExcepcion),
    servicios: (sv.data as FilaServicio[]).map(aServicio),
    profesionales: (p.data as FilaProfesionalPublica[]).map(aProfesionalPublico),
  };
}

/** Rangos ocupados por día (turnos vivos), sin nombres ni teléfonos. */
export async function leerOcupados(desde: string, hasta: string): Promise<Record<string, Bloqueo[]>> {
  const { data, error } = await supabase.rpc('ocupados', { p_desde: desde, p_hasta: hasta });
  if (error) throw error;
  return aBloqueosPorFecha((data ?? []) as FilaOcupado[]);
}

export interface TurnoReservado { id: string; fecha: string; hora: string }

/** La base valida todo (día abierto, horario, superposición, tope por WhatsApp) y asigna el profesional. */
export async function reservarTurno(d: {
  fecha: string; hora: string; servicioId: string; nombre: string; whatsapp: string;
}): Promise<TurnoReservado> {
  const { data, error } = await supabase.rpc('reservar', {
    p_fecha: d.fecha, p_hora: d.hora, p_servicio: d.servicioId, p_nombre: d.nombre, p_whatsapp: d.whatsapp,
  });
  if (error) throw error;
  const r = (data as { turno_id: string; turno_fecha: string; turno_hora: string }[])[0];
  return { id: r.turno_id, fecha: r.turno_fecha, hora: r.turno_hora.slice(0, 5) };
}
