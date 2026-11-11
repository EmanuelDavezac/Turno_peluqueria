import { describe, expect, it } from 'vitest';
import { aExcepcion, aProfesional, aSemana, aServicio, aTurno, deProfesional, deServicio } from './mapeo';

describe('mapeo base → dominio', () => {
  it('semana: franjas null pasa a []', () => {
    expect(aSemana({ dia: 3, modalidad: 'cerrado', franjas: null })).toEqual({ dia: 3, modalidad: 'cerrado', franjas: [] });
  });

  it('excepción: motivo null pasa a undefined', () => {
    const e = aExcepcion({ id: 'x', fecha: '2026-12-25', modalidad: 'cerrado', franjas: [], motivo: null });
    expect(e.motivo).toBeUndefined();
    expect(aExcepcion({ id: 'x', fecha: '2026-12-25', modalidad: 'cerrado', franjas: [], motivo: 'Navidad' }).motivo).toBe('Navidad');
  });

  it('profesional: comisión numeric llega como string y se convierte', () => {
    const p = aProfesional({ id: 'p', nombre: 'Ana', color: '#2a6f6b', comision_pct: '42.50', activo: true });
    expect(p).toEqual({ id: 'p', nombre: 'Ana', color: '#2a6f6b', comisionPct: 42.5, activo: true });
  });

  it('servicio: columnas a camelCase', () => {
    expect(aServicio({ id: 's', nombre: 'Corte', duracion_min: 30, precio: 11000 })).toEqual({
      id: 's', nombre: 'Corte', duracionMin: 30, precio: 11000,
    });
  });

  it('turno: la hora pierde los segundos', () => {
    const t = aTurno({
      id: 't', fecha: '2026-11-20', hora: '10:30:00', profesional_id: 'p', servicio_id: 's', cliente_id: 'c',
      estado: 'reservado', origen: 'online',
    });
    expect(t.hora).toBe('10:30');
    expect(t.profesionalId).toBe('p');
  });
});

describe('mapeo dominio → base', () => {
  it('solo manda los campos que cambiaron', () => {
    expect(deProfesional({ comisionPct: 30 })).toEqual({ comision_pct: 30 });
    expect(deProfesional({ activo: false, nombre: 'Ana' })).toEqual({ activo: false, nombre: 'Ana' });
    expect(deServicio({ duracionMin: 45 })).toEqual({ duracion_min: 45 });
    expect(deServicio({})).toEqual({});
  });

  it('un valor 0 o false se manda (no se confunde con "sin cambio")', () => {
    expect(deServicio({ precio: 0 })).toEqual({ precio: 0 });
    expect(deProfesional({ activo: false, comisionPct: 0 })).toEqual({ activo: false, comision_pct: 0 });
  });
});
