-- RLS y permisos: el anónimo no lee datos personales ni escribe nada;
-- tener cuenta en Auth no alcanza para entrar al panel.
begin;
select plan(27);

-- ---------- Fixtures (como postgres) ----------
insert into profesionales (id, nombre, comision_pct) values ('00000000-0000-0000-0000-0000000000a1', 'Pro A', 40);
insert into profesionales (id, nombre, activo) values ('00000000-0000-0000-0000-0000000000a2', 'Pro inactivo', false);
insert into servicios (id, nombre, duracion_min, precio) values ('00000000-0000-0000-0000-0000000000b1', 'Corte', 30, 1000);
insert into clientes (id, nombre, whatsapp) values ('00000000-0000-0000-0000-0000000000c1', 'Cliente Secreto', '3496 123456');
insert into turnos (id, fecha, hora, profesional_id, servicio_id, cliente_id) values
  ('00000000-0000-0000-0000-0000000000d1', hoy_ar() + 1, '10:00',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
insert into cobros (fecha, hora, profesional_id, servicio_id, cliente_nombre, monto, medio, origen) values
  (hoy_ar(), '12:00', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'X', 1000, 'efectivo', 'turno');
insert into cajas_cerradas (fecha) values (hoy_ar() - 1);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f001', 'panel@test.local'),
  ('00000000-0000-0000-0000-00000000f002', 'otro@test.local');
insert into usuarios_panel (user_id) values ('00000000-0000-0000-0000-00000000f001');

-- ======================= ANÓNIMO =======================
set local role anon;

select throws_ok('select * from turnos',          '42501', null, 'anon: no lee turnos');
select throws_ok('select * from clientes',        '42501', null, 'anon: no lee clientes');
select throws_ok('select * from cobros',          '42501', null, 'anon: no lee cobros');
select throws_ok('select * from cajas_cerradas',  '42501', null, 'anon: no lee la caja');
select throws_ok('select * from usuarios_panel',  '42501', null, 'anon: no lee usuarios del panel');
select throws_ok('select comision_pct from profesionales', '42501', null, 'anon: no ve la comisión');
select throws_ok('select * from profesionales',   '42501', null, 'anon: select * de profesionales (columnas privadas) denegado');

select is((select count(*)::int from profesionales), 1, 'anon: ve solo profesionales activos (id, nombre, activo)');
select is((select count(*)::int from servicios), 1, 'anon: lee servicios');
select lives_ok('select * from semana',      'anon: lee la semana');
select lives_ok('select * from excepciones', 'anon: lee excepciones');
select lives_ok('select * from negocio',     'anon: lee el negocio');

select throws_ok($$insert into servicios (nombre, duracion_min, precio) values ('Hack', 30, 1)$$, '42501', null, 'anon: no inserta servicios');
select throws_ok($$update negocio set nombre = 'Hack'$$, '42501', null, 'anon: no modifica el negocio');
select throws_ok($$insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id, duracion_min)
  values (hoy_ar() + 2, '11:00', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
          '00000000-0000-0000-0000-0000000000c1', 30)$$, '42501', null, 'anon: no inserta turnos directo');

-- Funciones internas y de panel: no ejecutables por el anónimo.
select throws_ok($$select hay_turno_en('00000000-0000-0000-0000-0000000000a1', hoy_ar(), 0, 10)$$, '42501', null, 'anon: no ejecuta funciones internas');
select throws_ok($$select cobrar_turno('00000000-0000-0000-0000-0000000000d1', 'efectivo', 1)$$, '42501', null, 'anon: no cobra');

-- Lo único que ve de los turnos: rangos ocupados, sin datos personales.
select results_eq(
  $$select ini, fin from ocupados(hoy_ar() + 1, hoy_ar() + 1)$$,
  $$values (600, 630)$$,
  'anon: ocupados() devuelve solo el rango horario');
select throws_ok($$select * from ocupados(hoy_ar() - 3, hoy_ar())$$, 'P0001', 'rango_invalido', 'anon: ocupados() rechaza fechas pasadas');

-- ======================= LOGUEADO SIN SER DEL PANEL =======================
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f002","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from turnos),   0, 'cuenta común: no ve turnos');
select is((select count(*)::int from clientes), 0, 'cuenta común: no ve clientes');
select is((select count(*)::int from cobros),   0, 'cuenta común: no ve cobros');
select throws_ok($$insert into clientes (nombre) values ('Hack')$$, '42501', null, 'cuenta común: no inserta clientes');
select throws_ok($$select cobrar_turno('00000000-0000-0000-0000-0000000000d1', 'efectivo', 1)$$, '42501', 'no_autorizado', 'cuenta común: no cobra');

-- ======================= PANEL =======================
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from turnos),   1, 'panel: ve turnos');
select is((select count(*)::int from clientes), 1, 'panel: ve clientes');
select throws_ok($$delete from turnos$$, '42501', null, 'panel: no borra turnos (se cancelan)');

select * from finish();
rollback;
