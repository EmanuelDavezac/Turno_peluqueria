import { describe, expect, it } from 'vitest';
import { codigoDe, describirError, esErrorDeRed } from './errores';

describe('esErrorDeRed', () => {
  it('detecta fetch caído, timeout y abort', () => {
    expect(esErrorDeRed(new TypeError('Failed to fetch'))).toBe(true);
    expect(esErrorDeRed({ name: 'TimeoutError', message: 'signal timed out' })).toBe(true);
    expect(esErrorDeRed({ name: 'AbortError' })).toBe(true);
    expect(esErrorDeRed({ message: 'TypeError: NetworkError when attempting to fetch resource.' })).toBe(true);
  });
  it('un error de la base con código no es de red', () => {
    expect(esErrorDeRed({ code: '23503', message: 'violates foreign key' })).toBe(false);
  });
});

describe('describirError', () => {
  it('sin conexión', () => {
    expect(describirError(new TypeError('Failed to fetch'))).toMatch(/conexión/i);
  });
  it('permiso / sesión vencida', () => {
    expect(describirError({ code: '42501', message: 'permission denied' })).toMatch(/sesión/i);
    expect(describirError({ message: 'JWT expired', code: 'PGRST303' })).toMatch(/sesión/i);
  });
  it('clave foránea: algo depende de eso', () => {
    expect(describirError({ code: '23503' })).toMatch(/dependen/i);
  });
  it('dato inválido y duplicado', () => {
    expect(describirError({ code: '23514' })).toMatch(/no es válido/i);
    expect(describirError({ code: '23505' })).toMatch(/ya existe/i);
  });
  it('no filtra mensajes técnicos', () => {
    const t = describirError({ code: 'XX000', message: 'relation "public.secreto" does not exist' });
    expect(t).not.toMatch(/secreto|relation/);
    expect(describirError(undefined)).toBeTruthy();
  });
});

describe('codigoDe', () => {
  it('lee el código si existe', () => {
    expect(codigoDe({ code: '23503' })).toBe('23503');
    expect(codigoDe(null)).toBeUndefined();
  });
});
