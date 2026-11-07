import { describe, expect, it } from 'vitest';
import { getDia } from './getDia';
import type { ConfigDia, Excepcion } from './types';

const semana: ConfigDia[] = [
  { dia: 5, modalidad: 'llegada', franjas: [{ desde: '09:00', hasta: '12:30' }, { desde: '16:00', hasta: '21:00' }] },
  { dia: 1, modalidad: 'cerrado', franjas: [] },
];

describe('getDia', () => {
  it('usa la config semanal (2026-11-06 es viernes)', () => {
    const d = getDia('2026-11-06', semana, []);
    expect(d.modalidad).toBe('llegada');
    expect(d.franjas).toHaveLength(2);
    expect(d.excepcion).toBeUndefined();
  });

  it('la excepción pisa la semanal', () => {
    const ex: Excepcion = { id: 'x', fecha: '2026-11-06', modalidad: 'cerrado', franjas: [], motivo: 'Feriado' };
    const d = getDia('2026-11-06', semana, [ex]);
    expect(d.modalidad).toBe('cerrado');
    expect(d.excepcion?.motivo).toBe('Feriado');
  });

  it('excepción de otra fecha no afecta', () => {
    const ex: Excepcion = { id: 'x', fecha: '2026-11-13', modalidad: 'cerrado', franjas: [] };
    expect(getDia('2026-11-06', semana, [ex]).modalidad).toBe('llegada');
  });

  it('día sin config = cerrado', () => {
    expect(getDia('2026-11-04', semana, []).modalidad).toBe('cerrado'); // miércoles
  });
});
