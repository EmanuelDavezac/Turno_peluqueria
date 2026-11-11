import type { Cobro, Profesional, Servicio } from '@/domain/types';
import { leerCatalogo } from './catalogo';
import { supabase } from './client';
import { aCobro, type FilaCobro } from './mapeo';
import { leerTodo } from './paginar';

const COLS_COBRO = 'id, fecha, hora, profesional_id, servicio_id, cliente_nombre, monto, medio, origen';

export interface DatosCaja {
  cobros: Cobro[];
  cerrada: boolean;
  servicios: Servicio[];
  profesionales: Profesional[];
}

/** Cobros de un día y si la caja ya está cerrada. */
export async function leerCaja(fecha: string): Promise<DatosCaja> {
  const [cobros, cierre, cat] = await Promise.all([
    leerTodo<FilaCobro>((a, b) =>
      supabase.from('cobros').select(COLS_COBRO).eq('fecha', fecha).order('hora').order('id').range(a, b),
    ),
    supabase.from('cajas_cerradas').select('fecha').eq('fecha', fecha).maybeSingle(),
    leerCatalogo(),
  ]);
  if (cierre.error) throw cierre.error;
  return { cobros: cobros.map(aCobro), cerrada: !!cierre.data, servicios: cat.servicios, profesionales: cat.profesionales };
}

/** Cierra la caja del día. Si ya estaba cerrada, no es un error. */
export async function cerrarCaja(fecha: string): Promise<void> {
  const { error } = await supabase.from('cajas_cerradas').insert({ fecha });
  if (error && error.code !== '23505') throw error;
}

export interface DatosReportes {
  cobros: Cobro[];
  servicios: Servicio[];
  profesionales: Profesional[];
}

/** Cobros de un rango de fechas (inclusive) para los reportes. */
export async function leerCobros(desde: string, hasta: string): Promise<DatosReportes> {
  const [cobros, cat] = await Promise.all([
    leerTodo<FilaCobro>((a, b) =>
      supabase.from('cobros').select(COLS_COBRO).gte('fecha', desde).lte('fecha', hasta).order('fecha').order('id').range(a, b),
    ),
    leerCatalogo(),
  ]);
  return { cobros: cobros.map(aCobro), servicios: cat.servicios, profesionales: cat.profesionales };
}
