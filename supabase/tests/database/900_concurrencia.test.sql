-- Concurrencia real: varias sesiones simultáneas (dblink) contra el mismo recurso.
--
-- A diferencia de los demás tests, este NO corre dentro de una transacción que se
-- revierte: las otras sesiones necesitan ver los datos de prueba, así que se
-- confirman y al final se limpian. Corre último (prefijo 900_) y deja la base
-- como la encontró.
create extension if not exists dblink with schema extensions;

select plan(5);

create temp table resultados (prueba text, conn text, ok boolean, mensaje text);

-- Conexiones a la misma base, desde el propio servidor. Van PRIMERO: si fallan,
-- todavía no se confirmó ningún dato de prueba. Se usa la IP del servidor y no
-- localhost porque dblink exige que el servidor pida contraseña de verdad.
do $$
declare i integer;
begin
  for i in 1..10 loop
    perform extensions.dblink_connect(
      'c' || i,
      format('host=%s port=%s dbname=%s user=postgres password=postgres', host(inet_server_addr()), inet_server_port(), current_database()));
  end loop;
end $$;

-- ---------- Datos de prueba (confirmados) ----------
-- Si una corrida anterior murió a la mitad, estos deletes dejan todo limpio
-- (si no alcanza: `npx supabase db reset`).
delete from turnos   where servicio_id = '00000000-0000-0000-0000-00000000c0b1';
delete from clientes where nombre like 'Conc %' or nombre like 'Distinto %';
delete from servicios     where id = '00000000-0000-0000-0000-00000000c0b1';
delete from profesionales where id = '00000000-0000-0000-0000-00000000c0a1';

insert into profesionales (id, nombre) values ('00000000-0000-0000-0000-00000000c0a1', 'Concurrencia A');
insert into servicios (id, nombre, duracion_min, precio) values ('00000000-0000-0000-0000-00000000c0b1', 'Concurrencia', 30, 1);
create temp table semana_original as select * from semana;
update semana set modalidad = 'turnos', franjas = '[{"desde":"09:00","hasta":"13:00"}]'
 where dia = extract(dow from hoy_ar() + 3)::int;

-- ---------- 2. Turnos: 6 reservas simultáneas del mismo horario ----------
do $$
declare i integer;
begin
  for i in 1..6 loop
    perform extensions.dblink_send_query('c' || i, format(
      $q$select turno_id::text from reservar(hoy_ar() + 3, '10:00', '00000000-0000-0000-0000-00000000c0b1', 'Conc %s', '3496 70000%s')$q$, i, i));
  end loop;
  for i in 1..6 loop
    begin
      perform * from extensions.dblink_get_result('c' || i) as t(id text);
      insert into resultados values ('turno', 'c' || i, true, null);
    exception when others then
      insert into resultados values ('turno', 'c' || i, false, sqlerrm);
    end;
    perform extensions.dblink_get_result('c' || i);
  end loop;
end $$;

select is((select count(*)::int from resultados where prueba = 'turno' and ok), 1, 'turnos: de 6 reservas simultáneas del mismo horario, una sola prospera');
select is((select count(*)::int from resultados where prueba = 'turno' and not ok and mensaje like '%horario_ocupado%'), 5, 'turnos: las otras 5 reciben horario_ocupado');
select is((select count(*)::int from turnos where fecha = hoy_ar() + 3 and hora = '10:00' and estado <> 'cancelado'), 1, 'turnos: queda un solo turno en ese horario');

-- ---------- 3. Un solo profesional, horarios distintos: no se estorban ----------
do $$
declare i integer;
begin
  for i in 1..6 loop
    perform extensions.dblink_send_query('c' || i, format(
      $q$select turno_id::text from reservar(hoy_ar() + 3, ('09:00'::time + (%s * interval '30 minutes'))::time,
         '00000000-0000-0000-0000-00000000c0b1', 'Distinto %s', '3496 80000%s')$q$, i, i, i));
  end loop;
  for i in 1..6 loop
    begin
      perform * from extensions.dblink_get_result('c' || i) as t(id text);
      insert into resultados values ('distintos', 'c' || i, true, null);
    exception when others then
      insert into resultados values ('distintos', 'c' || i, false, sqlerrm);
    end;
    perform extensions.dblink_get_result('c' || i);
  end loop;
end $$;

-- 09:30, 10:00 (ocupado por la prueba anterior), 10:30, 11:00, 11:30, 12:00 → 5 prosperan, 1 choca.
select is((select count(*)::int from resultados where prueba = 'distintos' and ok), 5, 'turnos en horarios distintos: prosperan en paralelo (excepto el ya ocupado)');

-- ---------- Limpieza ----------
do $$
declare i integer;
begin
  for i in 1..10 loop perform extensions.dblink_disconnect('c' || i); end loop;
end $$;

delete from cobros   where servicio_id = '00000000-0000-0000-0000-00000000c0b1';
delete from turnos   where servicio_id = '00000000-0000-0000-0000-00000000c0b1';
delete from clientes where nombre like 'Conc %' or nombre like 'Distinto %';
update semana s set modalidad = o.modalidad, franjas = o.franjas from semana_original o where s.dia = o.dia;
delete from servicios      where id = '00000000-0000-0000-0000-00000000c0b1';
delete from profesionales  where id = '00000000-0000-0000-0000-00000000c0a1';

select is((select count(*)::int from servicios where id = '00000000-0000-0000-0000-00000000c0b1'), 0, 'limpieza: la base quedó como estaba');

select * from finish();
