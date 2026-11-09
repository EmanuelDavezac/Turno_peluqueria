-- reservar(): validaciones de negocio, tope por WhatsApp, elección de profesional.
-- Se ejecuta como anon para verificar también los permisos.
begin;
select plan(29);

insert into profesionales (id, nombre) values ('00000000-0000-0000-0000-0000000000a1', 'Pro A');
insert into servicios (id, nombre, duracion_min, precio) values
  ('00000000-0000-0000-0000-0000000000b1', 'Corte', 30, 1000),
  ('00000000-0000-0000-0000-0000000000b2', 'Color', 90, 5000);

-- Calendario de prueba (cada fecha cae en un día de la semana distinto):
--   hoy+3 turnos 09-13 · hoy+4 cerrado · hoy+5 llegada · hoy+6 cerrado con excepción
--   hoy+8 (cerrado por semana) con excepción que abre 10-12 · hoy+0 turnos 00:00-02:00
update semana set modalidad = 'turnos',  franjas = '[{"desde":"09:00","hasta":"13:00"}]' where dia = extract(dow from hoy_ar() + 3)::int;
update semana set modalidad = 'cerrado', franjas = '[]'                                   where dia = extract(dow from hoy_ar() + 4)::int;
update semana set modalidad = 'llegada', franjas = '[{"desde":"09:00","hasta":"13:00"}]' where dia = extract(dow from hoy_ar() + 5)::int;
update semana set modalidad = 'turnos',  franjas = '[{"desde":"09:00","hasta":"13:00"}]' where dia = extract(dow from hoy_ar() + 6)::int;
update semana set modalidad = 'turnos',  franjas = '[{"desde":"00:00","hasta":"02:00"}]' where dia = extract(dow from hoy_ar())::int;
insert into excepciones (fecha, modalidad, franjas, motivo) values
  (hoy_ar() + 6, 'cerrado', '[]', 'Feriado'),
  (hoy_ar() + 8, 'turnos', '[{"desde":"10:00","hasta":"12:00"}]', 'Abre extra');

set local role anon;

-- ---------- Camino feliz ----------
select lives_ok(
  $$select * from reservar(hoy_ar() + 3, '09:00', '00000000-0000-0000-0000-0000000000b1', 'Ana Pérez', '3496 11-2233')$$,
  'reserva válida');

select results_eq(
  $$select turno_fecha, turno_hora from reservar(hoy_ar() + 3, '09:30', '00000000-0000-0000-0000-0000000000b1', 'Ana P.', '3496-112233')$$,
  $$values (hoy_ar() + 3, '09:30'::time)$$,
  'devuelve fecha y hora del turno');

reset role;
select is((select count(*)::int from clientes), 1, 'el mismo WhatsApp (otro formato) reutiliza al cliente');
select is((select nombre from clientes), 'Ana Pérez', 'el cliente conserva el nombre original');
select is((select count(*)::int from turnos where origen = 'online' and duracion_min = 30), 2, 'turnos creados como online con la duración del servicio');
set local role anon;

-- ---------- Tope por WhatsApp ----------
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '10:00', '00000000-0000-0000-0000-0000000000b1', 'Ana', '3496112233')$$,
  'P0001', 'tope_turnos', 'tercer turno vivo del mismo WhatsApp: rechazado');

-- ---------- Día ----------
select throws_ok(
  $$select * from reservar(hoy_ar() + 4, '09:00', '00000000-0000-0000-0000-0000000000b1', 'Luis', '3496 200001')$$,
  'P0001', 'dia_cerrado', 'día cerrado');
select throws_ok(
  $$select * from reservar(hoy_ar() + 5, '09:00', '00000000-0000-0000-0000-0000000000b1', 'Luis', '3496 200001')$$,
  'P0001', 'dia_sin_turnos', 'día por orden de llegada: no se reserva');
select throws_ok(
  $$select * from reservar(hoy_ar() + 6, '09:00', '00000000-0000-0000-0000-0000000000b1', 'Luis', '3496 200001')$$,
  'P0001', 'dia_cerrado', 'la excepción cierra un día que la semana tenía abierto');
select lives_ok(
  $$select * from reservar(hoy_ar() + 8, '10:00', '00000000-0000-0000-0000-0000000000b1', 'Luis', '3496 200001')$$,
  'la excepción abre un día que la semana tenía cerrado');

-- ---------- Horario ----------
select throws_ok(
  $$select * from reservar(hoy_ar() - 1, '09:00', '00000000-0000-0000-0000-0000000000b1', 'Luis', '3496 200002')$$,
  'P0001', 'horario_pasado', 'fecha pasada');
select throws_ok(
  $$select * from reservar(hoy_ar(), '00:00', '00000000-0000-0000-0000-0000000000b1', 'Luis', '3496 200002')$$,
  'P0001', 'horario_pasado', 'hora que ya pasó hoy');
select throws_ok(
  $$select * from reservar(hoy_ar() + 45, '09:00', '00000000-0000-0000-0000-0000000000b1', 'Luis', '3496 200002')$$,
  'P0001', 'fecha_fuera_de_rango', 'fecha demasiado lejana');
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '08:00', '00000000-0000-0000-0000-0000000000b1', 'Luis', '3496 200002')$$,
  'P0001', 'fuera_de_horario', 'antes de abrir');
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '12:45', '00000000-0000-0000-0000-0000000000b1', 'Luis', '3496 200002')$$,
  'P0001', 'fuera_de_horario', 'el servicio no entra antes del cierre de la franja');
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '12:00', '00000000-0000-0000-0000-0000000000b2', 'Luis', '3496 200002')$$,
  'P0001', 'fuera_de_horario', 'servicio largo que se pasa del cierre');
select lives_ok(
  $$select * from reservar(hoy_ar() + 3, '11:30', '00000000-0000-0000-0000-0000000000b2', 'Luis', '3496 200002')$$,
  'servicio largo que termina justo al cierre: permitido');
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '10:15', '00000000-0000-0000-0000-0000000000b1', 'Luis', '3496 200003')$$,
  'P0001', 'horario_invalido', 'fuera de la grilla de 30 minutos');

-- ---------- Datos ----------
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '10:00', '00000000-0000-0000-0000-0000000000b1', '   ', '3496 200004')$$,
  'P0001', 'nombre_invalido', 'nombre vacío');
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '10:00', '00000000-0000-0000-0000-0000000000b1', 'Luis', '123')$$,
  'P0001', 'whatsapp_invalido', 'WhatsApp demasiado corto');
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '10:00', '00000000-0000-0000-0000-0000000000b1', 'Luis', null)$$,
  'P0001', 'whatsapp_invalido', 'WhatsApp nulo');
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '10:00', '00000000-0000-0000-0000-00000000ffff', 'Luis', '3496 200004')$$,
  'P0001', 'servicio_inexistente', 'servicio que no existe');

-- ---------- Ocupación y profesionales ----------
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '09:00', '00000000-0000-0000-0000-0000000000b1', 'Marta', '3496 300001')$$,
  'P0001', 'horario_ocupado', 'con un solo profesional, un horario tomado se rechaza');

reset role;
insert into profesionales (id, nombre) values ('00000000-0000-0000-0000-0000000000a2', 'Pro B');
set local role anon;

select lives_ok(
  $$select * from reservar(hoy_ar() + 3, '09:00', '00000000-0000-0000-0000-0000000000b1', 'Marta', '3496 300001')$$,
  'con dos profesionales, el segundo toma el horario que dejó el primero');
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '09:00', '00000000-0000-0000-0000-0000000000b1', 'Nora', '3496 300002')$$,
  'P0001', 'horario_ocupado', 'ambos ocupados: rechazado');

reset role;
select is(
  (select count(distinct profesional_id)::int from turnos where fecha = hoy_ar() + 3 and hora = '09:00'),
  2, 'los dos turnos de las 09:00 quedaron con profesionales distintos');

update turnos set estado = 'cancelado' where fecha = hoy_ar() + 3 and hora = '09:00' and profesional_id = '00000000-0000-0000-0000-0000000000a1';
set local role anon;
select lives_ok(
  $$select * from reservar(hoy_ar() + 3, '09:00', '00000000-0000-0000-0000-0000000000b1', 'Nora', '3496 300002')$$,
  'un turno cancelado libera el horario');

-- Ana tenía 2 turnos vivos (tope): al cancelar uno vuelve a poder reservar.
reset role;
update turnos set estado = 'cancelado' where cliente_id = (select id from clientes where whatsapp_digitos = '3496112233') and hora = '09:00';
set local role anon;
select lives_ok(
  $$select * from reservar(hoy_ar() + 3, '10:00', '00000000-0000-0000-0000-0000000000b1', 'Ana', '3496112233')$$,
  'cancelar un turno libera cupo en el tope por WhatsApp');

reset role;
update profesionales set activo = false;
set local role anon;
select throws_ok(
  $$select * from reservar(hoy_ar() + 3, '12:00', '00000000-0000-0000-0000-0000000000b1', 'Zoe', '3496 400001')$$,
  'P0001', 'sin_profesionales', 'sin profesionales activos');

select * from finish();
rollback;
