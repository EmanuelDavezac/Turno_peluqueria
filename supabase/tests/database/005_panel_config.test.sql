-- Lo que usa el panel para horarios, equipo y servicios (Paso 3 del front):
-- edita con RLS, las claves foráneas protegen lo que está en uso, y quien no es del panel no escribe.
begin;
select plan(19);

-- ---------- Fixtures (como postgres) ----------
insert into profesionales (id, nombre) values ('00000000-0000-0000-0000-0000000000a1', 'Pro A');
insert into servicios (id, nombre, duracion_min, precio) values
  ('00000000-0000-0000-0000-0000000000b1', 'Corte en uso', 30, 1000),
  ('00000000-0000-0000-0000-0000000000b2', 'Corte libre', 30, 1000);
insert into clientes (id, nombre) values ('00000000-0000-0000-0000-0000000000c1', 'Cliente');
insert into turnos (id, fecha, hora, profesional_id, servicio_id, cliente_id) values
  ('00000000-0000-0000-0000-0000000000d1', hoy_ar() + 1, '10:00',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000d2', hoy_ar() + 1, '11:00',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f001', 'panel@test.local'),
  ('00000000-0000-0000-0000-00000000f002', 'otro@test.local');
insert into usuarios_panel (user_id) values ('00000000-0000-0000-0000-00000000f001');

-- ======================= LOGUEADO SIN SER DEL PANEL =======================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f002","role":"authenticated"}', true);
set local role authenticated;

-- RLS filtra en silencio: no falla, pero no toca ninguna fila (el front lo trata como error).
select is_empty($$update semana set modalidad = 'turnos' where dia = 2 returning dia$$, 'cuenta común: update de semana no afecta filas');
select is_empty($$update servicios set precio = 1 returning id$$, 'cuenta común: update de servicios no afecta filas');
select throws_ok($$insert into excepciones (fecha, modalidad, franjas) values (hoy_ar() + 5, 'cerrado', '[]')$$,
  '42501', null, 'cuenta común: no crea excepciones');
select throws_ok($$select cancelar_turnos(array['00000000-0000-0000-0000-0000000000d1']::uuid[])$$,
  '42501', 'no_autorizado', 'cuenta común: no cancela turnos');

-- ======================= PANEL =======================
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated"}', true);
set local role authenticated;

-- Semana
select results_eq($$update semana set modalidad = 'turnos', franjas = '[{"desde":"09:00","hasta":"12:30"},{"desde":"16:00","hasta":"20:00"}]' where dia = 2 returning dia$$,
  $$values (2::smallint)$$, 'panel: edita un día de la semana');
select throws_ok($$update semana set franjas = '[{"desde":"13:00","hasta":"12:00"}]' where dia = 3$$,
  '23514', null, 'panel: la base rechaza franjas con desde >= hasta');
select throws_ok($$update semana set franjas = '[{"desde":"09:00","hasta":"12:00"},{"desde":"11:00","hasta":"14:00"}]' where dia = 3$$,
  '23514', null, 'panel: la base rechaza franjas que se pisan');
select throws_ok($$delete from semana where dia = 2$$, '42501', null, 'panel: la semana no se borra');

-- Excepciones: una por fecha, la nueva reemplaza a la anterior (upsert por fecha)
select lives_ok($$insert into excepciones (fecha, modalidad, franjas, motivo) values (hoy_ar() + 10, 'cerrado', '[]', 'Feriado')$$,
  'panel: crea una excepción');
select throws_ok($$insert into excepciones (fecha, modalidad, franjas) values (hoy_ar() + 10, 'turnos', '[]')$$,
  '23505', null, 'panel: dos excepciones para la misma fecha chocan');
select lives_ok($$insert into excepciones (fecha, modalidad, franjas, motivo) values (hoy_ar() + 10, 'llegada', '[{"desde":"09:00","hasta":"12:00"}]', null)
  on conflict (fecha) do update set modalidad = excluded.modalidad, franjas = excluded.franjas, motivo = excluded.motivo$$,
  'panel: el upsert por fecha reemplaza la excepción');
select is((select count(*)::int from excepciones where fecha = hoy_ar() + 10), 1, 'panel: sigue habiendo una sola excepción por fecha');
select results_eq($$delete from excepciones where fecha = hoy_ar() + 10 returning modalidad::text$$,
  $$values ('llegada')$$, 'panel: borra una excepción');

-- Equipo y servicios
select results_eq($$update profesionales set comision_pct = 35.5, color = '#112233' where id = '00000000-0000-0000-0000-0000000000a1' returning comision_pct$$,
  $$values (35.50::numeric)$$, 'panel: edita comisión y color del profesional');
select throws_ok($$update profesionales set color = 'rojo' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'panel: la base rechaza un color inválido');
select throws_ok($$delete from servicios where id = '00000000-0000-0000-0000-0000000000b1'$$,
  '23503', null, 'panel: no borra un servicio con turnos (clave foránea)');
select lives_ok($$delete from servicios where id = '00000000-0000-0000-0000-0000000000b2'$$, 'panel: borra un servicio sin uso');

-- Cancelar: solo turnos vivos, devuelve cuántos cambió
select is(cancelar_turnos(array['00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2']::uuid[]),
  2, 'panel: cancela turnos vivos');
select is(cancelar_turnos(array['00000000-0000-0000-0000-0000000000d1']::uuid[]),
  0, 'panel: cancelar un turno ya cancelado no cuenta');

select * from finish();
rollback;
