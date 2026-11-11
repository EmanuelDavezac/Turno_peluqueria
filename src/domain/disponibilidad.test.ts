import { describe, expect, it } from 'vitest';
import { CUALQUIERA, puedeTomar, slotsDisponibles, type ParamsSlots } from './disponibilidad';
import type { DiaResuelto, Profesional, Servicio, Turno } from './types';

const FECHA = '2026-11-10'; // martes
const dia: DiaResuelto = {
  fecha: FECHA,
  modalidad: 'turnos',
  franjas: [{ desde: '09:00', hasta: '12:30' }, { desde: '16:00', hasta: '20:30' }],
};
const corte: Servicio = { id: 'corte', nombre: 'Corte', duracionMin: 30, precio: 1 };
const barba45: Servicio = { id: 'cb', nombre: 'Corte + barba', duracionMin: 45, precio: 1 };
const color: Servicio = { id: 'color', nombre: 'Color', duracionMin: 90, precio: 1 };
const servicios = [corte, barba45, color];
const p1: Profesional = { id: 'p1', nombre: 'A', color: '#000', comisionPct: 50, activo: true };
const p2: Profesional = { id: 'p2', nombre: 'B', color: '#000', comisionPct: 50, activo: true };

const turno = (over: Partial<Turno>): Turno => ({
  id: 't', fecha: FECHA, hora: '10:00', profesionalId: 'p1', servicioId: 'corte', clienteId: 'c',
  estado: 'reservado', origen: 'online', ...over,
});

const base = (over: Partial<ParamsSlots> = {}): ParamsSlots => ({
  dia, servicio: corte, profesionalId: 'p1', profesionales: [p1, p2], servicios, turnos: [],
  ahora: '2026-11-01T08:00', ...over,
});

const horas = (r: ReturnType<typeof slotsDisponibles>) => r.map((s) => s.hora);

describe('slotsDisponibles', () => {
  it('ofrece cada 30 min y no ofrece nada en la siesta (12:30–16:00)', () => {
    const h = horas(slotsDisponibles(base()));
    expect(h).toContain('09:00');
    expect(h).toContain('12:00');
    expect(h).toContain('16:00');
    const siesta = h.filter((x) => x >= '12:30' && x < '16:00');
    expect(siesta).toEqual([]);
  });

  it('el servicio tiene que entrar completo antes del cierre de la franja', () => {
    // Corte 30: el último de la mañana es 12:00 (termina 12:30)
    expect(horas(slotsDisponibles(base())).filter((x) => x < '13:00').at(-1)).toBe('12:00');
    // 45 min: 12:00 terminaría 12:45 → no entra; el último es 11:30
    const h45 = horas(slotsDisponibles(base({ servicio: barba45 }))).filter((x) => x < '13:00');
    expect(h45.at(-1)).toBe('11:30');
    // 90 min en la tarde: último inicio 19:00 (termina 20:30)
    const h90 = horas(slotsDisponibles(base({ servicio: color }))).filter((x) => x >= '16:00');
    expect(h90.at(-1)).toBe('19:00');
  });

  it('no se superpone con otro turno del mismo profesional', () => {
    const turnos = [turno({ hora: '10:00', servicioId: 'cb' })]; // 10:00–10:45
    const h = horas(slotsDisponibles(base({ turnos })));
    expect(h).not.toContain('10:00');
    expect(h).not.toContain('10:30'); // 10:30–11:00 pisa hasta 10:45
    expect(h).toContain('09:30'); // 09:30–10:00 toca el borde pero no pisa
    expect(h).toContain('11:00');
  });

  it('un servicio largo no puede arrancar justo antes de un turno ya tomado', () => {
    const turnos = [turno({ hora: '10:30' })];
    const h = horas(slotsDisponibles(base({ servicio: barba45, turnos })));
    expect(h).not.toContain('10:00'); // 10:00–10:45 pisa el de 10:30
    expect(h).toContain('09:30'); // 09:30–10:15 libre
  });

  it('turnos cancelados no bloquean y turnos de otro profesional tampoco', () => {
    const turnos = [turno({ estado: 'cancelado' }), turno({ profesionalId: 'p2', hora: '11:00' })];
    const h = horas(slotsDisponibles(base({ turnos })));
    expect(h).toContain('10:00');
    expect(h).toContain('11:00');
  });

  it('"cualquiera" asigna el primer profesional libre', () => {
    const turnos = [turno({ hora: '10:00', profesionalId: 'p1' })];
    const r = slotsDisponibles(base({ profesionalId: CUALQUIERA, turnos }));
    expect(r.find((s) => s.hora === '09:30')?.profesionalId).toBe('p1');
    expect(r.find((s) => s.hora === '10:00')?.profesionalId).toBe('p2'); // p1 ocupado
  });

  it('"cualquiera" no ofrece el horario si todos están ocupados', () => {
    const turnos = [turno({ profesionalId: 'p1' }), turno({ profesionalId: 'p2' })];
    expect(horas(slotsDisponibles(base({ profesionalId: CUALQUIERA, turnos })))).not.toContain('10:00');
  });

  it('ignora profesionales inactivos', () => {
    const r = slotsDisponibles(base({ profesionalId: CUALQUIERA, profesionales: [{ ...p1, activo: false }, p2] }));
    expect(new Set(r.map((s) => s.profesionalId))).toEqual(new Set(['p2']));
  });

  it('no ofrece horarios pasados si es hoy', () => {
    const h = horas(slotsDisponibles(base({ ahora: `${FECHA}T10:15` })));
    expect(h).not.toContain('10:00');
    expect(h).not.toContain('09:00');
    expect(h).toContain('10:30');
  });

  it('si es otro día ignora la hora actual', () => {
    expect(horas(slotsDisponibles(base({ ahora: '2026-11-09T23:00' })))).toContain('09:00');
  });

  it('no ofrece nada en días llegada ni cerrado', () => {
    expect(slotsDisponibles(base({ dia: { ...dia, modalidad: 'llegada' } }))).toEqual([]);
    expect(slotsDisponibles(base({ dia: { ...dia, modalidad: 'cerrado', franjas: [] } }))).toEqual([]);
  });

  it('en días mixto sí ofrece turnos', () => {
    expect(slotsDisponibles(base({ dia: { ...dia, modalidad: 'mixto' } })).length).toBeGreaterThan(0);
  });
});

const mixto: DiaResuelto = { ...dia, modalidad: 'mixto' };

describe('puedeTomar (panel)', () => {
  const args = { dia, servicio: corte, servicios, turnos: [] as Turno[], profesionalId: 'p1' };
  it('acepta un hueco libre dentro de la franja, aunque sea pasado', () => {
    expect(puedeTomar({ ...args, hora: '09:00' })).toBe(true);
  });
  it('rechaza la siesta y lo que no entra en la franja', () => {
    expect(puedeTomar({ ...args, hora: '13:00' })).toBe(false);
    expect(puedeTomar({ ...args, hora: '12:00', servicio: barba45 })).toBe(false);
  });
  it('rechaza si choca con un turno', () => {
    expect(puedeTomar({ ...args, hora: '10:00', turnos: [turno({ hora: '10:00' })] })).toBe(false);
  });
  it('en un día mixto también se puede cargar un turno', () => {
    expect(puedeTomar({ ...args, dia: mixto, hora: '10:30' })).toBe(true);
  });
});

describe('slotsDisponibles con bloqueos precalculados (los que entrega la base)', () => {
  it('descuenta los rangos ocupados sin necesitar los turnos', () => {
    const h = horas(slotsDisponibles(base({ bloqueos: [{ profesionalId: 'p1', ini: 600, fin: 630 }] }))); // 10:00–10:30
    expect(h).toContain('09:30');
    expect(h).not.toContain('10:00');
    expect(h).toContain('10:30');
  });

  it('un bloqueo de otro profesional no afecta, y con "cualquiera" se asigna el libre', () => {
    const b = [{ profesionalId: 'p1', ini: 600, fin: 630 }];
    expect(horas(slotsDisponibles(base({ bloqueos: b, profesionalId: 'p2' })))).toContain('10:00');
    const s = slotsDisponibles(base({ bloqueos: b, profesionalId: CUALQUIERA })).find((x) => x.hora === '10:00');
    expect(s?.profesionalId).toBe('p2');
  });

  it('si vienen bloqueos, mandan sobre los turnos', () => {
    const h = horas(slotsDisponibles(base({ turnos: [turno({ hora: '10:00' })], bloqueos: [] })));
    expect(h).toContain('10:00');
  });

  it('un día cerrado no ofrece horarios aunque no haya bloqueos', () => {
    expect(slotsDisponibles(base({ dia: { fecha: FECHA, modalidad: 'cerrado', franjas: [] }, bloqueos: [] }))).toEqual([]);
  });
});
