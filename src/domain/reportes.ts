import { sumarDias } from '@/lib/horas';
import type { Cobro, Profesional, Servicio } from './types';

export interface DiaFacturacion {
  fecha: string;
  turnos: number;
  llegada: number;
  total: number;
}

/** Facturación de los últimos `dias` días (incluye hoy), separando turnos de orden de llegada. Siempre devuelve todos los días, aunque estén en 0. */
export function facturacionPorDia(cobros: Cobro[], hoy: string, dias = 7): DiaFacturacion[] {
  const out: DiaFacturacion[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = sumarDias(hoy, -i);
    let turnos = 0;
    let llegada = 0;
    for (const c of cobros) {
      if (c.fecha !== fecha) continue;
      if (c.origen === 'turno') turnos += c.monto;
      else llegada += c.monto;
    }
    out.push({ fecha, turnos, llegada, total: turnos + llegada });
  }
  return out;
}

const enRango = (c: Cobro, desde: string, hasta: string) => c.fecha >= desde && c.fecha <= hasta;

export interface FilaProfesional {
  profesionalId: string;
  nombre: string;
  comisionPct: number;
  cantidad: number;
  facturado: number;
  /** Monto a pagar al profesional: facturado × comisión. */
  comision: number;
}

/** Facturado y comisión por profesional en un rango (inclusive). Incluye a los que no facturaron. */
export function porProfesional(cobros: Cobro[], profesionales: Profesional[], desde: string, hasta: string): FilaProfesional[] {
  return profesionales
    .map((p) => {
      const propios = cobros.filter((c) => c.profesionalId === p.id && enRango(c, desde, hasta));
      const facturado = propios.reduce((a, c) => a + c.monto, 0);
      return {
        profesionalId: p.id, nombre: p.nombre, comisionPct: p.comisionPct, cantidad: propios.length,
        facturado, comision: Math.round((facturado * p.comisionPct) / 100),
      };
    })
    .sort((a, b) => b.facturado - a.facturado);
}

export interface FilaServicio {
  servicioId: string;
  nombre: string;
  cantidad: number;
  facturado: number;
}

/** Servicios más pedidos en un rango, de mayor a menor cantidad (desempata por facturación). */
export function serviciosMasPedidos(cobros: Cobro[], servicios: Servicio[], desde: string, hasta: string): FilaServicio[] {
  return servicios
    .map((s) => {
      const propios = cobros.filter((c) => c.servicioId === s.id && enRango(c, desde, hasta));
      return { servicioId: s.id, nombre: s.nombre, cantidad: propios.length, facturado: propios.reduce((a, c) => a + c.monto, 0) };
    })
    .filter((s) => s.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad || b.facturado - a.facturado);
}
