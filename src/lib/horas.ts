import { addDays, format, parseISO } from 'date-fns';
import type { Franja } from '@/domain/types';

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const fromMin = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const ISO = 'yyyy-MM-dd';
export const hoyReal = (): string => format(new Date(), ISO);
/**
 * Instante actual como ISO local. La fecha es la de "hoy" (posiblemente simulado);
 * la hora es la simulada ("HH:mm") si hay, si no la real.
 */
export const ahoraISO = (hoy: string, horaSimulada?: string | null): string =>
  `${hoy}T${horaSimulada ? `${horaSimulada}:00` : format(new Date(), 'HH:mm:ss')}`;
/** Instante actual en hora de Argentina ("yyyy-MM-ddTHH:mm:ss"), sin depender de la zona de la computadora. */
export const ahoraAR = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
    .format(d)
    .replace(' ', 'T');
export const sumarDias = (fecha: string, n: number): string => format(addDays(parseISO(fecha), n), ISO);

/** Franja válida: desde < hasta. */
export const franjaValida = (f: Franja): boolean => !!f.desde && !!f.hasta && toMin(f.desde) < toMin(f.hasta);

/** Todas válidas y sin superponerse entre sí. */
export function franjasValidas(franjas: Franja[]): boolean {
  if (!franjas.every(franjaValida)) return false;
  const ord = [...franjas].sort((a, b) => toMin(a.desde) - toMin(b.desde));
  return ord.every((f, i) => i === 0 || toMin(ord[i - 1].hasta) <= toMin(f.desde));
}

let n = 0;
export const uid = (p = 'id'): string => `${p}_${Date.now().toString(36)}${(n++).toString(36)}`;
