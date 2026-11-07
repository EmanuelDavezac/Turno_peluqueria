import type { DiaSemana, Franja, Modalidad } from './types';

export const MODALIDADES: Modalidad[] = ['turnos', 'llegada', 'mixto', 'cerrado'];

export const MODALIDAD_LABEL: Record<Modalidad, string> = {
  turnos: 'Turnos',
  llegada: 'Llegada',
  mixto: 'Mixto',
  cerrado: 'Cerrado',
};

export const MODALIDAD_DESC: Record<Modalidad, string> = {
  turnos: 'Solo con turno reservado',
  llegada: 'Por orden de llegada',
  mixto: 'Turnos y fila',
  cerrado: 'No abre',
};

/** Clases Tailwind fijas por modalidad (usadas en todo el sistema). */
export const MODALIDAD_CLASES: Record<Modalidad, { badge: string; solid: string; dot: string; border: string }> = {
  turnos: { badge: 'bg-turnos-soft text-turnos', solid: 'bg-turnos text-bg', dot: 'bg-turnos', border: 'border-turnos' },
  llegada: { badge: 'bg-llegada-soft text-llegada', solid: 'bg-llegada text-bg', dot: 'bg-llegada', border: 'border-llegada' },
  mixto: { badge: 'bg-mixto-soft text-mixto', solid: 'bg-mixto text-bg', dot: 'bg-mixto', border: 'border-mixto' },
  cerrado: { badge: 'bg-cerrado-soft text-cerrado', solid: 'bg-cerrado text-bg', dot: 'bg-cerrado', border: 'border-cerrado' },
};

export const DIAS_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;
/** Orden de presentación: lunes a domingo. */
export const DIAS_ORDEN: DiaSemana[] = [1, 2, 3, 4, 5, 6, 0];

export const permiteTurnos = (m: Modalidad) => m === 'turnos' || m === 'mixto';
export const permiteFila = (m: Modalidad) => m === 'llegada' || m === 'mixto';

export function formatFranjas(franjas: Franja[]): string {
  const h = (s: string) => {
    const [hh, mm] = s.split(':');
    return mm === '00' ? `${Number(hh)}` : `${Number(hh)}:${mm}`;
  };
  const partes = franjas.map((f) => `${h(f.desde)} a ${h(f.hasta)}`);
  return partes.join(' y ');
}

/** Texto para el cliente: "Viernes: por orden de llegada, 9 a 12:30 y 16 a 21". */
export function textoCliente(nombreDia: string, modalidad: Modalidad, franjas: Franja[]): string {
  if (modalidad === 'cerrado') return `${nombreDia}: cerrado`;
  const modo =
    modalidad === 'turnos' ? 'con turno' : modalidad === 'llegada' ? 'por orden de llegada' : 'con turno o por orden de llegada';
  return `${nombreDia}: ${modo}, ${formatFranjas(franjas)}`;
}
