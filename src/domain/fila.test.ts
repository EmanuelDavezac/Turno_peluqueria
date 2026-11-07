import { describe, expect, it } from 'vitest';
import { esperaEstimada, llamarSiguiente, minutosRestantes, personasAdelante, siguienteNumero, turnoEnConflicto } from './fila';
import type { EntradaFila, Servicio, Turno } from './types';

const F = '2026-11-06';
const servicios: Servicio[] = [
  { id: 'corte', nombre: 'Corte', duracionMin: 30, precio: 1 },
  { id: 'cb', nombre: 'Corte + barba', duracionMin: 45, precio: 1 },
  { id: 'barba', nombre: 'Barba', duracionMin: 20, precio: 1 },
];

const e = (over: Partial<EntradaFila>): EntradaFila => ({
  id: `e${over.numero ?? 0}`, fecha: F, numero: 1, clienteNombre: 'X', servicioId: 'corte',
  estado: 'espera', origen: 'local', ingresoAt: `${F}T09:00:00`, ...over,
});

describe('siguienteNumero', () => {
  it('es correlativo dentro del día', () => {
    expect(siguienteNumero([], F)).toBe(1);
    expect(siguienteNumero([e({ numero: 1 }), e({ numero: 2 })], F)).toBe(3);
  });
  it('se reinicia cada día', () => {
    const ayer = [e({ numero: 7, fecha: '2026-11-05' })];
    expect(siguienteNumero(ayer, F)).toBe(1);
  });
  it('cuenta también a los que salieron o ya se atendieron', () => {
    const fila = [e({ numero: 1, estado: 'listo' }), e({ numero: 2, estado: 'salio' })];
    expect(siguienteNumero(fila, F)).toBe(3);
  });
});

describe('espera estimada (regla 5)', () => {
  const ahora = `${F}T10:00:00`;
  const p = (fila: EntradaFila[], extra = {}) =>
    esperaEstimada({ fila, fecha: F, servicios, profesionalesActivos: 2, ahora, ...extra });

  it('fila vacía = 0', () => {
    expect(p([])).toBe(0);
  });

  it('suma duraciones de los que esperan / profesionales', () => {
    // 30 + 45 + 20 = 95 / 2 = 47,5 → 50
    const fila = [e({ numero: 1 }), e({ numero: 2, servicioId: 'cb' }), e({ numero: 3, servicioId: 'barba' })];
    expect(p(fila)).toBe(50);
  });

  it('suma los minutos restantes de quienes están en atención', () => {
    // en atención: corte (30) iniciado hace 10 min → 20 restantes. Espera: 30. (20 + 30) / 2 = 25
    const fila = [
      e({ numero: 1, estado: 'atendiendo', inicioAt: `${F}T09:50:00` }),
      e({ numero: 2 }),
    ];
    expect(p(fila)).toBe(25);
  });

  it('lo que ya pasó del servicio en atención no resta de menos de cero', () => {
    const fila = [e({ numero: 1, estado: 'atendiendo', inicioAt: `${F}T08:00:00` })];
    expect(minutosRestantes(fila[0], servicios, ahora)).toBe(0);
    expect(p(fila)).toBe(0);
  });

  it('para un ticket cuenta solo a los que esperan adelante', () => {
    const fila = [
      e({ numero: 1 }), // 30
      e({ numero: 2, servicioId: 'cb' }), // 45
      e({ numero: 3 }), // detrás: no cuenta para el 3
    ];
    // ticket 3: adelante 30 + 45 = 75 / 2 = 37,5 → 40
    expect(p(fila, { numero: 3 })).toBe(40);
    // ticket 1: nadie adelante
    expect(p(fila, { numero: 1 })).toBe(0);
  });

  it('ignora listos, ausentes, que salieron y otros días', () => {
    const fila = [
      e({ numero: 1, estado: 'listo' }),
      e({ numero: 2, estado: 'ausente' }),
      e({ numero: 3, estado: 'salio' }),
      e({ numero: 4, fecha: '2026-11-05' }),
    ];
    expect(p(fila)).toBe(0);
  });

  it('con 1 profesional no divide; con 0 activos no rompe', () => {
    const fila = [e({ numero: 1 }), e({ numero: 2 })]; // 60
    expect(p(fila, { profesionalesActivos: 1 })).toBe(60);
    expect(p(fila, { profesionalesActivos: 0 })).toBe(60);
  });

  it('redondea a 5 min', () => {
    // 20 / 2 = 10 ; 45 / 2 = 22,5 → 25
    expect(p([e({ numero: 1, servicioId: 'barba' })])).toBe(10);
    expect(p([e({ numero: 1, servicioId: 'cb' })])).toBe(25);
  });
});

describe('personasAdelante', () => {
  it('cuenta solo en espera con número menor', () => {
    const fila = [e({ numero: 1, estado: 'atendiendo' }), e({ numero: 2 }), e({ numero: 3 }), e({ numero: 4 })];
    expect(personasAdelante(fila, F, 4)).toBe(2);
  });
});

describe('llamarSiguiente (regla 6)', () => {
  it('toma el primero por número', () => {
    const fila = [e({ numero: 2 }), e({ numero: 1 })];
    expect(llamarSiguiente(fila, F, 'p1')?.numero).toBe(1);
  });

  it('respeta la preferencia de profesional', () => {
    const fila = [
      e({ numero: 1, profesionalPreferidoId: 'p2' }),
      e({ numero: 2 }),
      e({ numero: 3, profesionalPreferidoId: 'p1' }),
    ];
    // p1 se salta al 1 (quiere p2) y toma el 2 (sin preferencia)
    expect(llamarSiguiente(fila, F, 'p1')?.numero).toBe(2);
    // p2 toma el 1
    expect(llamarSiguiente(fila, F, 'p2')?.numero).toBe(1);
  });

  it('si solo quedan con otra preferencia, no llama a nadie', () => {
    const fila = [e({ numero: 1, profesionalPreferidoId: 'p2' })];
    expect(llamarSiguiente(fila, F, 'p1')).toBeUndefined();
  });

  it('ignora atendiendo, listos, ausentes y otros días', () => {
    const fila = [
      e({ numero: 1, estado: 'atendiendo' }),
      e({ numero: 2, estado: 'ausente' }),
      e({ numero: 3, fecha: '2026-11-05' }),
    ];
    expect(llamarSiguiente(fila, F, 'p1')).toBeUndefined();
  });
});

describe('turnoEnConflicto (aviso al llamar siguiente)', () => {
  const ahora = `${F}T10:00:00`;
  const turno = (over: Partial<Turno>): Turno => ({
    id: 't', fecha: F, hora: '10:30', profesionalId: 'p1', servicioId: 'corte', clienteId: 'c',
    estado: 'reservado', origen: 'online', ...over,
  });
  const entrada = e({ numero: 1, servicioId: 'cb' }); // 45 min: ocuparía 10:00–10:45
  const llamar = (turnos: Turno[], extra = {}) =>
    turnoEnConflicto({ entrada, profesionalId: 'p1', turnos, servicios, fecha: F, ahora, ...extra });

  it('avisa si el profesional tiene un turno antes de que termine la atención', () => {
    expect(llamar([turno({ hora: '10:30' })])?.hora).toBe('10:30');
  });

  it('no avisa si el turno arranca justo cuando termina o después', () => {
    expect(llamar([turno({ hora: '10:45' })])).toBeUndefined();
    expect(llamar([turno({ hora: '11:30' })])).toBeUndefined();
  });

  it('ignora turnos de otro profesional, otro día y los que ya no están vivos', () => {
    expect(llamar([turno({ profesionalId: 'p2' })])).toBeUndefined();
    expect(llamar([turno({ fecha: '2026-11-07' })])).toBeUndefined();
    for (const estado of ['cancelado', 'atendido', 'ausente'] as const) {
      expect(llamar([turno({ estado })])).toBeUndefined();
    }
  });

  it('considera también al cliente que ya llegó (estado llego)', () => {
    expect(llamar([turno({ estado: 'llego' })])).toBeDefined();
  });

  it('devuelve el primero si hay varios', () => {
    expect(llamar([turno({ id: 'b', hora: '10:30' }), turno({ id: 'a', hora: '10:15' })])?.id).toBe('a');
  });

  it('un turno que ya empezó y todavía no terminó choca', () => {
    // turno de 09:45 con servicio de 30 min → termina 10:15, después de "ahora" (10:00)
    expect(llamar([turno({ hora: '09:45' })])).toBeDefined();
  });

  it('servicio corto: entra antes del turno', () => {
    const corta = e({ numero: 1, servicioId: 'barba' }); // 20 min → hasta 10:20
    expect(llamar([turno({ hora: '10:30' })], { entrada: corta })).toBeUndefined();
  });
});
