import { getDia } from '@/domain/getDia';
import { permiteTurnos } from '@/domain/modalidad';
import type { ConfigDia, DiaSemana, Excepcion, Modalidad, Turno } from '@/domain/types';
import { getDay, parseISO } from 'date-fns';

const ACTIVOS: Turno['estado'][] = ['reservado', 'llego'];

/**
 * Regla 8: turnos vivos (hoy en adelante) que quedan en un día donde la nueva
 * modalidad ya no admite turnos.
 */
export function turnosAfectadosPorSemana(
  dia: DiaSemana,
  nueva: Modalidad,
  turnos: Turno[],
  semana: ConfigDia[],
  excepciones: Excepcion[],
  hoy: string,
): Turno[] {
  if (permiteTurnos(nueva)) return [];
  return turnos.filter(
    (t) =>
      ACTIVOS.includes(t.estado) &&
      t.fecha >= hoy &&
      getDay(parseISO(t.fecha)) === dia &&
      // si la fecha tiene excepción, la semanal no la gobierna
      !getDia(t.fecha, semana, excepciones).excepcion,
  );
}

/** Turnos vivos de una fecha puntual que chocan con una excepción nueva. */
export function turnosAfectadosPorFecha(fecha: string, nueva: Modalidad, turnos: Turno[]): Turno[] {
  if (permiteTurnos(nueva)) return [];
  return turnos.filter((t) => ACTIVOS.includes(t.estado) && t.fecha === fecha);
}
