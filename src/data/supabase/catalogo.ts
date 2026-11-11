import type { Profesional, Servicio } from '@/domain/types';
import { supabase } from './client';
import {
  aProfesional, aServicio, deProfesional, deServicio,
  type FilaProfesional, type FilaServicio,
} from './mapeo';

const COLS_PROFESIONAL = 'id, nombre, color, comision_pct, activo';
const COLS_SERVICIO = 'id, nombre, duracion_min, precio';

/** Una escritura que no tocó ninguna fila es un fallo (RLS filtra en silencio): nunca se muestra como éxito. */
const SIN_PERMISO = { code: '42501', message: 'ninguna fila afectada' };

export async function leerCatalogo(): Promise<{ profesionales: Profesional[]; servicios: Servicio[] }> {
  const [p, s] = await Promise.all([
    supabase.from('profesionales').select(COLS_PROFESIONAL).order('nombre'),
    supabase.from('servicios').select(COLS_SERVICIO).order('nombre'),
  ]);
  if (p.error) throw p.error;
  if (s.error) throw s.error;
  return {
    profesionales: (p.data as FilaProfesional[]).map(aProfesional),
    servicios: (s.data as FilaServicio[]).map(aServicio),
  };
}

export async function crearProfesional(d: Omit<Profesional, 'id'>): Promise<Profesional> {
  const { data, error } = await supabase.from('profesionales').insert(deProfesional(d)).select(COLS_PROFESIONAL).single();
  if (error) throw error;
  return aProfesional(data as FilaProfesional);
}

export async function guardarProfesional(id: string, cambios: Partial<Omit<Profesional, 'id'>>): Promise<void> {
  const { data, error } = await supabase.from('profesionales').update(deProfesional(cambios)).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw SIN_PERMISO;
}

export async function crearServicio(d: Omit<Servicio, 'id'>): Promise<Servicio> {
  const { data, error } = await supabase.from('servicios').insert(deServicio(d)).select(COLS_SERVICIO).single();
  if (error) throw error;
  return aServicio(data as FilaServicio);
}

export async function guardarServicio(id: string, cambios: Partial<Omit<Servicio, 'id'>>): Promise<void> {
  const { data, error } = await supabase.from('servicios').update(deServicio(cambios)).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw SIN_PERMISO;
}

/** Falla con `23503` si el servicio tiene turnos, fila o cobros: la base es quien lo protege. */
export async function borrarServicio(id: string): Promise<void> {
  const { data, error } = await supabase.from('servicios').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw SIN_PERMISO;
}
