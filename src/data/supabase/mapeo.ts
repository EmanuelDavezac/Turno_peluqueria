import type { ConfigDia, DiaSemana, Excepcion, Franja, Modalidad, Profesional, Servicio, Turno } from '@/domain/types';

/**
 * Filas tal como las devuelve la base → tipos del dominio.
 * Sin imports de Supabase: se pueden probar sin entorno.
 */

export interface FilaSemana { dia: number; modalidad: Modalidad; franjas: Franja[] | null }
export interface FilaExcepcion { id: string; fecha: string; modalidad: Modalidad; franjas: Franja[] | null; motivo: string | null }
export interface FilaProfesional { id: string; nombre: string; color: string; comision_pct: number | string; activo: boolean }
export interface FilaServicio { id: string; nombre: string; duracion_min: number; precio: number }
export interface FilaTurno {
  id: string; fecha: string; hora: string; profesional_id: string; servicio_id: string; cliente_id: string;
  estado: Turno['estado']; origen: Turno['origen'];
}

export const aSemana = (f: FilaSemana): ConfigDia => ({ dia: f.dia as DiaSemana, modalidad: f.modalidad, franjas: f.franjas ?? [] });

export const aExcepcion = (f: FilaExcepcion): Excepcion => ({
  id: f.id, fecha: f.fecha, modalidad: f.modalidad, franjas: f.franjas ?? [], motivo: f.motivo ?? undefined,
});

/** `numeric` llega como string en algunas rutas de PostgREST: se normaliza a número. */
export const aProfesional = (f: FilaProfesional): Profesional => ({
  id: f.id, nombre: f.nombre, color: f.color, comisionPct: Number(f.comision_pct), activo: f.activo,
});

export const aServicio = (f: FilaServicio): Servicio => ({
  id: f.id, nombre: f.nombre, duracionMin: f.duracion_min, precio: f.precio,
});

/** `time` llega como "10:00:00"; el dominio usa "10:00". */
export const aTurno = (f: FilaTurno): Turno => ({
  id: f.id, fecha: f.fecha, hora: f.hora.slice(0, 5), profesionalId: f.profesional_id, servicioId: f.servicio_id,
  clienteId: f.cliente_id, estado: f.estado, origen: f.origen,
});

/** Cambios del dominio → columnas de la base (solo las que vienen definidas). */
export function deProfesional(c: Partial<Omit<Profesional, 'id'>>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (c.nombre !== undefined) o.nombre = c.nombre;
  if (c.color !== undefined) o.color = c.color;
  if (c.comisionPct !== undefined) o.comision_pct = c.comisionPct;
  if (c.activo !== undefined) o.activo = c.activo;
  return o;
}

export function deServicio(c: Partial<Omit<Servicio, 'id'>>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (c.nombre !== undefined) o.nombre = c.nombre;
  if (c.duracionMin !== undefined) o.duracion_min = c.duracionMin;
  if (c.precio !== undefined) o.precio = c.precio;
  return o;
}
