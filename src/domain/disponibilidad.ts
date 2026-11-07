import { permiteTurnos } from '@/domain/modalidad';
import type { DiaResuelto, EntradaFila, Profesional, Servicio, Turno } from '@/domain/types';
import { fromMin, toMin } from '@/lib/horas';

export const PASO_MIN = 30;
export const CUALQUIERA = 'cualquiera';

export interface Slot {
  hora: string;
  /** Profesional asignado. Con "cualquiera", el primero libre. */
  profesionalId: string;
}

/** Intervalo ocupado de un profesional, en minutos desde las 00:00. */
export interface Bloqueo {
  profesionalId: string;
  ini: number;
  fin: number;
}

export interface ParamsSlots {
  dia: DiaResuelto;
  servicio: Servicio;
  /** id de profesional o 'cualquiera'. */
  profesionalId: string;
  profesionales: Profesional[];
  servicios: Servicio[];
  turnos: Turno[];
  /** Fila del local: quien está en el sillón bloquea a su profesional hasta el fin estimado. */
  fila?: EntradaFila[];
  /** Instante actual, ISO local "yyyy-MM-ddTHH:mm[:ss]". Solo importa si `dia.fecha` es hoy. */
  ahora: string;
}

const duracionDe = (servicioId: string, servicios: Servicio[]): number =>
  servicios.find((s) => s.id === servicioId)?.duracionMin ?? PASO_MIN;

/**
 * Todo lo que ocupa a un profesional ese día:
 * - turnos vivos (se ignoran los cancelados);
 * - personas de la fila que están en atención: desde que arrancaron hasta el
 *   fin estimado (inicio + duración del servicio). Es lo que pasa en días mixtos.
 */
export function bloqueosDelDia(fecha: string, turnos: Turno[], fila: EntradaFila[], servicios: Servicio[]): Bloqueo[] {
  const out: Bloqueo[] = [];
  for (const t of turnos) {
    if (t.fecha !== fecha || t.estado === 'cancelado') continue;
    const ini = toMin(t.hora);
    out.push({ profesionalId: t.profesionalId, ini, fin: ini + duracionDe(t.servicioId, servicios) });
  }
  for (const e of fila) {
    if (e.fecha !== fecha || e.estado !== 'atendiendo' || !e.profesionalId || !e.inicioAt) continue;
    const ini = toMin(e.inicioAt.slice(11, 16));
    out.push({ profesionalId: e.profesionalId, ini, fin: ini + duracionDe(e.servicioId, servicios) });
  }
  return out;
}

export const hayChoque = (bloqueos: Bloqueo[], profesionalId: string, ini: number, dur: number): boolean =>
  bloqueos.some((b) => b.profesionalId === profesionalId && ini < b.fin && b.ini < ini + dur);

/** ¿Entra el servicio completo dentro de alguna franja del día? */
export const entraEnFranja = (dia: DiaResuelto, ini: number, dur: number): boolean =>
  dia.franjas.some((f) => ini >= toMin(f.desde) && ini + dur <= toMin(f.hasta));

/**
 * Regla 2 + 3. Horarios cada 30 min dentro de cada franja, con el servicio
 * completo antes del cierre de la franja, sin pisar turnos vivos ni a quien
 * está en el sillón por la fila, y sin horarios pasados si la fecha es hoy.
 */
export function slotsDisponibles(p: ParamsSlots): Slot[] {
  const { dia, servicio, profesionalId, profesionales, servicios, turnos, ahora } = p;
  if (!permiteTurnos(dia.modalidad)) return [];

  const candidatos =
    profesionalId === CUALQUIERA
      ? profesionales.filter((x) => x.activo)
      : profesionales.filter((x) => x.activo && x.id === profesionalId);
  if (!candidatos.length) return [];

  const bloqueos = bloqueosDelDia(dia.fecha, turnos, p.fila ?? [], servicios);
  const esHoy = ahora.slice(0, 10) === dia.fecha;
  const ahoraMin = esHoy ? toMin(ahora.slice(11, 16)) : -1;

  const out: Slot[] = [];
  for (const f of dia.franjas) {
    for (let m = toMin(f.desde); m + servicio.duracionMin <= toMin(f.hasta); m += PASO_MIN) {
      if (esHoy && m <= ahoraMin) continue;
      const prof = candidatos.find((c) => !hayChoque(bloqueos, c.id, m, servicio.duracionMin));
      if (prof) out.push({ hora: fromMin(m), profesionalId: prof.id });
    }
  }
  return out;
}

/**
 * Para el panel: ¿se puede cargar un turno a mano en ese hueco? Igual que
 * `slotsDisponibles` pero sin la restricción de horarios pasados.
 */
export function puedeTomar(p: Omit<ParamsSlots, 'ahora' | 'profesionalId' | 'profesionales'> & { profesionalId: string; hora: string }): boolean {
  if (!permiteTurnos(p.dia.modalidad)) return false;
  const ini = toMin(p.hora);
  const dur = p.servicio.duracionMin;
  if (!entraEnFranja(p.dia, ini, dur)) return false;
  return !hayChoque(bloqueosDelDia(p.dia.fecha, p.turnos, p.fila ?? [], p.servicios), p.profesionalId, ini, dur);
}
