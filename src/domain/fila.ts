import { differenceInMinutes, parseISO } from 'date-fns';
import type { EntradaFila, Servicio, Turno } from '@/domain/types';
import { toMin } from '@/lib/horas';

/** Regla 4: el número se reinicia cada día. */
export function siguienteNumero(fila: EntradaFila[], fecha: string): number {
  return fila.filter((e) => e.fecha === fecha).reduce((max, e) => Math.max(max, e.numero), 0) + 1;
}

const duracion = (e: EntradaFila, servicios: Servicio[]) => servicios.find((s) => s.id === e.servicioId)?.duracionMin ?? 30;

/** Minutos que le faltan a alguien que está en el sillón. */
export function minutosRestantes(e: EntradaFila, servicios: Servicio[], ahora: string): number {
  if (e.estado !== 'atendiendo' || !e.inicioAt) return 0;
  const transcurridos = Math.max(0, differenceInMinutes(parseISO(ahora), parseISO(e.inicioAt)));
  return Math.max(0, duracion(e, servicios) - transcurridos);
}

export const redondear5 = (min: number): number => Math.round(min / 5) * 5;

export interface ParamsEspera {
  fila: EntradaFila[];
  fecha: string;
  servicios: Servicio[];
  profesionalesActivos: number;
  ahora: string;
  /** Número de ticket: cuenta solo a los que esperan con número menor. Sin él, a todos (alguien que llega ahora). */
  numero?: number;
}

/**
 * Regla 5: (duraciones de los que esperan adelante + minutos restantes de los
 * que están en atención) / profesionales activos, redondeado a 5 min.
 */
export function esperaEstimada(p: ParamsEspera): number {
  const { fila, fecha, servicios, profesionalesActivos, ahora, numero } = p;
  const delDia = fila.filter((e) => e.fecha === fecha);
  const adelante = delDia
    .filter((e) => e.estado === 'espera' && (numero === undefined || e.numero < numero))
    .reduce((acc, e) => acc + duracion(e, servicios), 0);
  const enAtencion = delDia.reduce((acc, e) => acc + minutosRestantes(e, servicios, ahora), 0);
  return redondear5((adelante + enAtencion) / Math.max(1, profesionalesActivos));
}

export function personasAdelante(fila: EntradaFila[], fecha: string, numero: number): number {
  return fila.filter((e) => e.fecha === fecha && e.estado === 'espera' && e.numero < numero).length;
}

export interface ParamsConflicto {
  entrada: EntradaFila;
  profesionalId: string;
  turnos: Turno[];
  servicios: Servicio[];
  fecha: string;
  ahora: string;
}

/**
 * Al llamar a alguien de la fila: ¿el profesional tiene un turno que se pisa
 * con lo que dura esta atención (desde ahora hasta ahora + duración)?
 * Devuelve el primero que choca, o undefined si puede llamar tranquilo.
 */
export function turnoEnConflicto(p: ParamsConflicto): Turno | undefined {
  const ahoraMin = toMin(p.ahora.slice(11, 16));
  const fin = ahoraMin + duracion(p.entrada, p.servicios);
  return p.turnos
    .filter((t) => t.fecha === p.fecha && t.profesionalId === p.profesionalId && (t.estado === 'reservado' || t.estado === 'llego'))
    .filter((t) => {
      const ini = toMin(t.hora);
      const durT = p.servicios.find((s) => s.id === t.servicioId)?.duracionMin ?? 30;
      return ini < fin && ini + durT > ahoraMin;
    })
    .sort((a, b) => toMin(a.hora) - toMin(b.hora))[0];
}

/**
 * Regla 6: primero en espera (por número) cuya preferencia sea ese
 * profesional o ninguna.
 */
export function llamarSiguiente(fila: EntradaFila[], fecha: string, profesionalId: string): EntradaFila | undefined {
  return fila
    .filter(
      (e) =>
        e.fecha === fecha &&
        e.estado === 'espera' &&
        (!e.profesionalPreferidoId || e.profesionalPreferidoId === profesionalId),
    )
    .sort((a, b) => a.numero - b.numero)[0];
}
