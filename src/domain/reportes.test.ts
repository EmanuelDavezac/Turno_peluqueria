import { describe, expect, it } from 'vitest';
import { facturacionPorDia, porProfesional, serviciosMasPedidos } from './reportes';
import type { Cobro, Profesional, Servicio } from './types';

const c = (over: Partial<Cobro>): Cobro => ({
  id: Math.random().toString(), fecha: '2026-11-06', hora: '10:00', profesionalId: 'p1', servicioId: 's1',
  clienteNombre: 'X', monto: 1000, medio: 'efectivo', origen: 'turno', ...over,
});
const profs: Profesional[] = [
  { id: 'p1', nombre: 'A', color: '#000', comisionPct: 50, activo: true },
  { id: 'p2', nombre: 'B', color: '#000', comisionPct: 40, activo: true },
];
const servs: Servicio[] = [
  { id: 's1', nombre: 'Corte', duracionMin: 30, precio: 11000 },
  { id: 's2', nombre: 'Barba', duracionMin: 20, precio: 6000 },
  { id: 's3', nombre: 'Color', duracionMin: 90, precio: 28000 },
];

describe('facturacionPorDia', () => {
  it('devuelve 7 días terminando hoy y suma los cobros de cada día', () => {
    const r = facturacionPorDia(
      [c({ monto: 11000 }), c({ monto: 6000 }), c({ fecha: '2026-11-04', monto: 9000 })],
      '2026-11-06',
    );
    expect(r).toHaveLength(7);
    expect(r[0].fecha).toBe('2026-10-31');
    expect(r[6]).toEqual({ fecha: '2026-11-06', total: 17000 });
    expect(r.find((d) => d.fecha === '2026-11-04')?.total).toBe(9000);
  });

  it('los días sin cobros aparecen en cero y se ignora lo fuera de rango', () => {
    const r = facturacionPorDia([c({ fecha: '2026-10-01', monto: 5 })], '2026-11-06');
    expect(r.every((d) => d.total === 0)).toBe(true);
  });
});

describe('porProfesional y comisiones', () => {
  const cobros = [
    c({ profesionalId: 'p1', monto: 11000 }),
    c({ profesionalId: 'p1', monto: 9000 }),
    c({ profesionalId: 'p2', monto: 10000 }),
    c({ profesionalId: 'p2', monto: 99999, fecha: '2026-10-01' }), // fuera de rango
  ];
  it('suma facturado y calcula comisión = facturado × %', () => {
    const r = porProfesional(cobros, profs, '2026-10-31', '2026-11-06');
    expect(r[0]).toMatchObject({ profesionalId: 'p1', facturado: 20000, comision: 10000, cantidad: 2 });
    expect(r[1]).toMatchObject({ profesionalId: 'p2', facturado: 10000, comision: 4000 });
  });
  it('incluye a quien no facturó, con cero', () => {
    const r = porProfesional([], profs, '2026-10-31', '2026-11-06');
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.facturado === 0 && x.comision === 0)).toBe(true);
  });
  it('redondea la comisión al peso', () => {
    const r = porProfesional([c({ profesionalId: 'p2', monto: 333 })], profs, '2026-11-06', '2026-11-06');
    expect(r[0].comision).toBe(133); // 133,2
  });
});

describe('serviciosMasPedidos', () => {
  it('ordena por cantidad, desempata por facturación y omite los que no se pidieron', () => {
    const cobros = [
      c({ servicioId: 's2', monto: 6000 }), c({ servicioId: 's2', monto: 6000 }),
      c({ servicioId: 's1', monto: 11000 }), c({ servicioId: 's1', monto: 11000 }),
      c({ servicioId: 's1', monto: 11000, fecha: '2026-10-01' }), // fuera de rango
    ];
    const r = serviciosMasPedidos(cobros, servs, '2026-10-31', '2026-11-06');
    expect(r.map((x) => x.servicioId)).toEqual(['s1', 's2']); // empatan en 2; s1 factura más
    expect(r.find((x) => x.servicioId === 's3')).toBeUndefined();
  });
});
