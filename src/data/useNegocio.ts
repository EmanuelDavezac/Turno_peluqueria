import { BACKEND } from '@/data/backend';
import { useStore, type AjustesRecordatorios } from '@/data/local/store';
import { PLANTILLA_DEFAULT } from '@/domain/recordatorio';
import { useEscritor, type EstadoGuardado } from './escritor';
import { listo, useCargar, type Cargable } from './recurso';

/** Datos del local y ajustes de recordatorios, vengan de la demo local o de Supabase. */
export interface NegocioVista {
  local: { nombre: string; direccion: string };
  recordatorios: AjustesRecordatorios;
  /** Nombre de un profesional activo, para el mensaje de ejemplo. */
  profesionalEjemplo: string;
  /** Se ven al instante y se guardan solos (ver `guardado`). */
  setLocal(c: { nombre?: string; direccion?: string }): void;
  setRecordatorios(c: Partial<AjustesRecordatorios>): void;
  guardado: EstadoGuardado;
  reintentarGuardado(): void;
}

const api = () => import('./supabase/negocio');

function useNegocioLocal(): Cargable<NegocioVista> {
  const s = useStore();
  return listo({
    local: s.local,
    recordatorios: s.recordatorios,
    profesionalEjemplo: s.profesionales.find((p) => p.activo)?.nombre ?? 'Profesional',
    setLocal: s.setLocal,
    setRecordatorios: s.setRecordatorios,
    guardado: { estado: 'ok' },
    reintentarGuardado: () => {},
  });
}

function useNegocioSupabase(): Cargable<NegocioVista> {
  const { estado, recargar, setDatos } = useCargar(() => api().then((m) => m.leerNegocio()));
  const { escritor, guardado } = useEscritor(600);

  if (estado.estado === 'cargando') return estado;
  if (estado.estado === 'error') return { estado: 'error', mensaje: estado.mensaje, reintentar: recargar };
  const d = estado.datos;
  const r = d.recordatorios;

  return listo({
    local: { nombre: d.nombre, direccion: d.direccion },
    recordatorios: {
      h24: r.h24 !== false,
      h2: r.h2 !== false,
      plantilla: typeof r.plantilla === 'string' ? r.plantilla : PLANTILLA_DEFAULT,
    },
    profesionalEjemplo: d.profesionalEjemplo,
    setLocal: (c) => {
      setDatos((x) => ({ ...x, ...c }));
      escritor.programar('negocio', c, async (p) => (await api()).guardarNegocio(p));
    },
    setRecordatorios: (c) => {
      // Se manda el objeto entero (es una sola columna), conservando lo que ya tenía.
      const nuevo = { ...r, ...c };
      setDatos((x) => ({ ...x, recordatorios: nuevo }));
      escritor.programar('negocio', { recordatorios: nuevo }, async (p) => (await api()).guardarNegocio(p));
    },
    guardado,
    reintentarGuardado: () => escritor.reintentar(),
  });
}

/** Con `VITE_BACKEND=supabase` lee y guarda en la base; si no, usa la demo local. */
export const useNegocio: () => Cargable<NegocioVista> = BACKEND === 'supabase' ? useNegocioSupabase : useNegocioLocal;
