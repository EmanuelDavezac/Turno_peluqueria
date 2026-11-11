import type { Cliente, Turno } from './types';

export const soloDigitos = (s: string): string => s.replace(/\D/g, '');
const normalizar = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface FichaCliente {
  cliente: Cliente;
  /** Turnos atendidos (cobrados). */
  visitas: number;
  /** Fecha ISO de la última visita atendida, si hay. */
  ultimaVisita?: string;
}

export function fichaCliente(cliente: Cliente, turnos: Turno[]): FichaCliente {
  const atendidos = turnos.filter((t) => t.clienteId === cliente.id && t.estado === 'atendido');
  const ultimaVisita = atendidos.map((t) => t.fecha).sort().at(-1);
  return { cliente, visitas: atendidos.length, ultimaVisita };
}

/** Busca por nombre (sin tildes ni mayúsculas) o por dígitos del WhatsApp. Vacío = todos. */
export function buscarClientes(clientes: Cliente[], consulta: string): Cliente[] {
  const q = normalizar(consulta);
  if (!q) return clientes;
  const dig = soloDigitos(consulta);
  return clientes.filter(
    (c) => normalizar(c.nombre).includes(q) || (dig.length >= 3 && soloDigitos(c.whatsapp).includes(dig)),
  );
}

/** ¿Algún turno o cobro referencia a este servicio? (para no borrarlo). */
export const servicioEnUso = (id: string, ...fuentes: { servicioId: string }[][]): boolean =>
  fuentes.some((lista) => lista.some((e) => e.servicioId === id));
