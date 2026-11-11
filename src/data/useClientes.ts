import { BACKEND } from '@/data/backend';
import { useStore } from '@/data/local/store';
import { fichaCliente } from '@/domain/clientes';
import type { Cliente, Profesional, Servicio, Turno } from '@/domain/types';
import { listo, useCargar, useRefresco, type Cargable } from './recurso';

export interface DatosCliente { nombre: string; whatsapp: string; notas?: string }

/** Clientes del local, vengan de la demo local o de Supabase. */
export interface ClientesVista {
  clientes: Cliente[];
  servicios: Servicio[];
  profesionales: Profesional[];
  /** Visitas = turnos atendidos (cobrados). */
  resumen(clienteId: string): { visitas: number; ultimaVisita?: string };
  /** Últimas visitas de un cliente (la más reciente primero). */
  historial(clienteId: string): Promise<Turno[]>;
  addCliente(d: DatosCliente): Promise<void>;
  updateCliente(id: string, d: DatosCliente): Promise<void>;
}

const api = () => import('./supabase/clientes');

function useClientesLocal(): Cargable<ClientesVista> {
  const s = useStore();
  const hist = (id: string) =>
    s.turnos.filter((t) => t.clienteId === id && t.estado === 'atendido').sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);
  return listo({
    clientes: s.clientes, servicios: s.servicios, profesionales: s.profesionales,
    resumen: (id) => {
      const c = s.clientes.find((x) => x.id === id);
      const f = c ? fichaCliente(c, s.turnos) : undefined;
      return { visitas: f?.visitas ?? 0, ultimaVisita: f?.ultimaVisita };
    },
    historial: async (id) => hist(id),
    addCliente: async (d) => void s.addCliente({ ...d, notas: d.notas ?? '' }),
    updateCliente: async (id, d) => s.updateCliente(id, { nombre: d.nombre, whatsapp: d.whatsapp, notas: d.notas || undefined }),
  });
}

function useClientesSupabase(): Cargable<ClientesVista> {
  const { estado, recargar } = useCargar(() => api().then((m) => m.leerClientes()));
  useRefresco(recargar, 60_000);

  if (estado.estado === 'cargando') return estado;
  if (estado.estado === 'error') return { estado: 'error', mensaje: estado.mensaje, reintentar: recargar };
  const { resumen, ...d } = estado.datos;
  return listo({
    ...d,
    resumen: (id) => resumen[id] ?? { visitas: 0 },
    historial: async (id) => (await api()).leerHistorial(id),
    addCliente: async (c) => {
      try {
        await (await api()).crearCliente(c);
      } finally {
        recargar();
      }
    },
    updateCliente: async (id, c) => {
      try {
        await (await api()).guardarCliente(id, c);
      } finally {
        recargar();
      }
    },
  });
}

/** Con `VITE_BACKEND=supabase` trae los clientes de la base; si no, usa la demo local. */
export const useClientes: () => Cargable<ClientesVista> = BACKEND === 'supabase' ? useClientesSupabase : useClientesLocal;
