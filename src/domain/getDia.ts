import { getDay, parseISO } from 'date-fns';
import type { ConfigDia, DiaResuelto, DiaSemana, Excepcion } from './types';

/**
 * Regla 1: la excepción de esa fecha pisa la config del día de semana.
 * `fecha` es ISO "yyyy-MM-dd".
 */
export function getDia(fecha: string, semana: ConfigDia[], excepciones: Excepcion[]): DiaResuelto {
  const excepcion = excepciones.find((e) => e.fecha === fecha);
  if (excepcion) {
    return { fecha, modalidad: excepcion.modalidad, franjas: excepcion.franjas, excepcion };
  }
  const dow = getDay(parseISO(fecha)) as DiaSemana;
  const cfg = semana.find((d) => d.dia === dow);
  return cfg
    ? { fecha, modalidad: cfg.modalidad, franjas: cfg.franjas }
    : { fecha, modalidad: 'cerrado', franjas: [] };
}
