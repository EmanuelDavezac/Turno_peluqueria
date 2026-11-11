import { useEffect, useState } from 'react';
import { BACKEND } from '@/data/backend';
import { useAhora, useHoy, useStore } from '@/data/local/store';
import { bloqueosDelDia, type Bloqueo } from '@/domain/disponibilidad';
import type { ConfigDia, Excepcion, Profesional, Servicio, Turno } from '@/domain/types';
import { ahoraAR, sumarDias } from '@/lib/horas';
import { listo, useCargar, type Cargable } from './recurso';

export const DIAS_VISIBLES = 14;

export interface ReservaPedida {
  fecha: string; hora: string; profesionalId: string; servicioId: string; nombre: string; whatsapp: string;
}

/** Lo que usa la página pública de reservas, venga de la demo local o de Supabase. */
export interface ReservasVista {
  hoy: string;
  /** "yyyy-MM-ddTHH:mm:ss" */
  ahora: string;
  local: { nombre: string; direccion: string };
  plantilla: string;
  semana: ConfigDia[];
  excepciones: Excepcion[];
  servicios: Servicio[];
  profesionales: Profesional[];
  /** Lo que ya está ocupado ese día (sin datos personales). */
  bloqueosDe(fecha: string): Bloqueo[];
  /** Vuelve a pedir horarios y ocupados: lo que se ve puede estar desactualizado. */
  refrescar(): Promise<void>;
  /** Falla con el error de la base (`dia_cerrado`, `horario_ocupado`…); ver `describirErrorReserva`. */
  reservar(d: ReservaPedida): Promise<Turno>;
}

const api = () => import('./supabase/publico');

function useReservasLocal(): Cargable<ReservasVista> {
  const s = useStore();
  const hoy = useHoy();
  const ahora = useAhora();
  return listo({
    hoy, ahora,
    local: s.local,
    plantilla: s.recordatorios.plantilla,
    semana: s.semana, excepciones: s.excepciones, servicios: s.servicios, profesionales: s.profesionales,
    bloqueosDe: (fecha) => bloqueosDelDia(fecha, s.turnos, s.servicios),
    refrescar: async () => {},
    reservar: async (d) => s.reservar(d),
  });
}

/** Reloj de Argentina que avanza solo (la base es la que decide; esto es para ocultar horarios pasados). */
function useAhoraAR(): string {
  const [ahora, setAhora] = useState(ahoraAR);
  useEffect(() => {
    const id = window.setInterval(() => setAhora(ahoraAR()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return ahora;
}

function useReservasSupabase(): Cargable<ReservasVista> {
  const ahora = useAhoraAR();
  const hoy = ahora.slice(0, 10);
  const { estado, recargar, setDatos } = useCargar(async () => {
    const m = await api();
    const [base, ocupados] = await Promise.all([m.leerPublico(), m.leerOcupados(hoy, sumarDias(hoy, DIAS_VISIBLES - 1))]);
    return { ...base, ocupados };
  });

  if (estado.estado === 'cargando') return estado;
  if (estado.estado === 'error') return { estado: 'error', mensaje: estado.mensaje, reintentar: recargar };
  const { ocupados, ...base } = estado.datos;

  const refrescar = async () => {
    const m = await api();
    const [nueva, oc] = await Promise.all([m.leerPublico(), m.leerOcupados(hoy, sumarDias(hoy, DIAS_VISIBLES - 1))]);
    setDatos(() => ({ ...nueva, ocupados: oc }));
  };

  return listo({
    hoy, ahora, ...base,
    bloqueosDe: (fecha) => ocupados[fecha] ?? [],
    refrescar,
    reservar: async (d) => {
      const r = await (await api()).reservarTurno(d);
      void refrescar().catch(() => {}); // el horario recién tomado tiene que dejar de ofrecerse
      // El profesional lo asigna la base con el mismo criterio con el que se ofreció el horario.
      return {
        id: r.id, fecha: r.fecha, hora: r.hora, profesionalId: d.profesionalId, servicioId: d.servicioId,
        clienteId: '', estado: 'reservado', origen: 'online',
      };
    },
  });
}

/** Con `VITE_BACKEND=supabase` todo sale de la base; si no, de la demo local. */
export const useReservas: () => Cargable<ReservasVista> = BACKEND === 'supabase' ? useReservasSupabase : useReservasLocal;
