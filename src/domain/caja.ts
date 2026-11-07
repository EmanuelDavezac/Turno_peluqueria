import type { Cobro } from './types';

export type Medio = Cobro['medio'];

export const MEDIOS: Medio[] = ['efectivo', 'transferencia', 'mercadopago', 'debito'];

export const MEDIO_LABEL: Record<Medio, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
  debito: 'Débito',
};

export interface TotalesCaja {
  porMedio: Record<Medio, number>;
  total: number;
  cantidad: number;
}

/** Totales de los cobros de una fecha, separados por medio de pago. */
export function totalesCaja(cobros: Cobro[], fecha: string): TotalesCaja {
  const porMedio: Record<Medio, number> = { efectivo: 0, transferencia: 0, mercadopago: 0, debito: 0 };
  let cantidad = 0;
  for (const c of cobros) {
    if (c.fecha !== fecha) continue;
    porMedio[c.medio] += c.monto;
    cantidad++;
  }
  const total = MEDIOS.reduce((acc, m) => acc + porMedio[m], 0);
  return { porMedio, total, cantidad };
}
