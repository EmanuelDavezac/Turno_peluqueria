import { describe, expect, it } from 'vitest';
import { leerTodo } from './paginar';

/** Una "tabla" de n filas que responde por rangos, como la API. */
const tabla = (n: number) => (desde: number, hasta: number) =>
  Promise.resolve({ data: Array.from({ length: n }, (_, i) => i).slice(desde, hasta + 1), error: null });

describe('leerTodo', () => {
  it('junta todas las páginas', async () => {
    const r = await leerTodo(tabla(2500), 1000);
    expect(r).toHaveLength(2500);
    expect(r[0]).toBe(0);
    expect(r.at(-1)).toBe(2499);
  });
  it('si la última página viene justa, pide una más y termina', async () => {
    let pedidos = 0;
    const r = await leerTodo((a, b) => {
      pedidos++;
      return tabla(2000)(a, b);
    }, 1000);
    expect(r).toHaveLength(2000);
    expect(pedidos).toBe(3);
  });
  it('tabla vacía y tabla corta', async () => {
    expect(await leerTodo(tabla(0), 1000)).toEqual([]);
    expect(await leerTodo(tabla(5), 1000)).toHaveLength(5);
  });
  it('si una página falla, falla todo (no devuelve datos a medias)', async () => {
    let n = 0;
    const falla = (a: number, b: number) =>
      ++n === 2 ? Promise.resolve({ data: null, error: { code: '57014' } }) : tabla(5000)(a, b);
    await expect(leerTodo(falla, 1000)).rejects.toEqual({ code: '57014' });
  });
});
