import { PLANTILLA_DEFAULT } from '@/domain/recordatorio';
import { supabase } from './client';

export interface DatosNegocio {
  nombre: string;
  direccion: string;
  /** Tal como está guardado (puede traer claves viejas: se conservan al escribir). */
  recordatorios: Record<string, unknown>;
  /** Nombre de un profesional activo, para el mensaje de ejemplo. */
  profesionalEjemplo: string;
}

export type CambiosNegocio = { nombre?: string; direccion?: string; recordatorios?: Record<string, unknown> };

/** Una escritura que no tocó ninguna fila es un fallo (RLS filtra en silencio): nunca se muestra como éxito. */
const SIN_PERMISO = { code: '42501', message: 'ninguna fila afectada' };

export async function leerNegocio(): Promise<DatosNegocio> {
  const [n, p] = await Promise.all([
    supabase.from('negocio').select('nombre, direccion, recordatorios').limit(1).maybeSingle(),
    supabase.from('profesionales').select('nombre').eq('activo', true).order('nombre').limit(1),
  ]);
  if (n.error) throw n.error;
  if (p.error) throw p.error;
  const d = n.data as { nombre: string; direccion: string; recordatorios: Record<string, unknown> | null } | null;
  return {
    nombre: d?.nombre ?? '',
    direccion: d?.direccion ?? '',
    recordatorios: { h24: true, h2: true, plantilla: PLANTILLA_DEFAULT, ...(d?.recordatorios ?? {}) },
    profesionalEjemplo: (p.data as { nombre: string }[])[0]?.nombre ?? 'Profesional',
  };
}

/** `negocio` tiene una sola fila (id = true). */
export async function guardarNegocio(cambios: CambiosNegocio): Promise<void> {
  const { data, error } = await supabase.from('negocio').update(cambios).eq('id', true).select('id');
  if (error) throw error;
  if (!data?.length) throw SIN_PERMISO;
}

/** Solo el nombre, para la pantalla de ingreso (se puede leer sin sesión). */
export async function leerNombreNegocio(): Promise<string> {
  const { data, error } = await supabase.from('negocio').select('nombre').limit(1).maybeSingle();
  if (error) throw error;
  return (data as { nombre: string } | null)?.nombre ?? '';
}
