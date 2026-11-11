import type { ConfigDia, DiaSemana, Excepcion, Franja, Modalidad, Turno } from '@/domain/types';
import { supabase } from './client';
import { aExcepcion, aSemana, aTurno, type FilaExcepcion, type FilaSemana, type FilaTurno } from './mapeo';

/** Una escritura que no tocó ninguna fila es un fallo (RLS filtra en silencio): nunca se muestra como éxito. */
const SIN_PERMISO = { code: '42501', message: 'ninguna fila afectada' };

export async function leerHorarios(): Promise<{ semana: ConfigDia[]; excepciones: Excepcion[] }> {
  const [s, e] = await Promise.all([
    supabase.from('semana').select('dia, modalidad, franjas').order('dia'),
    supabase.from('excepciones').select('id, fecha, modalidad, franjas, motivo').order('fecha'),
  ]);
  if (s.error) throw s.error;
  if (e.error) throw e.error;
  return {
    semana: (s.data as FilaSemana[]).map(aSemana),
    excepciones: (e.data as FilaExcepcion[]).map(aExcepcion),
  };
}

export async function guardarDia(dia: DiaSemana, cambios: { modalidad?: Modalidad; franjas?: Franja[] }): Promise<void> {
  const { data, error } = await supabase.from('semana').update(cambios).eq('dia', dia).select('dia');
  if (error) throw error;
  if (!data?.length) throw SIN_PERMISO;
}

/** Una sola excepción por fecha: la nueva reemplaza a la anterior (igual que en el modo local). */
export async function crearExcepcion(e: Omit<Excepcion, 'id'>): Promise<Excepcion> {
  const { data, error } = await supabase
    .from('excepciones')
    .upsert({ fecha: e.fecha, modalidad: e.modalidad, franjas: e.franjas, motivo: e.motivo ?? null }, { onConflict: 'fecha' })
    .select('id, fecha, modalidad, franjas, motivo')
    .single();
  if (error) throw error;
  return aExcepcion(data as FilaExcepcion);
}

export async function borrarExcepcion(id: string): Promise<void> {
  const { data, error } = await supabase.from('excepciones').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw SIN_PERMISO;
}

/** Turnos vivos de hoy en adelante: los que podría pisar un cambio de modalidad (regla 8). */
export async function turnosVivos(hoy: string): Promise<Turno[]> {
  const { data, error } = await supabase
    .from('turnos')
    .select('id, fecha, hora, profesional_id, servicio_id, cliente_id, estado, origen')
    .gte('fecha', hoy)
    .in('estado', ['reservado', 'llego']);
  if (error) throw error;
  return (data as FilaTurno[]).map(aTurno);
}

export async function cancelarTurnos(ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('cancelar_turnos', { p_ids: ids });
  if (error) throw error;
}
