/**
 * Integración contra el Supabase REMOTO con la capa de datos real del front (horarios.ts, catalogo.ts).
 * Todo lo que crea lleva el prefijo "ZZ-PRUEBA". Al final imprime qué quedó para borrar a mano.
 * Corre con `npm run test:remoto` (nunca con `npm test`).
 */
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codigoDe, describirError, esErrorDeRed } from '../errores';
import * as catalogo from './catalogo';
import { supabase } from './client';
import * as horarios from './horarios';

const URL = process.env.VITE_SUPABASE_URL!;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const anon = createClient(URL, KEY); // el público: sin sesión

const P = 'ZZ-PRUEBA';
const hoyAR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
const mas = (n: number) => {
  const d = new Date(`${hoyAR}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const FECHA_TURNOS = mas(3);
const WSP = '3490000999'; // número de prueba

const creado = {
  profesionalId: '', servicioId: '', servicioLibreId: '',
  excepcionIds: [] as string[], turnoId: '', filaId: '',
};

describe.skipIf(!process.env.PRUEBA_EMAIL)('remoto (panel + público)', () => {
  beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: process.env.PRUEBA_EMAIL!, password: process.env.PRUEBA_PASSWORD! });
    expect(error).toBeNull();
  });

  afterAll(async () => {
    // Deja el remoto sin configuración de prueba activa: las excepciones se sacan; lo demás lo lista para borrar.
    for (const id of creado.excepcionIds) await horarios.borrarExcepcion(id).catch(() => {});
    if (creado.turnoId) await horarios.cancelarTurnos([creado.turnoId]).catch(() => {});
    if (creado.filaId) await anon.rpc('salir_de_fila', { p_id: creado.filaId });
    console.log('\n=== DATOS DE PRUEBA QUE QUEDARON EN EL REMOTO ===\n' + JSON.stringify(creado, null, 2));
    await supabase.auth.signOut();
  });

  it('el usuario de prueba entra al panel (es_panel)', async () => {
    const { data, error } = await supabase.rpc('es_panel');
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it('carga horarios: 7 días de semana', async () => {
    const h = await horarios.leerHorarios();
    expect(h.semana.map((d) => d.dia)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(Array.isArray(h.excepciones)).toBe(true);
  });

  it('edita un día de la semana y lo deja como estaba', async () => {
    const antes = (await horarios.leerHorarios()).semana.find((d) => d.dia === 1)!;
    try {
      await horarios.guardarDia(1, { modalidad: 'turnos', franjas: [{ desde: '09:00', hasta: '12:00' }] });
      const d = (await horarios.leerHorarios()).semana.find((x) => x.dia === 1)!;
      expect(d.modalidad).toBe('turnos');
      expect(d.franjas).toEqual([{ desde: '09:00', hasta: '12:00' }]);
    } finally {
      await horarios.guardarDia(1, { modalidad: antes.modalidad, franjas: antes.franjas });
    }
    const final = (await horarios.leerHorarios()).semana.find((d) => d.dia === 1)!;
    expect(final).toEqual(antes);
  });

  it('franjas inválidas: la base rechaza y el mensaje es claro', async () => {
    const e = await horarios.guardarDia(1, { franjas: [{ desde: '13:00', hasta: '12:00' }] }).then(() => null, (x) => x);
    expect(codigoDe(e)).toBe('23514');
    expect(describirError(e)).toMatch(/no es válido/i);
  });

  it('equipo y servicios: crear, editar, releer', async () => {
    // Reutiliza lo de una corrida anterior para no duplicar datos de prueba.
    const previo = await catalogo.leerCatalogo();
    const p =
      previo.profesionales.find((x) => x.nombre === `${P} Pro`) ??
      (await catalogo.crearProfesional({ nombre: `${P} Pro`, color: '#2a6f6b', comisionPct: 50, activo: true }));
    creado.profesionalId = p.id;
    await catalogo.guardarProfesional(p.id, { comisionPct: 35.5, color: '#112233' });

    const s =
      previo.servicios.find((x) => x.nombre === `${P} Corte`) ??
      (await catalogo.crearServicio({ nombre: `${P} Corte`, duracionMin: 30, precio: 1 }));
    creado.servicioId = s.id;
    const libre = await catalogo.crearServicio({ nombre: `${P} Libre`, duracionMin: 20, precio: 1 });
    creado.servicioLibreId = libre.id;
    await catalogo.guardarServicio(s.id, { duracionMin: 45, precio: 2 });

    const c = await catalogo.leerCatalogo();
    expect(c.profesionales.find((x) => x.id === p.id)).toMatchObject({ comisionPct: 35.5, color: '#112233', activo: true });
    expect(c.servicios.find((x) => x.id === s.id)).toMatchObject({ duracionMin: 45, precio: 2 });
  });

  it('datos inválidos de equipo/servicio los rechaza la base', async () => {
    const e1 = await catalogo.guardarProfesional(creado.profesionalId, { color: 'rojo' }).then(() => null, (x) => x);
    expect(codigoDe(e1)).toBe('23514');
    const e2 = await catalogo.guardarServicio(creado.servicioId, { duracionMin: 1 }).then(() => null, (x) => x);
    expect(codigoDe(e2)).toBe('23514');
  });

  it('excepción: una por fecha, la nueva reemplaza a la anterior', async () => {
    const a = await horarios.crearExcepcion({ fecha: FECHA_TURNOS, modalidad: 'cerrado', franjas: [], motivo: `${P} a` });
    creado.excepcionIds.push(a.id);
    const b = await horarios.crearExcepcion({ fecha: FECHA_TURNOS, modalidad: 'turnos', franjas: [{ desde: '09:00', hasta: '13:00' }], motivo: `${P} b` });
    expect(b.id).toBe(a.id); // mismo registro, reemplazado
    const lista = (await horarios.leerHorarios()).excepciones.filter((x) => x.fecha === FECHA_TURNOS);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ modalidad: 'turnos', motivo: `${P} b` });
  });

  it('el público lee servicios y horarios, y NO lee datos privados ni la comisión', async () => {
    expect((await anon.from('servicios').select('id').eq('id', creado.servicioId)).data).toHaveLength(1);
    expect((await anon.from('excepciones').select('id').eq('fecha', FECHA_TURNOS)).data).toHaveLength(1);
    const pro = await anon.from('profesionales').select('id, nombre, activo').eq('id', creado.profesionalId);
    expect(pro.data).toHaveLength(1);
    for (const t of ['turnos', 'clientes', 'fila', 'cobros', 'cajas_cerradas']) {
      const r = await anon.from(t).select('*').limit(1);
      expect(r.error?.code, t).toBe('42501');
    }
    expect((await anon.from('profesionales').select('comision_pct').limit(1)).error?.code).toBe('42501');
  });

  it('reservar (anónimo): ocupa el horario y lo ve ocupados(); el panel lo ve y puede cancelarlo', async () => {
    const r = await anon.rpc('reservar', { p_fecha: FECHA_TURNOS, p_hora: '10:00', p_servicio: creado.servicioId, p_nombre: `${P} Cliente`, p_whatsapp: WSP });
    expect(r.error).toBeNull();
    const fila = (r.data as { turno_id: string; turno_fecha: string; turno_hora: string }[])[0];
    creado.turnoId = fila.turno_id;
    expect(fila.turno_fecha).toBe(FECHA_TURNOS);

    const oc = await anon.rpc('ocupados', { p_desde: FECHA_TURNOS, p_hasta: FECHA_TURNOS });
    expect(oc.error).toBeNull();
    expect((oc.data as { ini: number; fin: number }[]).some((x) => x.ini === 600 && x.fin === 645)).toBe(true); // 45 min

    const doble = await anon.rpc('reservar', { p_fecha: FECHA_TURNOS, p_hora: '10:30', p_servicio: creado.servicioId, p_nombre: `${P} Otro`, p_whatsapp: '3490000998' });
    expect(doble.error?.message).toBe('horario_ocupado');

    const vivos = await horarios.turnosVivos(hoyAR);
    expect(vivos.find((t) => t.id === creado.turnoId)).toMatchObject({ fecha: FECHA_TURNOS, hora: '10:00', estado: 'reservado' });
  });

  it('borrar un servicio con turnos lo rechaza la base (FK) con mensaje claro; uno libre se borra', async () => {
    const e = await catalogo.borrarServicio(creado.servicioId).then(() => null, (x) => x);
    expect(codigoDe(e)).toBe('23503');
    expect(describirError(e)).toMatch(/dependen/i);
    await catalogo.borrarServicio(creado.servicioLibreId);
    creado.servicioLibreId = '';
  });

  it('cancelar turnos (regla 8): el horario se libera', async () => {
    await horarios.cancelarTurnos([creado.turnoId]);
    const vivos = await horarios.turnosVivos(hoyAR);
    expect(vivos.find((t) => t.id === creado.turnoId)).toBeUndefined();
    const oc = await anon.rpc('ocupados', { p_desde: FECHA_TURNOS, p_hasta: FECHA_TURNOS });
    expect((oc.data as unknown[]).length).toBe(0);
  });

  it('anotar_fila (anónimo): hoy con excepción "llegada"', async () => {
    const e = await horarios.crearExcepcion({ fecha: hoyAR, modalidad: 'llegada', franjas: [{ desde: '00:00', hasta: '23:59' }], motivo: `${P} fila` });
    creado.excepcionIds.push(e.id);
    const r = await anon.rpc('anotar_fila', { p_servicio: creado.servicioId, p_nombre: `${P} Fila`, p_whatsapp: null, p_preferido: null });
    expect(r.error).toBeNull();
    const f = (r.data as { entrada_id: string; numero_fila: number }[])[0];
    creado.filaId = f.entrada_id;
    expect(f.numero_fila).toBeGreaterThan(0);

    const t = await anon.rpc('mi_ticket', { p_id: f.entrada_id });
    expect(t.error).toBeNull();
    const est = await anon.rpc('estado_fila_publico');
    expect((est.data as { en_espera: number }[])[0].en_espera).toBeGreaterThanOrEqual(1);

    const s = await anon.rpc('salir_de_fila', { p_id: f.entrada_id });
    expect(s.data).toBe(true);
    creado.filaId = '';
  });

  it('sin conexión: el error se reconoce como de red y el mensaje es claro', async () => {
    const roto = createClient('http://127.0.0.1:9', KEY);
    const { error } = await roto.from('semana').select('dia');
    expect(error).toBeTruthy();
    expect(esErrorDeRed(error)).toBe(true);
    expect(describirError(error)).toMatch(/conexión/i);
  });
});
