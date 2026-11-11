import { describe, expect, it } from 'vitest';
import { codigoDe, describirError, describirErrorReserva, esErrorDeRed } from './errores';

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

describe('describirErrorReserva', () => {
  const dePg = (message: string) => ({ code: 'P0001', message });

  it('día cerrado: explica y pide actualizar los horarios', () => {
    const r = describirErrorReserva(dePg('dia_cerrado'));
    expect(r.texto).toMatch(/cerrado/i);
    expect(r.refrescar).toBe(true);
  });
  it('horario ocupado: avisa que lo tomó otra persona', () => {
    expect(describirErrorReserva(dePg('horario_ocupado'))).toMatchObject({ texto: expect.stringMatching(/tom/i), refrescar: true });
  });
  it('errores del formulario no refrescan', () => {
    expect(describirErrorReserva(dePg('whatsapp_invalido')).refrescar).toBe(false);
    expect(describirErrorReserva(dePg('tope_turnos')).refrescar).toBe(false);
  });
  it('todos los códigos del contrato tienen mensaje propio', () => {
    for (const c of ['nombre_invalido', 'whatsapp_invalido', 'horario_pasado', 'fecha_fuera_de_rango', 'servicio_inexistente',
      'dia_cerrado', 'dia_sin_turnos', 'fuera_de_horario', 'horario_invalido', 'tope_turnos', 'sin_profesionales', 'horario_ocupado']) {
      expect(describirErrorReserva(dePg(c)).texto, c).not.toMatch(/salió mal/i);
    }
  });
  it('un código desconocido o un corte de red cae en el mensaje general', () => {
    expect(describirErrorReserva(dePg('algo_raro')).texto).toMatch(/salió mal/i);
    expect(describirErrorReserva(new TypeError('Failed to fetch')).texto).toMatch(/conexión/i);
  });
});
