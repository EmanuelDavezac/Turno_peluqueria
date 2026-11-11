import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Escritor } from './escritor';

/** Deja correr las promesas pendientes (la cola de envíos es una cadena de promesas). */
const asentar = () => vi.advanceTimersByTimeAsync(0);

describe('Escritor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('junta los cambios de la misma clave y manda un solo pedido', async () => {
    const e = new Escritor(400);
    const enviar = vi.fn().mockResolvedValue(undefined);
    e.programar('dia:2', { modalidad: 'turnos' }, enviar);
    e.programar('dia:2', { franjas: [{ desde: '09:00', hasta: '12:00' }] }, enviar);
    expect(e.leer().estado).toBe('guardando');
    await vi.advanceTimersByTimeAsync(400);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledWith({ modalidad: 'turnos', franjas: [{ desde: '09:00', hasta: '12:00' }] });
    expect(e.leer().estado).toBe('ok');
  });

  it('no manda nada antes de que pase la demora', async () => {
    const e = new Escritor(400);
    const enviar = vi.fn().mockResolvedValue(undefined);
    e.programar('k', { a: 1 }, enviar);
    await vi.advanceTimersByTimeAsync(399);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('manda de a uno y en orden entre claves distintas', async () => {
    const e = new Escritor(0);
    const orden: string[] = [];
    let soltar!: () => void;
    const lento = vi.fn(() => new Promise<void>((r) => (soltar = () => { orden.push('a'); r(); })));
    const rapido = vi.fn(async () => { orden.push('b'); });
    e.programar('a', { x: 1 }, lento);
    e.programar('b', { x: 1 }, rapido);
    await asentar();
    expect(rapido).not.toHaveBeenCalled(); // espera a que termine el primero
    soltar();
    await asentar();
    expect(orden).toEqual(['a', 'b']);
  });

  it('si falla, pasa a error con un mensaje claro y reintentar lo vuelve a mandar', async () => {
    const e = new Escritor(0);
    const enviar = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(undefined);
    e.programar('k', { nombre: 'Corte' }, enviar);
    await asentar();
    const s = e.leer();
    expect(s.estado).toBe('error');
    expect(s.estado === 'error' && s.mensaje).toMatch(/conexión/i);

    e.reintentar();
    await asentar();
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar).toHaveBeenLastCalledWith({ nombre: 'Corte' });
    expect(e.leer().estado).toBe('ok');
  });

  it('un cambio nuevo sobre lo que falló no pierde el cambio viejo', async () => {
    const e = new Escritor(0);
    const enviar = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(undefined);
    e.programar('k', { nombre: 'Corte' }, enviar);
    await asentar();
    e.programar('k', { precio: 5 }, enviar);
    await asentar();
    expect(enviar).toHaveBeenLastCalledWith({ nombre: 'Corte', precio: 5 });
    expect(e.leer().estado).toBe('ok');
  });

  it('vaciar() manda ya lo que está esperando', async () => {
    const e = new Escritor(10_000);
    const enviar = vi.fn().mockResolvedValue(undefined);
    e.programar('k', { a: 1 }, enviar);
    e.vaciar();
    await asentar();
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('avisa a los suscriptores solo cuando cambia el estado', async () => {
    const e = new Escritor(0);
    const oyente = vi.fn();
    e.suscribir(oyente);
    e.programar('k', { a: 1 }, async () => {});
    e.programar('k', { a: 2 }, async () => {});
    await asentar();
    // ok → guardando → ok
    expect(oyente).toHaveBeenCalledTimes(2);
  });
});
