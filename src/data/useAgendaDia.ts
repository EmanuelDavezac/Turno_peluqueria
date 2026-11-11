import { BACKEND } from '@/data/backend';
import { useStore } from '@/data/local/store';
import type { Medio } from '@/domain/caja';
import type { Cliente, Profesional, Servicio, Turno } from '@/domain/types';
import { listo, useCargar, useRefresco, type Cargable } from './recurso';

export interface TurnoNuevo { hora: string; profesionalId: string; servicioId: string; nombre: string; whatsapp: string }

/** Lo que usa la agenda de un día, venga de la demo local o de Supabase. */
export interface AgendaVista {
  profesionales: Profesional[];
  servicios: Servicio[];
  clientes: Cliente[];
  /** Pueden venir turnos de otros días (demo local): la grilla filtra por fecha. */
  turnos: Turno[];
  local: { nombre: string };
  plantilla: string;
  setEstadoTurno(id: string, estado: Turno['estado']): Promise<void>;
  cobrarTurno(id: string, medio: Medio, monto: number): Promise<void>;
  crearTurno(d: TurnoNuevo): Promise<void>;
}

const api = () => import('./supabase/agenda');
const REFRESCO_MS = 30_000;

function useAgendaDiaLocal(fecha: string): Cargable<AgendaVista> {
  const s = useStore();
  return listo({
    profesionales: s.profesionales, servicios: s.servicios, clientes: s.clientes, turnos: s.turnos,
    local: s.local, plantilla: s.recordatorios.plantilla,
    setEstadoTurno: async (id, estado) => s.setEstadoTurno(id, estado),
    cobrarTurno: async (id, medio, monto) => s.cobrarTurno(id, medio, monto),
    crearTurno: async (d) => void s.reservar({ ...d, fecha, origen: 'local' }),
  });
}

function useAgendaDiaSupabase(fecha: string): Cargable<AgendaVista> {
  const { estado, recargar } = useCargar(() => api().then((m) => m.leerAgenda(fecha)));

  // Los clientes reservan por su cuenta: la agenda se actualiza sola, sin tocar nada.
  useRefresco(recargar, REFRESCO_MS);

  if (estado.estado === 'cargando') return estado;
  if (estado.estado === 'error') return { estado: 'error', mensaje: estado.mensaje, reintentar: recargar };
  const d = estado.datos;

  /** Hace el cambio y vuelve a leer el día; si falla, igual se relee (el turno pudo haber cambiado). */
  const conRefresco = async (accion: () => Promise<void>) => {
    try {
      await accion();
    } finally {
      recargar();
    }
  };

  return listo({
    ...d,
    setEstadoTurno: (id, est) => conRefresco(async () => (await api()).cambiarEstado(id, est)),
    cobrarTurno: (id, medio, monto) => conRefresco(async () => (await api()).cobrarTurno(id, medio, monto)),
    crearTurno: (t) => conRefresco(async () => (await api()).crearTurnoLocal({ ...t, fecha })),
  });
}

/** Con `VITE_BACKEND=supabase` trae los turnos del día de la base; si no, usa la demo local. */
export const useAgendaDia: (fecha: string) => Cargable<AgendaVista> = BACKEND === 'supabase' ? useAgendaDiaSupabase : useAgendaDiaLocal;
