import { describe, expect, it } from 'vitest';
import { ahoraAR } from './horas';

describe('ahoraAR', () => {
  it('usa la hora de Argentina (UTC-3) sin importar la zona de la computadora', () => {
    expect(ahoraAR(new Date('2026-11-11T03:30:15Z'))).toBe('2026-11-11T00:30:15');
  });
  it('cruza la medianoche hacia el día anterior', () => {
    expect(ahoraAR(new Date('2026-11-11T02:59:59Z'))).toBe('2026-11-10T23:59:59');
  });
  it('tiene el formato que esperan los cálculos de horarios', () => {
    expect(ahoraAR()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});
