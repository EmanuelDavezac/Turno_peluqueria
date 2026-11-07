import { describe, expect, it } from 'vitest';
import { totalesCaja } from './caja';
import type { Cobro } from './types';

const c = (over: Partial<Cobro>): Cobro => ({
  id: 'x', fecha: '2026-11-06', hora: '10:00', profesionalId: 'p1', servicioId: 's1', clienteNombre: 'A',
  monto: 1000, medio: 'efectivo', origen: 'turno', ...over,
});

describe('totalesCaja', () => {
  it('suma por medio y total, solo de esa fecha', () => {
    const t = totalesCaja(
      [c({ monto: 11000 }), c({ monto: 6000, medio: 'debito' }), c({ monto: 9000, medio: 'efectivo' }), c({ fecha: '2026-11-05', monto: 99999 })],
      '2026-11-06',
    );
    expect(t.porMedio.efectivo).toBe(20000);
    expect(t.porMedio.debito).toBe(6000);
    expect(t.porMedio.mercadopago).toBe(0);
    expect(t.total).toBe(26000);
    expect(t.cantidad).toBe(3);
  });

  it('sin cobros: todo en cero', () => {
    expect(totalesCaja([], '2026-11-06')).toEqual({
      porMedio: { efectivo: 0, transferencia: 0, mercadopago: 0, debito: 0 }, total: 0, cantidad: 0,
    });
  });
});
