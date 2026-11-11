-- =====================================================================
-- Turnero — se quita la fila virtual
--
-- La fila (anotarse sin turno, ticket, llamar al siguiente) ya no es parte del
-- producto. Los días "llegada" y "mixto" siguen existiendo, pero solo como
-- aviso: no hay cola ni números.
--
-- OJO: borra la tabla `fila` y todo lo que tenga adentro. Irreversible.
-- Antes de aplicarla al remoto conviene exportar la fila si hay algo que guardar.
-- =====================================================================

set search_path = public, extensions;

-- 1) Las funciones que miraban la fila, sin esa parte (create or replace conserva sus GRANT).
create or replace function turnos_validar() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.duracion_min is null then
    select s.duracion_min into new.duracion_min from servicios s where s.id = new.servicio_id;
  end if;

  if new.estado <> 'cancelado'
     and (tg_op = 'INSERT'
          or old.estado = 'cancelado'
          or (old.fecha, old.hora, old.profesional_id, old.duracion_min)
             is distinct from (new.fecha, new.hora, new.profesional_id, new.duracion_min)) then
    perform lock_agenda(new.fecha);
  end if;
  return new;
end $$;

create or replace function ocupados(p_desde date, p_hasta date)
returns table (fecha date, profesional_id uuid, ini integer, fin integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  if p_desde is null or p_hasta is null or p_hasta < p_desde
     or p_hasta - p_desde > 31 or p_desde < hoy_ar() or p_hasta > hoy_ar() + 60 then
    raise exception 'rango_invalido';
  end if;
  return query
    select t.fecha, t.profesional_id, time_min(t.hora), time_min(t.hora) + t.duracion_min
      from turnos t
     where t.fecha between p_desde and p_hasta and t.estado <> 'cancelado';
end $$;

create or replace function reservar(p_fecha date, p_hora time, p_servicio uuid, p_nombre text, p_whatsapp text)
returns table (turno_id uuid, turno_fecha date, turno_hora time)
language plpgsql security definer set search_path = public
as $$
declare
  c_paso     constant integer := 30;   -- grilla de horarios (PASO_MIN del front)
  c_tope     constant integer := 2;    -- turnos vivos por WhatsApp
  c_ventana  constant integer := 30;   -- días hacia adelante
  v_ahora    timestamp := ahora_ar();
  v_nombre   text := btrim(coalesce(p_nombre, ''));
  v_wsp      text := btrim(coalesce(p_whatsapp, ''));
  v_dig      text := digitos(p_whatsapp);
  v_dur      integer;
  v_modal    modalidad;
  v_franjas  jsonb;
  v_ini      integer;
  v_prof     uuid;
  v_cliente  uuid;
  v_turno    uuid;
begin
  if length(v_nombre) not between 1 and 80 then raise exception 'nombre_invalido'; end if;
  if length(v_dig) not between 8 and 15 or length(v_wsp) > 30 then raise exception 'whatsapp_invalido'; end if;
  if p_fecha is null or p_hora is null then raise exception 'horario_invalido'; end if;
  if p_fecha < v_ahora::date then raise exception 'horario_pasado'; end if;
  if p_fecha > v_ahora::date + c_ventana then raise exception 'fecha_fuera_de_rango'; end if;

  select s.duracion_min into v_dur from servicios s where s.id = p_servicio;
  if v_dur is null then raise exception 'servicio_inexistente'; end if;

  select d.modalidad, d.franjas into v_modal, v_franjas from dia_efectivo(p_fecha) d;
  if v_modal is null or v_modal = 'cerrado' then raise exception 'dia_cerrado'; end if;
  if v_modal = 'llegada' then raise exception 'dia_sin_turnos'; end if;

  v_ini := time_min(p_hora);
  if not franja_admite(v_franjas, v_ini, v_dur, 1) then raise exception 'fuera_de_horario'; end if;
  if not franja_admite(v_franjas, v_ini, v_dur, c_paso) then raise exception 'horario_invalido'; end if;
  if p_fecha = v_ahora::date and v_ini <= time_min(v_ahora::time) then raise exception 'horario_pasado'; end if;

  perform lock_agenda(p_fecha);

  if (select count(*) from turnos t join clientes c on c.id = t.cliente_id
       where c.whatsapp_digitos = v_dig and t.estado in ('reservado', 'llego')
         and t.fecha + t.hora >= v_ahora) >= c_tope then
    raise exception 'tope_turnos';
  end if;

  if not exists (select 1 from profesionales where activo) then raise exception 'sin_profesionales'; end if;
  select p.id into v_prof
    from profesionales p
   where p.activo
     and not hay_turno_en(p.id, p_fecha, v_ini, v_ini + v_dur)
   order by p.nombre, p.id
   limit 1;
  if v_prof is null then raise exception 'horario_ocupado'; end if;

  insert into clientes (nombre, whatsapp) values (v_nombre, v_wsp)
  on conflict (whatsapp_digitos) where whatsapp_digitos <> '' do update set nombre = clientes.nombre
  returning id into v_cliente;

  begin
    insert into turnos (fecha, hora, profesional_id, servicio_id, cliente_id, duracion_min, origen)
    values (p_fecha, p_hora, v_prof, p_servicio, v_cliente, v_dur, 'online')
    returning id into v_turno;
  exception when exclusion_violation then
    raise exception 'horario_ocupado';
  end;

  return query select v_turno, p_fecha, p_hora;
end $$;

-- 2) Funciones propias de la fila.
drop function anotar_fila(uuid, text, text, uuid);
drop function mi_ticket(uuid);
drop function estado_fila_publico();
drop function salir_de_fila(uuid);
drop function panel_anotar_fila(uuid, text, text, uuid);
drop function panel_salir_de_fila(uuid);
drop function marcar_ausente(uuid);
drop function llamar_siguiente(uuid, boolean);
drop function cobrar_fila(uuid, medio_pago, integer);
drop function anotar_fila_interno(uuid, text, text, uuid, origen);
drop function hay_fila_en(uuid, date, integer, integer);
drop function espera_estimada(date, integer);
drop function lock_fila(date);

-- 3) La tabla (arrastra sus índices, políticas y la FK de cobros) y su tipo.
alter table cobros drop column fila_id;
drop table fila;
drop type estado_fila;
