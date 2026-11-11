import type { Medio } from '@/domain/caja';
import type { Cliente, Profesional, Servicio, Turno } from '@/domain/types';
import { leerCatalogo } from './catalogo';
import { supabase } from './client';
import { aCliente, aTurno, type FilaTurnoConCliente } from './mapeo';

/** Todo lo que necesita la agenda de un día, leído con la sesión del panel. */
export interface DatosAgenda {
  turnos: Turno[];
  clientes: Cliente[];
  profesionales: Profesional[];
  servicios: Servicio[];
  local: { nombre: string };
  plantilla: string;
}

const COLS_TURNO =
  'id, fecha, hora, profesional_id, servicio_id, cliente_id, estado, origen, duracion_min, clientes(id, nombre, whatsapp, notas)';

/** Una escritura que no tocó ninguna fila es un fallo (RLS filtra en silencio, o el turno ya cambió). */
const SIN_PERMISO = { code: '42501', message: 'ninguna fila afectada' };
const TURNO_CAMBIO = { code: 'TURNO_CAMBIO', message: 'el turno ya cambió de estado' };

export async function leerAgenda(fecha: string): Promise<DatosAgenda> {
  const [t, cat, neg] = await Promise.all([
    supabase.from('turnos').select(COLS_TURNO).eq('fecha', fecha).order('hora'),
    leerCatalogo(),
    supabase.from('negocio').select('nombre, recordatorios').limit(1).maybeSingle(),
  ]);
  if (t.error) throw t.error;
  if (neg.error) throw neg.error;
  const filas = t.data as unknown as FilaTurnoConCliente[];
  const clientes = new Map<string, Cliente>();
  for (const f of filas) if (f.clientes) clientes.set(f.clientes.id, aCliente(f.clientes));
  const n = neg.data as { nombre: string; recordatorios: { plantilla?: string } | null } | null;
  return {
    turnos: filas.map(aTurno),
    clientes: [...clientes.values()],
    profesionales: cat.profesionales,
    servicios: cat.servicios,
    local: { nombre: n?.nombre ?? '' },
    plantilla: n?.recordatorios?.plantilla ?? '',
  };
}

/** Llegó / no vino. Cancelar va por la función de la base, que solo cancela turnos vivos. */
export async function cambiarEstado(id: string, estado: Turno['estado']): Promise<void> {
  if (estado === 'cancelado') {
    const { data, error } = await supabase.rpc('cancelar_turnos', { p_ids: [id] });
    if (error) throw error;
    if (!data) throw TURNO_CAMBIO;
    return;
  }
  const { data, error } = await supabase.from('turnos').update({ estado }).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw SIN_PERMISO;
}

/** Marca atendido y registra el cobro, todo junto en la base. */
export async function cobrarTurno(id: string, medio: Medio, monto: number): Promise<void> {
  const { error } = await supabase.rpc('cobrar_turno', { p_id: id, p_medio: medio, p_monto: monto });
  if (error) throw error;
}

/**
 * Turno cargado a mano desde la agenda (origen "local"). Reutiliza al cliente si el WhatsApp ya existe.
 * Si el horario se pisa con otro turno, la base lo rechaza (23P01).
 */
export async function crearTurnoLocal(d: {
  fecha: string; hora: string; profesionalId: string; servicioId: string; nombre: string; whatsapp: string;
}): Promise<void> {
  const digitos = d.whatsapp.replace(/\D/g, '');
  let clienteId: string | undefined;
  if (digitos) {
    const r = await supabase.from('clientes').select('id').eq('whatsapp_digitos', digitos).limit(1).maybeSingle();
    if (r.error) throw r.error;
    clienteId = (r.data as { id: string } | null)?.id;
  }
  if (!clienteId) {
    const ins = await supabase.from('clientes').insert({ nombre: d.nombre, whatsapp: d.whatsapp }).select('id').single();
    if (ins.error) throw ins.error;
    clienteId = (ins.data as { id: string }).id;
  }
  const { error } = await supabase.from('turnos').insert({
    fecha: d.fecha, hora: d.hora, profesional_id: d.profesionalId, servicio_id: d.servicioId,
    cliente_id: clienteId, origen: 'local',
  });
  if (error) throw error;
}
