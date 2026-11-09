import { describe, expect, it } from 'vitest';
import { buscarClientes, fichaCliente, servicioEnUso } from './clientes';
import type { Cliente, Turno } from './types';

const clientes: Cliente[] = [
  { id: 'c1', nombre: 'Martín Gómez', whatsapp: '3496 40-1000' },
  { id: 'c2', nombre: 'Sofía Benítez', whatsapp: '3496 47-1731', notas: 'Máquina 2' },
  { id: 'c3', nombre: 'Julián Acosta', whatsapp: '' },
];
const t = (over: Partial<Turno>): Turno => ({
  id: 't', fecha: '2026-11-01', hora: '10:00', profesionalId: 'p1', servicioId: 's1', clienteId: 'c1',
  estado: 'atendido', origen: 'online', ...over,
});

describe('fichaCliente', () => {
  it('cuenta solo turnos atendidos y toma la última fecha', () => {
    const f = fichaCliente(clientes[0], [
      t({ fecha: '2026-11-01' }), t({ fecha: '2026-11-04' }),
      t({ fecha: '2026-11-05', estado: 'cancelado' }), t({ fecha: '2026-11-06', estado: 'ausente' }),
      t({ fecha: '2026-11-03', clienteId: 'c2' }),
    ]);
    expect(f.visitas).toBe(2);
    expect(f.ultimaVisita).toBe('2026-11-04');
  });
  it('sin visitas: cero y sin fecha', () => {
    expect(fichaCliente(clientes[2], [])).toMatchObject({ visitas: 0, ultimaVisita: undefined });
  });
});

describe('buscarClientes', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(buscarClientes(clientes, 'martin').map((c) => c.id)).toEqual(['c1']);
    expect(buscarClientes(clientes, 'JULIAN').map((c) => c.id)).toEqual(['c3']);
  });
  it('busca por dígitos del WhatsApp sin importar el formato', () => {
    expect(buscarClientes(clientes, '471731').map((c) => c.id)).toEqual(['c2']);
    expect(buscarClientes(clientes, '3496-47').map((c) => c.id)).toEqual(['c2']);
  });
  it('consulta vacía devuelve todos y pocos dígitos no matchean teléfonos', () => {
    expect(buscarClientes(clientes, '  ')).toHaveLength(3);
    expect(buscarClientes(clientes, '3')).toHaveLength(0);
  });
});

describe('servicioEnUso', () => {
  it('detecta uso en cualquiera de las listas', () => {
    expect(servicioEnUso('s1', [t({})], [])).toBe(true);
    expect(servicioEnUso('s9', [t({})], [{ servicioId: 's9' }])).toBe(true);
    expect(servicioEnUso('s9', [t({})], [])).toBe(false);
  });
});
