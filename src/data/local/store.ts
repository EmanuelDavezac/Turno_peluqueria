import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HorariosRepo } from '@/data/repositories';
import { CLIENTES, PROFESIONALES, SEMANA_DEFAULT, SERVICIOS, generarSeed } from '@/data/seed';
import type {
  Cliente, Cobro, EntradaFila, Excepcion, Profesional, Servicio, Turno,
} from '@/domain/types';
import { hoyReal, uid } from '@/lib/horas';

export type Tema = 'claro' | 'oscuro';

interface Estado extends HorariosRepo {
  profesionales: Profesional[];
  servicios: Servicio[];
  clientes: Cliente[];
  turnos: Turno[];
  fila: EntradaFila[];
  cobros: Cobro[];
  /** Solo demo: fecha simulada de "hoy" (null = fecha real). */
  hoySimulado: string | null;
  tema: Tema;
  /** Cancela turnos (regla 8). La notificación al cliente es simulada. */
  cancelarTurnos(ids: string[]): void;
  setHoySimulado(fecha: string | null): void;
  setTema(t: Tema): void;
  resetDemo(): void;
}

function estadoInicial() {
  const semana = SEMANA_DEFAULT;
  const excepciones: Excepcion[] = [];
  const seed = generarSeed(hoyReal(), semana, excepciones);
  return {
    semana, excepciones,
    profesionales: PROFESIONALES, servicios: SERVICIOS, clientes: CLIENTES,
    turnos: seed.turnos, fila: seed.fila, cobros: seed.cobros,
    hoySimulado: null as string | null,
  };
}

/**
 * Implementación fase 1 (localStorage). En fase 2 los componentes siguen
 * hablando con esta forma de API; solo cambia el origen de los datos.
 */
export const useStore = create<Estado>()(
  persist(
    (set) => ({
      ...estadoInicial(),
      tema: 'claro',

      setDia: (dia, cambios) =>
        set((s) => ({ semana: s.semana.map((d) => (d.dia === dia ? { ...d, ...cambios } : d)) })),

      addExcepcion: (e) =>
        set((s) => ({
          // una sola excepción por fecha: la nueva reemplaza a la anterior
          excepciones: [...s.excepciones.filter((x) => x.fecha !== e.fecha), { ...e, id: uid('ex') }].sort((a, b) =>
            a.fecha.localeCompare(b.fecha),
          ),
        })),

      removeExcepcion: (id) => set((s) => ({ excepciones: s.excepciones.filter((x) => x.id !== id) })),

      cancelarTurnos: (ids) =>
        set((s) => ({
          turnos: s.turnos.map((t) => (ids.includes(t.id) ? { ...t, estado: 'cancelado' as const } : t)),
        })),

      setHoySimulado: (fecha) => set({ hoySimulado: fecha }),
      setTema: (tema) => set({ tema }),
      resetDemo: () => set({ ...estadoInicial() }),
    }),
    { name: 'turnero-pelu-v1' },
  ),
);

/** "Hoy" efectivo: respeta la simulación de la demo. */
export const useHoy = (): string => useStore((s) => s.hoySimulado ?? hoyReal());
