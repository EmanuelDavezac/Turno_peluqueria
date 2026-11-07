import type { ConfigDia, DiaSemana, Excepcion, Franja, Modalidad } from '@/domain/types';

/**
 * Contrato de la capa de datos para horarios/modalidad.
 * Fase 1: implementado sobre Zustand + localStorage (data/local).
 * Fase 2: reemplazar por Supabase sin tocar los componentes.
 */
export interface HorariosRepo {
  semana: ConfigDia[];
  excepciones: Excepcion[];
  setDia(dia: DiaSemana, cambios: { modalidad?: Modalidad; franjas?: Franja[] }): void;
  addExcepcion(e: Omit<Excepcion, 'id'>): void;
  removeExcepcion(id: string): void;
}
