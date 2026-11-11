import { BACKEND } from '@/data/backend';
import { useStore } from '@/data/local/store';
import type { ConfigDia, DiaSemana, Excepcion, Franja, Modalidad, Turno } from '@/domain/types';
import { useEscritor, type EstadoGuardado } from './escritor';
import { listo, useCargar, type Cargable } from './recurso';

export type CambiosDia = { modalidad?: Modalidad; franjas?: Franja[] };

/** Lo que las pantallas usan de horarios, venga de localStorage o de Supabase. */
export interface HorariosVista {
  semana: ConfigDia[];
  excepciones: Excepcion[];
  /** Se ve al instante y se guarda solo (ver `guardado`). */
  setDia(dia: DiaSemana, cambios: CambiosDia): void;
  /** Igual que `setDia` pero espera a que se guarde (y falla si no se pudo). Para cambios que van seguidos de otra acción. */
  setDiaYa(dia: DiaSemana, cambios: CambiosDia): Promise<void>;
  addExcepcion(e: Omit<Excepcion, 'id'>): Promise<void>;
  removeExcepcion(id: string): Promise<void>;
  /** Turnos que podría pisar un cambio de modalidad. En Supabase se piden en el momento. */
  turnos(hoy: string): Promise<Turno[]>;
  cancelarTurnos(ids: string[]): Promise<void>;
  guardado: EstadoGuardado;
  reintentarGuardado(): void;
}

const porFecha = (a: Excepcion, b: Excepcion) => a.fecha.localeCompare(b.fecha);
const api = () => import('./supabase/horarios');

function useHorariosLocal(): Cargable<HorariosVista> {
  const s = useStore();
  return listo({
    semana: s.semana,
    excepciones: s.excepciones,
    setDia: s.setDia,
    setDiaYa: async (dia, cambios) => s.setDia(dia, cambios),
    addExcepcion: async (e) => s.addExcepcion(e),
    removeExcepcion: async (id) => s.removeExcepcion(id),
    turnos: async () => useStore.getState().turnos,
    cancelarTurnos: async (ids) => s.cancelarTurnos(ids),
    guardado: { estado: 'ok' },
    reintentarGuardado: () => {},
  });
}

function useHorariosSupabase(): Cargable<HorariosVista> {
  const { estado, recargar, setDatos } = useCargar(() => api().then((m) => m.leerHorarios()));
  const { escritor, guardado } = useEscritor();

  if (estado.estado === 'cargando') return estado;
  if (estado.estado === 'error') return { estado: 'error', mensaje: estado.mensaje, reintentar: recargar };
  const { semana, excepciones } = estado.datos;

  return listo({
    semana,
    excepciones,
    setDia: (dia, cambios) => {
      setDatos((d) => ({ ...d, semana: d.semana.map((x) => (x.dia === dia ? { ...x, ...cambios } : x)) }));
      escritor.programar(`dia:${dia}`, cambios, async (c) => (await api()).guardarDia(dia, c));
    },
    setDiaYa: async (dia, cambios) => {
      const antes = semana.find((x) => x.dia === dia);
      setDatos((d) => ({ ...d, semana: d.semana.map((x) => (x.dia === dia ? { ...x, ...cambios } : x)) }));
      try {
        await (await api()).guardarDia(dia, cambios);
      } catch (e) {
        // No quedó guardado: la pantalla vuelve a lo que realmente hay en la base.
        if (antes) setDatos((d) => ({ ...d, semana: d.semana.map((x) => (x.dia === dia ? antes : x)) }));
        throw e;
      }
    },
    addExcepcion: async (e) => {
      const nueva = await (await api()).crearExcepcion(e);
      setDatos((d) => ({ ...d, excepciones: [...d.excepciones.filter((x) => x.fecha !== nueva.fecha), nueva].sort(porFecha) }));
    },
    removeExcepcion: async (id) => {
      await (await api()).borrarExcepcion(id);
      setDatos((d) => ({ ...d, excepciones: d.excepciones.filter((x) => x.id !== id) }));
    },
    turnos: async (hoy) => (await api()).turnosVivos(hoy),
    cancelarTurnos: async (ids) => (await api()).cancelarTurnos(ids),
    guardado,
    reintentarGuardado: () => escritor.reintentar(),
  });
}

/** Con `VITE_BACKEND=supabase` trae los datos de la base; si no, usa la demo local. */
export const useHorarios: () => Cargable<HorariosVista> = BACKEND === 'supabase' ? useHorariosSupabase : useHorariosLocal;
