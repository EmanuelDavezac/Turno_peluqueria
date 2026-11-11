import type { Cliente, Profesional, Servicio, Turno } from '@/domain/types';
import { leerCatalogo } from './catalogo';
import { supabase } from './client';
import { aCliente, aTurno, type FilaCliente, type FilaTurno } from './mapeo';
import { leerTodo } from './paginar';

export interface ResumenCliente { visitas: number; ultimaVisita?: string }

export interface DatosClientes {
  clientes: Cliente[];
  /** Turnos atendidos (cobrados) por cliente. */
  resumen: Record<string, ResumenCliente>;
  servicios: Servicio[];
  profesionales: Profesional[];
}

const SIN_PERMISO = { code: '42501', message: 'ninguna fila afectada' };
const WHATSAPP_REPETIDO = { code: 'WHATSAPP_REPETIDO', message: 'ya hay un cliente con ese WhatsApp' };

export async function leerClientes(): Promise<DatosClientes> {
  const [filas, atendidos, cat] = await Promise.all([
    leerTodo<FilaCliente>((a, b) =>
      supabase.from('clientes').select('id, nombre, whatsapp, notas').order('nombre').order('id').range(a, b),
    ),
    leerTodo<{ cliente_id: string; fecha: string }>((a, b) =>
      supabase.from('turnos').select('cliente_id, fecha').eq('estado', 'atendido').order('fecha').order('id').range(a, b),
    ),
    leerCatalogo(),
  ]);
  const resumen: Record<string, ResumenCliente> = {};
  for (const t of atendidos) {
    const r = (resumen[t.cliente_id] ??= { visitas: 0 });
    r.visitas++;
    if (!r.ultimaVisita || t.fecha > r.ultimaVisita) r.ultimaVisita = t.fecha;
  }
  return { clientes: filas.map(aCliente), resumen, servicios: cat.servicios, profesionales: cat.profesionales };
}

/** Últimas visitas (turnos atendidos) de un cliente. */
export async function leerHistorial(clienteId: string): Promise<Turno[]> {
  const { data, error } = await supabase
    .from('turnos')
    .select('id, fecha, hora, profesional_id, servicio_id, cliente_id, estado, origen')
    .eq('cliente_id', clienteId)
    .eq('estado', 'atendido')
    .order('fecha', { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data as FilaTurno[]).map(aTurno);
}

export async function crearCliente(d: { nombre: string; whatsapp: string; notas?: string }): Promise<void> {
  const { error } = await supabase.from('clientes').insert({ nombre: d.nombre, whatsapp: d.whatsapp, notas: d.notas || null });
  if (error) throw error.code === '23505' ? WHATSAPP_REPETIDO : error;
}

export async function guardarCliente(id: string, c: { nombre: string; whatsapp: string; notas?: string }): Promise<void> {
  const { data, error } = await supabase
    .from('clientes')
    .update({ nombre: c.nombre, whatsapp: c.whatsapp, notas: c.notas || null })
    .eq('id', id)
    .select('id');
  if (error) throw error.code === '23505' ? WHATSAPP_REPETIDO : error;
  if (!data?.length) throw SIN_PERMISO;
}
