import { BACKEND } from '@/data/backend';
import { useStore } from '@/data/local/store';
import type { Cobro, Profesional, Servicio } from '@/domain/types';
import { listo, useCargar, useRefresco, type Cargable } from './recurso';

/** La caja de un día, venga de la demo local o de Supabase. */
export interface CajaVista {
  /** Pueden venir cobros de otros días (demo local): la pantalla filtra por fecha. */
  cobros: Cobro[];
  cerrada: boolean;
  servicios: Servicio[];
  profesionales: Profesional[];
  cerrarCaja(): Promise<void>;
}

const api = () => import('./supabase/caja');

function useCajaLocal(fecha: string): Cargable<CajaVista> {
  const s = useStore();
  return listo({
    cobros: s.cobros, servicios: s.servicios, profesionales: s.profesionales,
    cerrada: s.cajasCerradas.includes(fecha),
    cerrarCaja: async () => s.cerrarCaja(fecha),
  });
}

function useCajaSupabase(fecha: string): Cargable<CajaVista> {
  const { estado, recargar } = useCargar(() => api().then((m) => m.leerCaja(fecha)));
  useRefresco(recargar);

  if (estado.estado === 'cargando') return estado;
  if (estado.estado === 'error') return { estado: 'error', mensaje: estado.mensaje, reintentar: recargar };
  return listo({
    ...estado.datos,
    cerrarCaja: async () => {
      try {
        await (await api()).cerrarCaja(fecha);
      } finally {
        recargar();
      }
    },
  });
}

/** Con `VITE_BACKEND=supabase` trae los cobros de la base; si no, usa la demo local. */
export const useCaja: (fecha: string) => Cargable<CajaVista> = BACKEND === 'supabase' ? useCajaSupabase : useCajaLocal;
