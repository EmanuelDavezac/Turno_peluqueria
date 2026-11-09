-- Fila: alta pública, ticket, y operaciones del panel (llamar, cobrar, cancelar).
-- Hoy se configura como día "llegada" abierto todo el día (00:00-23:59), así que
-- el único minuto en que estas pruebas no aplican es 23:59.
begin;
select plan(40);

insert into profesionales (id, nombre) values ('00000000-0000-0000-0000-0000000000a1', 'Pro A');
insert into servicios (id, nombre, duracion_min, precio) values ('00000000-0000-0000-0000-0000000000b1', 'Corte', 30, 11000);
insert into clientes (id, nombre, whatsapp) values ('00000000-0000-0000-0000-0000000000c1', 'Cliente', '3496 123456');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000f001', 'panel@test.local');
insert into usuarios_panel (user_id) values ('00000000-0000-0000-0000-00000000f001');
update semana set modalidad = 'llegada', franjas = '[{"desde":"00:00","hasta":"23:59"}]' where dia = extract(dow from hoy_ar())::int;

-- ======================= PÚBLICO =======================
set local role anon;

select results_eq(
  $$select numero_fila from anotar_fila('00000000-0000-0000-0000-0000000000b1', 'Luis', '3496 55-6677')$$,
  $$values (1)$$, 'primera persona: número 1');
select results_eq(
  $$select numero_fila from anotar_fila('00000000-0000-0000-0000-0000000000b1', 'Marta', '3496 88-9900')$$,
  $$values (2)$$, 'segunda persona: número 2');
select results_eq(
  $$select numero_fila from anotar_fila('00000000-0000-0000-0000-0000000000b1', 'Sin teléfono')$$,
  $$values (3)$$, 'el WhatsApp es opcional');

select throws_ok($$select * from anotar_fila('00000000-0000-0000-0000-0000000000b1', 'Luis otra vez', '3496556677')$$,
  'P0001', 'ya_en_fila', 'la misma persona no se anota dos veces');
select throws_ok($$select * from anotar_fila('00000000-0000-0000-0000-0000000000b1', '  ', null)$$,
  'P0001', 'nombre_invalido', 'nombre vacío');
select throws_ok($$select * from anotar_fila('00000000-0000-0000-0000-0000000000b1', 'Zoe', '12')$$,
  'P0001', 'whatsapp_invalido', 'WhatsApp inválido');
select throws_ok($$select * from anotar_fila('00000000-0000-0000-0000-00000000ffff', 'Zoe', null)$$,
  'P0001', 'servicio_inexistente', 'servicio inexistente');

select results_eq(
  $$select en_espera, atendiendo, espera_min from estado_fila_publico()$$,
  $$values (3, 0, 90)$$, 'estado público: 3 en espera, 90 min (3 × 30 min con 1 profesional)');

reset role;
select set_config('t.id1', (select id::text from fila where fecha = hoy_ar() and numero = 1), true);
select set_config('t.id2', (select id::text from fila where fecha = hoy_ar() and numero = 2), true);
set local role anon;

select results_eq(
  $$select numero, estado, personas_adelante, espera_min from mi_ticket(current_setting('t.id2')::uuid)$$,
  $$values (2, 'espera'::estado_fila, 1, 30)$$, 'mi_ticket: número 2, una persona adelante, 30 min');
select is_empty($$select * from mi_ticket('00000000-0000-0000-0000-00000000ffff')$$, 'mi_ticket de un id inexistente: vacío');
select throws_ok('select * from fila', '42501', null, 'el ticket no abre la lectura de la fila');

select is((select salir_de_fila(current_setting('t.id2')::uuid)), true, 'salir de la fila');
select is((select estado from mi_ticket(current_setting('t.id2')::uuid)), 'salio'::estado_fila, 'el ticket queda en "salio"');
select is((select salir_de_fila(current_setting('t.id2')::uuid)), false, 'salir dos veces no hace nada');

-- ---------- Días y horarios en que no se puede anotar ----------
reset role;
update semana set modalidad = 'turnos' where dia = extract(dow from hoy_ar())::int;
set local role anon;
select throws_ok($$select * from anotar_fila('00000000-0000-0000-0000-0000000000b1', 'Zoe', null)$$,
  'P0001', 'dia_sin_fila', 'hoy solo con turno: no hay fila');

reset role;
update semana set modalidad = 'mixto' where dia = extract(dow from hoy_ar())::int;
set local role anon;
select lives_ok($$select * from anotar_fila('00000000-0000-0000-0000-0000000000b1', 'Zoe Mixto', null)$$, 'día mixto: hay fila');

reset role;
-- Franja que no incluye el momento actual, sea la hora que sea.
update semana
   set franjas = case when time_min(ahora_ar()::time) < 720
                      then '[{"desde":"22:00","hasta":"23:00"}]'::jsonb
                      else '[{"desde":"01:00","hasta":"02:00"}]'::jsonb end
 where dia = extract(dow from hoy_ar())::int;
set local role anon;
select throws_ok($$select * from anotar_fila('00000000-0000-0000-0000-0000000000b1', 'Zoe', null)$$,
  'P0001', 'fuera_de_horario', 'fuera del horario de atención');

reset role;
update semana set modalidad = 'llegada', franjas = '[{"desde":"00:00","hasta":"23:59"}]' where dia = extract(dow from hoy_ar())::int;
insert into excepciones (fecha, modalidad, franjas) values (hoy_ar(), 'cerrado', '[]');
set local role anon;
select throws_ok($$select * from anotar_fila('00000000-0000-0000-0000-0000000000b1', 'Zoe', null)$$,
  'P0001', 'dia_sin_fila', 'una excepción cierra el día');
reset role;
delete from excepciones where fecha = hoy_ar();

-- ======================= PANEL =======================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated"}', true);
set local role authenticated;

select is((select origen::text from panel_anotar_fila('00000000-0000-0000-0000-0000000000b1', 'Mostrador', null)), 'local',
  'panel: alta manual en la fila (origen local)');

select throws_ok($$select * from llamar_siguiente('00000000-0000-0000-0000-00000000ffff')$$,
  'P0001', 'profesional_inexistente', 'llamar con un profesional que no existe');

select results_eq(
  $$select numero, estado, profesional_id::text from llamar_siguiente('00000000-0000-0000-0000-0000000000a1')$$,
  $$values (1, 'atendiendo'::estado_fila, '00000000-0000-0000-0000-0000000000a1')$$,
  'llamar_siguiente: pasa al primero (por número) al sillón');
select throws_ok($$select * from llamar_siguiente('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'sillon_ocupado', 'el sillón ya está ocupado');

select results_eq(
  $$select ini, fin from ocupados(hoy_ar(), hoy_ar())$$,
  $$select (extract(hour from inicio_at) * 60 + extract(minute from inicio_at))::int,
           (extract(hour from inicio_at) * 60 + extract(minute from inicio_at))::int + 30
      from fila where numero = 1 and fecha = hoy_ar()$$,
  'quien está en el sillón aparece en ocupados()');

select lives_ok($$select * from cobrar_fila(current_setting('t.id1')::uuid, 'efectivo', 11000)$$, 'cobrar_fila');
select is((select estado from fila where id = current_setting('t.id1')::uuid), 'listo'::estado_fila,
  'cobrar_fila: la atención queda en "listo"');
select is((select count(*)::int from cobros where fila_id = current_setting('t.id1')::uuid and monto = 11000 and origen = 'llegada'), 1,
  'el cobro quedó registrado con origen llegada');
select throws_ok($$select * from cobrar_fila(current_setting('t.id1')::uuid, 'efectivo', 11000)$$,
  'P0001', 'fila_no_atendiendo', 'no se cobra dos veces la misma atención');

-- Un turno de A que pisa la atención que arrancaría ahora.
reset role;
insert into turnos (id, fecha, hora, profesional_id, servicio_id, cliente_id)
values ('00000000-0000-0000-0000-0000000000d1', hoy_ar(), date_trunc('minute', ahora_ar())::time,
        '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
set local role authenticated;

select throws_ok($$select * from llamar_siguiente('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'turno_en_conflicto', 'llamar con un turno que se pisa: avisa');
select results_eq(
  $$select numero from llamar_siguiente('00000000-0000-0000-0000-0000000000a1', true)$$,
  $$values (3)$$, 'forzando, llama igual (la 2 había salido de la fila)');

select lives_ok($$select * from cobrar_turno('00000000-0000-0000-0000-0000000000d1', 'transferencia', 11000)$$, 'cobrar_turno');
select is((select estado from turnos where id = '00000000-0000-0000-0000-0000000000d1'), 'atendido'::estado_turno,
  'cobrar_turno: el turno queda atendido');
select is((select count(*)::int from cobros where turno_id = '00000000-0000-0000-0000-0000000000d1' and origen = 'turno'), 1,
  'cobrar_turno: el cobro queda registrado');
select throws_ok($$select * from cobrar_turno('00000000-0000-0000-0000-0000000000d1', 'efectivo', 11000)$$,
  'P0001', 'turno_no_cobrable', 'no se cobra dos veces el mismo turno');

reset role;
select throws_ok(
  $$insert into cobros (fecha, hora, profesional_id, servicio_id, cliente_nombre, monto, medio, origen, turno_id)
    values (hoy_ar(), '12:00', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'X', 1,
            'efectivo', 'turno', '00000000-0000-0000-0000-0000000000d1')$$,
  '23505', null, 'la base impide cobrar dos veces un turno aunque se salte la función');

-- cancelar_turnos solo toca turnos vivos.
insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id) values
  (hoy_ar() + 1, '10:00', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1'),
  (hoy_ar() + 1, '10:30', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select is((select cancelar_turnos(array(select id from turnos where fecha >= hoy_ar() ))), 2,
  'cancelar_turnos: cancela los 2 vivos y deja el atendido');
select is((select estado from turnos where id = '00000000-0000-0000-0000-0000000000d1'), 'atendido'::estado_turno, 'el turno atendido no se cancela');

select is((select marcar_ausente(f.id) from fila f where f.numero = 4 and f.fecha = hoy_ar()), true, 'marcar_ausente: pasa de espera a ausente');
select is((select marcar_ausente(f.id) from fila f where f.numero = 4 and f.fecha = hoy_ar()), false, 'marcar_ausente dos veces no hace nada');
select is((select count(*)::int from fila where estado = 'espera'), 1, 'queda 1 en espera (la del día mixto)');

-- ---------- Tope de la fila ----------
reset role;
insert into fila (numero, servicio_id, duracion_min)
  select 100 + i, '00000000-0000-0000-0000-0000000000b1', 30 from generate_series(1, 60) i;
set local role anon;
select throws_ok($$select * from anotar_fila('00000000-0000-0000-0000-0000000000b1', 'Última', null)$$,
  'P0001', 'fila_llena', 'con 60 en espera, la fila se llena');

select * from finish();
rollback;
