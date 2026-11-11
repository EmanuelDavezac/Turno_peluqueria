import { BACKEND } from '@/data/backend';
import { useStore } from '@/data/local/store';
import { servicioEnUso as enUsoLocal } from '@/domain/clientes';
import type { Profesional, Servicio } from '@/domain/types';
import { useEscritor, type EstadoGuardado } from './escritor';
import { listo, useCargar, type Cargable } from './recurso';

export type CambiosProfesional = Partial<Omit<Profesional, 'id'>>;
export type CambiosServicio = Partial<Omit<Servicio, 'id'>>;

/** Equipo y servicios, vengan de localStorage o de Supabase. */
export interface CatalogoVista {
  profesionales: Profesional[];
  servicios: Servicio[];
  /** Se ve al instante y se guarda solo (ver `guardado`). */
  updateProfesional(id: string, c: CambiosProfesional): void;
  updateServicio(id: string, c: CambiosServicio): void;
  addProfesional(): Promise<void>;
  addServicio(): Promise<void>;
  removeServicio(id: string): Promise<void>;
  /** ¿Tiene turnos, fila o cobros? Solo se sabe de antemano en la demo; en Supabase lo decide la base al borrar. */
  servicioEnUso(id: string): boolean;
  guardado: EstadoGuardado;
  reintentarGuardado(): void;
}

const COLORES_EQUIPO = ['#2a6f6b', '#b0563a', '#6b4fa0', '#3f6fb5', '#a07a1f', '#7a3f5c'];
const api = () => import('./supabase/catalogo');

/** Duración y precio son enteros en la base: se redondea antes de mandar. */
const normalizarServicio = (c: CambiosServicio): CambiosServicio => ({
  ...c,
  ...(c.duracionMin !== undefined && { duracionMin: Math.round(c.duracionMin) }),
  ...(c.precio !== undefined && { precio: Math.round(c.precio) }),
});

function useCatalogoLocal(): Cargable<CatalogoVista> {
  const s = useStore();
  return listo({
    profesionales: s.profesionales,
    servicios: s.servicios,
    updateProfesional: s.updateProfesional,
    updateServicio: s.updateServicio,
    addProfesional: async () => void s.addProfesional(),
    addServicio: async () => void s.addServicio(),
    removeServicio: async (id) => s.removeServicio(id),
    servicioEnUso: (id) => enUsoLocal(id, s.turnos, s.fila, s.cobros),
    guardado: { estado: 'ok' },
    reintentarGuardado: () => {},
  });
}

function useCatalogoSupabase(): Cargable<CatalogoVista> {
  const { estado, recargar, setDatos } = useCargar(() => api().then((m) => m.leerCatalogo()));
  const { escritor, guardado } = useEscritor();

  if (estado.estado === 'cargando') return estado;
  if (estado.estado === 'error') return { estado: 'error', mensaje: estado.mensaje, reintentar: recargar };
  const { profesionales, servicios } = estado.datos;

  return listo({
    profesionales,
    servicios,
    updateProfesional: (id, c) => {
      setDatos((d) => ({ ...d, profesionales: d.profesionales.map((x) => (x.id === id ? { ...x, ...c } : x)) }));
      escritor.programar(`prof:${id}`, c, async (p) => (await api()).guardarProfesional(id, p));
    },
    updateServicio: (id, c0) => {
      const c = normalizarServicio(c0);
      setDatos((d) => ({ ...d, servicios: d.servicios.map((x) => (x.id === id ? { ...x, ...c } : x)) }));
      escritor.programar(`serv:${id}`, c, async (p) => (await api()).guardarServicio(id, p));
    },
    addProfesional: async () => {
      const color = COLORES_EQUIPO[profesionales.length % COLORES_EQUIPO.length];
      const nuevo = await (await api()).crearProfesional({
        nombre: `Profesional ${profesionales.length + 1}`, color, comisionPct: 50, activo: true,
      });
      setDatos((d) => ({ ...d, profesionales: [...d.profesionales, nuevo] }));
    },
    addServicio: async () => {
      const nuevo = await (await api()).crearServicio({ nombre: 'Nuevo servicio', duracionMin: 30, precio: 10000 });
      setDatos((d) => ({ ...d, servicios: [...d.servicios, nuevo] }));
    },
    removeServicio: async (id) => {
      // Si tiene turnos, fila o cobros la base lo rechaza (23503) y el error llega a la pantalla.
      await (await api()).borrarServicio(id);
      setDatos((d) => ({ ...d, servicios: d.servicios.filter((x) => x.id !== id) }));
    },
    servicioEnUso: () => false,
    guardado,
    reintentarGuardado: () => escritor.reintentar(),
  });
}

/** Con `VITE_BACKEND=supabase` trae los datos de la base; si no, usa la demo local. */
export const useCatalogo: () => Cargable<CatalogoVista> = BACKEND === 'supabase' ? useCatalogoSupabase : useCatalogoLocal;
