import { describe, expect, it } from 'vitest';
import { PLANTILLA_DEFAULT, armarMensaje, variablesDesconocidas } from './recordatorio';

const v = { nombre: 'Ana', local: 'Peluquería', dia: 'viernes 13 de noviembre', hora: '10:30', profesional: 'Lucía' };

describe('armarMensaje', () => {
  it('reemplaza todas las variables, también las repetidas', () => {
    expect(armarMensaje('{nombre}, {nombre}: {hora} en {local}', v)).toBe('Ana, Ana: 10:30 en Peluquería');
  });
  it('la plantilla por defecto usa todas las variables', () => {
    const m = armarMensaje(PLANTILLA_DEFAULT, v);
    expect(m).toContain('Ana');
    expect(m).toContain('viernes 13 de noviembre');
    expect(m).toContain('Lucía');
    expect(m).not.toMatch(/[{}]/);
  });
  it('deja intacto lo que no es una variable conocida', () => {
    expect(armarMensaje('Hola {apodo}', v)).toBe('Hola {apodo}');
  });
});

describe('variablesDesconocidas', () => {
  it('detecta errores de tipeo sin repetir', () => {
    expect(variablesDesconocidas('Hola {nombre}, a las {hroa} {hroa} {x}')).toEqual(['hroa', 'x']);
  });
  it('la plantilla original no tiene desconocidas', () => {
    expect(variablesDesconocidas(PLANTILLA_DEFAULT)).toEqual([]);
  });
});
