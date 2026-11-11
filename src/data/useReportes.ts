import { BACKEND } from '@/data/backend';
import { useStore } from '@/data/local/store';
import type { Cobro, Profesional, Servicio } from '@/domain/types';
import { listo, useCargar, useRefresco, type Cargable } from './recurso';

/** Cobros del período de los reportes, vengan de la demo local o de Supabase. */
export interface ReportesVista {
  /** Pueden venir cobros fuera del rango (demo local): el dominio filtra por fecha. */
  cobros: Cobro[];
  servicios: Servicio[];
  profesionales: Profesional[];
}

const api = () => import('./supabase/caja');

function useReportesLocal(): Cargable<ReportesVista> {
  const s = useStore();
  return listo({ cobros: s.cobros, servicios: s.servicios, profesionales: s.profesionales });
}

function useReportesSupabase(desde: string, hasta: string): Cargable<ReportesVista> {
  const { estado, recargar } = useCargar(() => api().then((m) => m.leerCobros(desde, hasta)));
  useRefresco(recargar, 60_000);

  if (estado.estado === 'cargando') return estado;
  if (estado.estado === 'error') return { estado: 'error', mensaje: estado.mensaje, reintentar: recargar };
  return listo(estado.datos);
}

/** Con `VITE_BACKEND=supabase` trae los cobros del rango de la base; si no, usa la demo local. */
export const useReportes: (desde: string, hasta: string) => Cargable<ReportesVista> =
  BACKEND === 'supabase' ? useReportesSupabase : useReportesLocal;
