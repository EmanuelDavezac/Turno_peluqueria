import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HorariosRepo } from '@/data/repositories';
import { CLIENTES, PROFESIONALES, SEMANA_DEFAULT, SERVICIOS, generarSeed } from '@/data/seed';
import { PLANTILLA_DEFAULT } from '@/domain/recordatorio';
import type {
  Cliente, Cobro, Excepcion, Profesional, Servicio, Turno,
} from '@/domain/types';
import { ahoraISO, hoyReal, uid } from '@/lib/horas';

export type Tema = 'claro' | 'oscuro';
export type Medio = Cobro['medio'];

export interface AjustesRecordatorios {
  /** Avisar 24 h antes del turno. */
  h24: boolean;
  /** Avisar 2 h antes del turno. */
  h2: boolean;
  plantilla: string;
}

const COLORES_EQUIPO = ['#2a6f6b', '#b0563a', '#6b4fa0', '#3f6fb5', '#a07a1f', '#7a3f5c'];

interface Estado extends HorariosRepo {
  profesionales: Profesional[];
  servicios: Servicio[];
  clientes: Cliente[];
  turnos: Turno[];
  cobros: Cobro[];
  /** Fechas con la caja cerrada. */
  cajasCerradas: string[];
  /** Solo demo: fecha simulada de "hoy" (null = fecha real). */
  hoySimulado: string | null;
  /** Solo demo: hora simulada "HH:mm" (null = hora real). */
  horaSimulada: string | null;
  tema: Tema;
  /** `pin`: clave numérica para entrar al panel de administración. */
  local: { nombre: string; direccion: string; pin: string };
  recordatorios: AjustesRecordatorios;

  setLocal(c: Partial<Estado['local']>): void;
  setRecordatorios(c: Partial<AjustesRecordatorios>): void;
  addCliente(d: { nombre: string; whatsapp: string; notas?: string }): Cliente;
  updateCliente(id: string, c: Partial<Omit<Cliente, 'id'>>): void;
  addProfesional(): Profesional;
  updateProfesional(id: string, c: Partial<Omit<Profesional, 'id'>>): void;
  addServicio(): Servicio;
  updateServicio(id: string, c: Partial<Omit<Servicio, 'id'>>): void;
  removeServicio(id: string): void;

  /** Reserva de turno: reutiliza al cliente si el WhatsApp ya existe. */
  reservar(d: {
    fecha: string; hora: string; profesionalId: string; servicioId: string; nombre: string; whatsapp: string;
    origen?: Turno['origen'];
  }): Turno;
  setEstadoTurno(id: string, estado: Turno['estado']): void;
  /** Marca el turno como atendido y registra el cobro. */
  cobrarTurno(id: string, medio: Medio, monto: number): void;
  cerrarCaja(fecha: string): void;
  /** Cancela turnos (regla 8). La notificación al cliente es simulada. */
  cancelarTurnos(ids: string[]): void;
  setHoySimulado(fecha: string | null): void;
  setHoraSimulada(hora: string | null): void;
  setTema(t: Tema): void;
  resetDemo(): void;
}

function estadoInicial(hoy = hoyReal()) {
  const semana = SEMANA_DEFAULT;
  const excepciones: Excepcion[] = [];
  const seed = generarSeed(hoy, semana, excepciones);
  return {
    semana, excepciones,
    profesionales: PROFESIONALES, servicios: SERVICIOS, clientes: CLIENTES,
    turnos: seed.turnos, cobros: seed.cobros,
    cajasCerradas: [] as string[],
    recordatorios: { h24: true, h2: true, plantilla: PLANTILLA_DEFAULT } as AjustesRecordatorios,
    hoySimulado: null as string | null,
    horaSimulada: null as string | null,
  };
}

type Snap = Pick<Estado, 'hoySimulado' | 'horaSimulada'>;
const hoyDe = (s: Snap) => s.hoySimulado ?? hoyReal();
const ahoraDe = (s: Snap) => ahoraISO(hoyDe(s), s.horaSimulada);

/**
 * Implementación fase 1 (localStorage). En fase 2 los componentes siguen
 * hablando con esta forma de API; solo cambia el origen de los datos.
 */
export const useStore = create<Estado>()(
  persist(
    (set, get) => ({
      ...estadoInicial(),
      tema: 'claro',
      local: { nombre: 'Peluquería (ejemplo)', direccion: 'Dirección de ejemplo, Esperanza, Santa Fe', pin: '1234' },

      setLocal: (c) => set((s) => ({ local: { ...s.local, ...c } })),
      setRecordatorios: (c) => set((s) => ({ recordatorios: { ...s.recordatorios, ...c } })),

      addCliente: (d) => {
        const c: Cliente = { id: uid('c'), nombre: d.nombre, whatsapp: d.whatsapp, notas: d.notas || undefined };
        set((s) => ({ clientes: [...s.clientes, c] }));
        return c;
      },
      updateCliente: (id, c) => set((s) => ({ clientes: s.clientes.map((x) => (x.id === id ? { ...x, ...c } : x)) })),

      addProfesional: () => {
        const s = get();
        const p: Profesional = {
          id: uid('p'), nombre: `Profesional ${s.profesionales.length + 1}`,
          color: COLORES_EQUIPO[s.profesionales.length % COLORES_EQUIPO.length], comisionPct: 50, activo: true,
        };
        set({ profesionales: [...s.profesionales, p] });
        return p;
      },
      updateProfesional: (id, c) =>
        set((s) => ({ profesionales: s.profesionales.map((x) => (x.id === id ? { ...x, ...c } : x)) })),

      addServicio: () => {
        const sv: Servicio = { id: uid('s'), nombre: 'Nuevo servicio', duracionMin: 30, precio: 10000 };
        set((s) => ({ servicios: [...s.servicios, sv] }));
        return sv;
      },
      updateServicio: (id, c) => set((s) => ({ servicios: s.servicios.map((x) => (x.id === id ? { ...x, ...c } : x)) })),
      removeServicio: (id) => set((s) => ({ servicios: s.servicios.filter((x) => x.id !== id) })),

      reservar: (d) => {
        const digitos = (w: string) => w.replace(/\D/g, '');
        const dig = digitos(d.whatsapp);
        const existente = dig ? get().clientes.find((c) => digitos(c.whatsapp) === dig) : undefined;
        const cliente: Cliente = existente ?? { id: uid('c'), nombre: d.nombre, whatsapp: d.whatsapp };
        const turno: Turno = {
          id: uid('t'), fecha: d.fecha, hora: d.hora, profesionalId: d.profesionalId, servicioId: d.servicioId,
          clienteId: cliente.id, estado: 'reservado', origen: d.origen ?? 'online',
        };
        set((s) => ({ clientes: existente ? s.clientes : [...s.clientes, cliente], turnos: [...s.turnos, turno] }));
        return turno;
      },

      setEstadoTurno: (id, estado) =>
        set((s) => ({ turnos: s.turnos.map((t) => (t.id === id ? { ...t, estado } : t)) })),

      cobrarTurno: (id, medio, monto) => {
        const s = get();
        const t = s.turnos.find((x) => x.id === id);
        if (!t || t.estado === 'atendido' || t.estado === 'cancelado') return;
        const cliente = s.clientes.find((c) => c.id === t.clienteId);
        const cobro: Cobro = {
          id: uid('cb'), fecha: t.fecha, hora: ahoraDe(s).slice(11, 16), profesionalId: t.profesionalId,
          servicioId: t.servicioId, clienteNombre: cliente?.nombre ?? 'Cliente', monto, medio, origen: 'turno',
        };
        set({
          turnos: s.turnos.map((x) => (x.id === id ? { ...x, estado: 'atendido' as const } : x)),
          cobros: [...s.cobros, cobro],
        });
      },

      cerrarCaja: (fecha) => set((s) => ({ cajasCerradas: s.cajasCerradas.includes(fecha) ? s.cajasCerradas : [...s.cajasCerradas, fecha] })),

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
      setHoraSimulada: (hora) => set({ horaSimulada: hora }),
      setTema: (tema) => set({ tema }),
      // Conserva la fecha/hora simuladas y ancla los datos de ejemplo a ellas.
      resetDemo: () => {
        const s = get();
        set({ ...estadoInicial(hoyDe(s)), hoySimulado: s.hoySimulado, horaSimulada: s.horaSimulada });
      },
    }),
    // v2: agrega hora simulada, cajas cerradas y nuevo seed. Sin migración: arranca limpio.
    {
      name: 'turnero-pelu-v1',
      version: 2,
      // `local` se mezcla campo a campo para que datos guardados sin `pin` tomen el valor por defecto.
      merge: (persistido, actual) => {
        const p = (persistido ?? {}) as Partial<Estado>;
        return { ...actual, ...p, local: { ...actual.local, ...p.local } };
      },
    },
  ),
);

/** "Hoy" efectivo: respeta la simulación de la demo. */
export const useHoy = (): string => useStore((s) => s.hoySimulado ?? hoyReal());

/**
 * Instante actual (ISO local) respetando fecha y hora simuladas. Sin simulación
 * de hora, se refresca solo cada 30 s para que la línea de "ahora" avance.
 */
export function useAhora(): string {
  const hoySim = useStore((s) => s.hoySimulado);
  const horaSim = useStore((s) => s.horaSimulada);
  const [, tick] = useState(0);
  useEffect(() => {
    if (horaSim) return;
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [horaSim]);
  return ahoraISO(hoySim ?? hoyReal(), horaSim);
}
