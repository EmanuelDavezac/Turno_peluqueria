-- Integridad en la base: superposición de turnos, número correlativo de la fila
-- y el sillón ocupado por la fila.
begin;
select plan(17);

insert into profesionales (id, nombre) values
  ('00000000-0000-0000-0000-0000000000a1', 'Pro A'),
  ('00000000-0000-0000-0000-0000000000a2', 'Pro B');
insert into servicios (id, nombre, duracion_min, precio) values
  ('00000000-0000-0000-0000-0000000000b1', 'Corte', 30, 1000);
insert into clientes (id, nombre, whatsapp) values
  ('00000000-0000-0000-0000-0000000000c1', 'Cliente', '3496 123456');

-- ---------- Turnos: sin superposición ----------
insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id)
values (hoy_ar() + 1, '10:00', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
        '00000000-0000-0000-0000-0000000000c1');

select is((select duracion_min from turnos limit 1), 30, 'la duración se copia del servicio al crear el turno');

select throws_ok(
  $$insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id)
    values (hoy_ar() + 1, '10:15', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000c1')$$,
  '23P01', null, 'turno superpuesto del mismo profesional: rechazado');

select throws_ok(
  $$insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id)
    values (hoy_ar() + 1, '10:00', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000c1')$$,
  '23P01', null, 'mismo horario exacto: rechazado');

select lives_ok(
  $$insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id)
    values (hoy_ar() + 1, '10:30', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000c1')$$,
  'turno contiguo (empieza donde termina el anterior): permitido');

select lives_ok(
  $$insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id)
    values (hoy_ar() + 1, '10:00', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000c1')$$,
  'mismo horario con otro profesional: permitido');

update turnos set estado = 'cancelado'
 where fecha = hoy_ar() + 1 and hora = '10:00' and profesional_id = '00000000-0000-0000-0000-0000000000a1';
select lives_ok(
  $$insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id)
    values (hoy_ar() + 1, '10:00', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000c1')$$,
  'un turno cancelado libera el horario');

insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id, estado)
values (hoy_ar() + 2, '14:00', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
        '00000000-0000-0000-0000-0000000000c1', 'atendido');
select throws_ok(
  $$insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id)
    values (hoy_ar() + 2, '14:00', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000c1')$$,
  '23P01', null, 'un turno atendido sigue ocupando su horario');

select throws_ok(
  $$update turnos set hora = '10:45'
     where fecha = hoy_ar() + 1 and hora = '10:00' and profesional_id = '00000000-0000-0000-0000-0000000000a1'
       and estado = 'reservado'$$,
  '23P01', null, 'mover un turno encima de otro: rechazado');

-- ---------- Fila: número correlativo ----------
select throws_ok(
  $$insert into fila (fecha, numero, servicio_id, duracion_min)
    values (hoy_ar(), 7, '00000000-0000-0000-0000-0000000000b1', 30),
           (hoy_ar(), 7, '00000000-0000-0000-0000-0000000000b1', 30)$$,
  '23505', null, 'dos entradas con el mismo número el mismo día: rechazado');

select lives_ok(
  $$insert into fila (fecha, numero, servicio_id, duracion_min)
    values (hoy_ar() + 30, 1, '00000000-0000-0000-0000-0000000000b1', 30),
           (hoy_ar() + 31, 1, '00000000-0000-0000-0000-0000000000b1', 30)$$,
  'el número se reinicia cada día');

create temp table nums as
  select (anotar_fila_interno('00000000-0000-0000-0000-0000000000b1', 'N' || i, null, null, 'local')).numero as n
    from generate_series(1, 4) i;
select is((select array_agg(n order by n) from nums), array[1, 2, 3, 4], 'anotar_fila_interno asigna 1, 2, 3, 4 correlativos');

-- ---------- Fila: el sillón ----------
select throws_ok(
  $$insert into fila (numero, servicio_id, duracion_min, estado, profesional_id, inicio_at)
    values (90, '00000000-0000-0000-0000-0000000000b1', 30, 'atendiendo', '00000000-0000-0000-0000-0000000000a1', ahora_ar()),
           (91, '00000000-0000-0000-0000-0000000000b1', 30, 'atendiendo', '00000000-0000-0000-0000-0000000000a1', ahora_ar())$$,
  '23505', null, 'un profesional no atiende a dos de la fila a la vez');

select throws_ok(
  $$insert into fila (numero, servicio_id, duracion_min, estado) values (92, '00000000-0000-0000-0000-0000000000b1', 30, 'atendiendo')$$,
  '23514', null, 'atendiendo exige profesional y hora de inicio');

-- Quien está en el sillón por la fila ocupa al profesional. Se usa mañana para no depender de la hora actual.
insert into fila (fecha, numero, servicio_id, duracion_min, estado, profesional_id, inicio_at)
values (hoy_ar() + 3, 1, '00000000-0000-0000-0000-0000000000b1', 30, 'atendiendo',
        '00000000-0000-0000-0000-0000000000a1', (hoy_ar() + 3) + time '11:00');

select throws_ok(
  $$insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id)
    values (hoy_ar() + 3, '11:15', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000c1')$$,
  'P0001', 'horario_ocupado', 'turno encima de quien está en el sillón: rechazado');

select lives_ok(
  $$insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id)
    values (hoy_ar() + 3, '11:30', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000c1')$$,
  'turno que empieza cuando termina la atención de la fila: permitido');

select lives_ok(
  $$insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id)
    values (hoy_ar() + 3, '11:15', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000c1')$$,
  'el sillón de A no bloquea a B');

select results_eq(
  $$select profesional_id::text, ini, fin from ocupados(hoy_ar() + 3, hoy_ar() + 3) where ini = 660$$,
  $$values ('00000000-0000-0000-0000-0000000000a1', 660, 690)$$,
  'ocupados() incluye a quien está en el sillón por la fila');

select * from finish();
rollback;
