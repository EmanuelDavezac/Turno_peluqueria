-- =====================================================================
-- Turnero — funciones
--
-- Convenciones:
--  * Todo lo que escribe datos para el público es una función SECURITY DEFINER
--    con search_path fijo. El anónimo NUNCA toca las tablas directamente.
--  * Los errores de negocio son `raise exception '<codigo>'` (P0001): el front
--    mapea el código a un mensaje. Códigos: ver cada función.
--  * Los permisos (GRANT) están todos en la migración de RLS.
--  * Locks consultivos por día serializan lo que no puede resolver un
--    constraint: 'agenda:<fecha>' (turnos vs. sillón) y 'fila:<fecha>' (número).
-- =====================================================================

set search_path = public, extensions;

-- ---------- Utilidades internas ----------
create function time_min(t time) returns integer
language sql immutable
as $$ select (extract(hour from t) * 60 + extract(minute from t))::integer $$;

create function hhmm_min(s text) returns integer
language sql immutable
as $$ select split_part(s, ':', 1)::integer * 60 + split_part(s, ':', 2)::integer $$;

create function digitos(s text) returns text
language sql immutable
as $$ select regexp_replace(coalesce(s, ''), '\D', '', 'g') $$;

create function lock_agenda(p_fecha date) returns void
language sql
as $$ select pg_advisory_xact_lock(hashtextextended('agenda:' || p_fecha::text, 0)) $$;

create function lock_fila(p_fecha date) returns void
language sql
as $$ select pg_advisory_xact_lock(hashtextextended('fila:' || p_fecha::text, 0)) $$;

-- ¿Es usuario del panel? (login + estar en usuarios_panel)
create function es_panel() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from usuarios_panel where user_id = auth.uid()) $$;

create function exigir_panel() returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not es_panel() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;
end $$;

-- Lo que rige una fecha: la excepción pisa a la config semanal (regla 1).
create function dia_efectivo(p_fecha date) returns table (modalidad modalidad, franjas jsonb)
language sql stable security definer set search_path = public
as $$
  select e.modalidad, e.franjas from excepciones e where e.fecha = p_fecha
  union all
  select s.modalidad, s.franjas from semana s
   where s.dia = extract(dow from p_fecha)::smallint
     and not exists (select 1 from excepciones e where e.fecha = p_fecha)
  limit 1
$$;

-- ¿Algún tramo [ini, ini+dur) cabe en una franja y arranca en la grilla de `paso` min?
create function franja_admite(p_franjas jsonb, p_ini integer, p_dur integer, p_paso integer)
returns boolean
language sql immutable
as $$
  select exists (
    select 1 from jsonb_array_elements(p_franjas) x
    where p_ini >= hhmm_min(x->>'desde')
      and p_ini + p_dur <= hhmm_min(x->>'hasta')
      and (p_ini - hhmm_min(x->>'desde')) % p_paso = 0)
$$;

-- Solapes de un profesional en [p_ini, p_fin) minutos del día.
create function hay_turno_en(p_prof uuid, p_fecha date, p_ini integer, p_fin integer, p_excluir uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from turnos t
    where t.profesional_id = p_prof and t.fecha = p_fecha and t.estado <> 'cancelado'
      and (p_excluir is null or t.id <> p_excluir)
      and time_min(t.hora) < p_fin and time_min(t.hora) + t.duracion_min > p_ini)
$$;

-- Quien está en el sillón por la fila ocupa al profesional desde que arrancó
-- hasta su fin estimado (inicio + duración del servicio).
create function hay_fila_en(p_prof uuid, p_fecha date, p_ini integer, p_fin integer)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from fila f
    where f.profesional_id = p_prof and f.fecha = p_fecha and f.estado = 'atendiendo'
      and f.inicio_at is not null
      and time_min(f.inicio_at::time) < p_fin
      and time_min(f.inicio_at::time) + f.duracion_min > p_ini)
$$;

-- Regla 5: (duraciones de los que esperan adelante + minutos restantes de los
-- que están en atención) / profesionales activos, redondeado a 5 min.
create function espera_estimada(p_fecha date, p_numero integer default null) returns integer
language sql stable security definer set search_path = public
as $$
  select (round((
      coalesce((select sum(f.duracion_min) from fila f
                 where f.fecha = p_fecha and f.estado = 'espera'
                   and (p_numero is null or f.numero < p_numero)), 0)
    + coalesce((select sum(greatest(0, f.duracion_min
                 - floor(extract(epoch from (ahora_ar() - f.inicio_at)) / 60)::integer))
                 from fila f
                 where f.fecha = p_fecha and f.estado = 'atendiendo' and f.inicio_at is not null), 0)
  ) / greatest(1, (select count(*) from profesionales where activo))::numeric / 5) * 5)::integer
$$;

-- ---------- Triggers de turnos ----------
-- Completa la duración desde el servicio y rechaza turnos que pisan a quien está
-- en el sillón por la fila (el EXCLUDE cubre turno contra turno).
create function turnos_validar() returns trigger
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
    if hay_fila_en(new.profesional_id, new.fecha, time_min(new.hora), time_min(new.hora) + new.duracion_min) then
      raise exception 'horario_ocupado';
    end if;
  end if;
  return new;
end $$;

create trigger turnos_validar
  before insert or update on turnos
  for each row execute function turnos_validar();

-- =====================================================================
-- PÚBLICO (anon): sin exponer datos personales
-- =====================================================================

-- Rangos ocupados por profesional, sin nombres ni ids de cliente. El front
-- calcula los horarios libres con esto (slotsDisponibles sigue siendo TS).
-- Incluye turnos vivos y a quien está en el sillón por la fila.
create function ocupados(p_desde date, p_hasta date)
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
     where t.fecha between p_desde and p_hasta and t.estado <> 'cancelado'
    union all
    select f.fecha, f.profesional_id, time_min(f.inicio_at::time), time_min(f.inicio_at::time) + f.duracion_min
      from fila f
     where f.fecha between p_desde and p_hasta and f.estado = 'atendiendo'
       and f.profesional_id is not null and f.inicio_at is not null;
end $$;

-- Reserva de turno online.
-- Errores: nombre_invalido, whatsapp_invalido, fecha_fuera_de_rango, horario_pasado,
-- servicio_inexistente, dia_cerrado, dia_sin_turnos, fuera_de_horario,
-- horario_invalido, tope_turnos, sin_profesionales, horario_ocupado.
create function reservar(p_fecha date, p_hora time, p_servicio uuid, p_nombre text, p_whatsapp text)
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
     and not hay_fila_en(p.id, p_fecha, v_ini, v_ini + v_dur)
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

-- ---------- Fila ----------
-- Alta atómica en la fila de hoy. El número lo asigna la base bajo lock.
create function anotar_fila_interno(
  p_servicio uuid, p_nombre text, p_whatsapp text, p_preferido uuid, p_origen origen
) returns fila
language plpgsql security definer set search_path = public
as $$
declare
  v_hoy   date := hoy_ar();
  v_dur   integer;
  v_n     integer;
  v_fila  fila;
begin
  select s.duracion_min into v_dur from servicios s where s.id = p_servicio;
  if v_dur is null then raise exception 'servicio_inexistente'; end if;

  perform lock_fila(v_hoy);
  select coalesce(max(f.numero), 0) + 1 into v_n from fila f where f.fecha = v_hoy;

  insert into fila (fecha, numero, cliente_nombre, whatsapp, servicio_id, duracion_min,
                    profesional_preferido_id, origen)
  values (v_hoy, v_n, coalesce(nullif(btrim(p_nombre), ''), 'Sin nombre'),
          nullif(btrim(p_whatsapp), ''), p_servicio, v_dur, p_preferido, p_origen)
  returning * into v_fila;
  return v_fila;
end $$;

-- Anotarse en la fila desde la página pública.
-- Errores: nombre_invalido, whatsapp_invalido, dia_sin_fila, fuera_de_horario,
-- fila_llena, ya_en_fila, servicio_inexistente.
create function anotar_fila(p_servicio uuid, p_nombre text, p_whatsapp text default null, p_preferido uuid default null)
returns table (entrada_id uuid, numero_fila integer)
language plpgsql security definer set search_path = public
as $$
declare
  c_max_espera constant integer := 60;
  v_ahora   timestamp := ahora_ar();
  v_hoy     date := v_ahora::date;
  v_nombre  text := btrim(coalesce(p_nombre, ''));
  v_wsp     text := btrim(coalesce(p_whatsapp, ''));
  v_dig     text := digitos(p_whatsapp);
  v_modal   modalidad;
  v_franjas jsonb;
  v_min     integer := time_min(v_ahora::time);
  v_fila    fila;
begin
  if length(v_nombre) not between 1 and 80 then raise exception 'nombre_invalido'; end if;
  if v_wsp <> '' and (length(v_dig) not between 8 and 15 or length(v_wsp) > 30) then
    raise exception 'whatsapp_invalido';
  end if;

  select d.modalidad, d.franjas into v_modal, v_franjas from dia_efectivo(v_hoy) d;
  if v_modal is null or v_modal not in ('llegada', 'mixto') then raise exception 'dia_sin_fila'; end if;
  -- Solo mientras el local está atendiendo (igual que el front: desde <= ahora < hasta).
  if not exists (select 1 from jsonb_array_elements(v_franjas) x
                  where v_min >= hhmm_min(x->>'desde') and v_min < hhmm_min(x->>'hasta')) then
    raise exception 'fuera_de_horario';
  end if;

  perform lock_fila(v_hoy);
  if (select count(*) from fila f where f.fecha = v_hoy and f.estado = 'espera') >= c_max_espera then
    raise exception 'fila_llena';
  end if;
  if v_dig <> '' and exists (select 1 from fila f
        where f.fecha = v_hoy and f.estado in ('espera', 'atendiendo') and digitos(f.whatsapp) = v_dig) then
    raise exception 'ya_en_fila';
  end if;

  v_fila := anotar_fila_interno(p_servicio, v_nombre, v_wsp, p_preferido, 'online');
  return query select v_fila.id, v_fila.numero;
end $$;

-- Estado del ticket propio. El uuid es la credencial: no hay forma de listar
-- ni de consultar la entrada de otro.
create function mi_ticket(p_id uuid)
returns table (numero integer, estado estado_fila, personas_adelante integer, espera_min integer, profesional_id uuid)
language sql stable security definer set search_path = public
as $$
  select f.numero, f.estado,
         case when f.estado = 'espera'
              then (select count(*)::integer from fila o
                     where o.fecha = f.fecha and o.estado = 'espera' and o.numero < f.numero)
              else 0 end,
         case when f.estado = 'espera' then espera_estimada(f.fecha, f.numero) else 0 end,
         f.profesional_id
    from fila f
   where f.id = p_id
$$;

-- Lo que ve cualquiera antes de anotarse: cuánta gente hay y cuánto se espera.
create function estado_fila_publico()
returns table (en_espera integer, atendiendo integer, espera_min integer)
language sql stable security definer set search_path = public
as $$
  select (select count(*)::integer from fila f where f.fecha = hoy_ar() and f.estado = 'espera'),
         (select count(*)::integer from fila f where f.fecha = hoy_ar() and f.estado = 'atendiendo'),
         espera_estimada(hoy_ar(), null)
$$;

create function salir_de_fila(p_id uuid) returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update fila set estado = 'salio' where id = p_id and estado = 'espera' and fecha = hoy_ar();
  return found;
end $$;

-- =====================================================================
-- PANEL (requiere login + estar en usuarios_panel)
-- =====================================================================

create function panel_anotar_fila(p_servicio uuid, p_nombre text, p_whatsapp text default null, p_preferido uuid default null)
returns fila
language plpgsql security definer set search_path = public
as $$
begin
  perform exigir_panel();
  return anotar_fila_interno(p_servicio, p_nombre, p_whatsapp, p_preferido, 'local');
end $$;

create function panel_salir_de_fila(p_id uuid) returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  perform exigir_panel();
  update fila set estado = 'salio' where id = p_id and estado = 'espera';
  return found;
end $$;

create function marcar_ausente(p_id uuid) returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  perform exigir_panel();
  update fila set estado = 'ausente' where id = p_id and estado = 'espera';
  return found;
end $$;

-- Pasa al primero en espera que corresponda a ese profesional al sillón (regla 6).
-- Si el profesional tiene un turno que se pisa con esta atención, avisa con
-- `turno_en_conflicto` (detalle: la hora del turno) salvo que p_forzar = true.
-- Errores: no_autorizado, profesional_inexistente, sillon_ocupado, turno_en_conflicto.
create function llamar_siguiente(p_profesional uuid, p_forzar boolean default false)
returns setof fila
language plpgsql security definer set search_path = public
as $$
declare
  v_ahora timestamp := ahora_ar();
  v_hoy   date := v_ahora::date;
  v_ini   integer := time_min(v_ahora::time);
  v_f     fila;
  v_conf  time;
begin
  perform exigir_panel();
  if not exists (select 1 from profesionales p where p.id = p_profesional and p.activo) then
    raise exception 'profesional_inexistente';
  end if;

  perform lock_agenda(v_hoy);
  if exists (select 1 from fila f
              where f.fecha = v_hoy and f.estado = 'atendiendo' and f.profesional_id = p_profesional) then
    raise exception 'sillon_ocupado';
  end if;

  select * into v_f from fila f
   where f.fecha = v_hoy and f.estado = 'espera'
     and (f.profesional_preferido_id is null or f.profesional_preferido_id = p_profesional)
   order by f.numero
   limit 1
   for update;
  if not found then return; end if;

  if not p_forzar then
    select t.hora into v_conf from turnos t
     where t.profesional_id = p_profesional and t.fecha = v_hoy and t.estado in ('reservado', 'llego')
       and time_min(t.hora) < v_ini + v_f.duracion_min
       and time_min(t.hora) + t.duracion_min > v_ini
     order by t.hora
     limit 1;
    if found then
      raise exception 'turno_en_conflicto' using detail = to_char(v_conf, 'HH24:MI');
    end if;
  end if;

  update fila set estado = 'atendiendo', profesional_id = p_profesional, inicio_at = v_ahora
   where id = v_f.id
  returning * into v_f;
  return next v_f;
end $$;

-- Termina la atención de la fila y registra el cobro, todo junto.
create function cobrar_fila(p_id uuid, p_medio medio_pago, p_monto integer)
returns cobros
language plpgsql security definer set search_path = public
as $$
declare
  v_ahora timestamp := ahora_ar();
  v_f     fila;
  v_cobro cobros;
begin
  perform exigir_panel();
  select * into v_f from fila f where f.id = p_id for update;
  if not found or v_f.estado <> 'atendiendo' then raise exception 'fila_no_atendiendo'; end if;

  update fila set estado = 'listo', fin_at = v_ahora where id = p_id;
  insert into cobros (fecha, hora, profesional_id, servicio_id, cliente_nombre, monto, medio, origen, fila_id)
  values (v_f.fecha, date_trunc('minute', v_ahora)::time, v_f.profesional_id, v_f.servicio_id,
          v_f.cliente_nombre, p_monto, p_medio, 'llegada', p_id)
  returning * into v_cobro;
  return v_cobro;
end $$;

-- Marca el turno como atendido y registra el cobro, todo junto.
create function cobrar_turno(p_id uuid, p_medio medio_pago, p_monto integer)
returns cobros
language plpgsql security definer set search_path = public
as $$
declare
  v_ahora  timestamp := ahora_ar();
  v_t      turnos;
  v_nombre text;
  v_cobro  cobros;
begin
  perform exigir_panel();
  select * into v_t from turnos t where t.id = p_id for update;
  if not found or v_t.estado in ('atendido', 'cancelado') then raise exception 'turno_no_cobrable'; end if;

  select c.nombre into v_nombre from clientes c where c.id = v_t.cliente_id;
  update turnos set estado = 'atendido' where id = p_id;
  insert into cobros (fecha, hora, profesional_id, servicio_id, cliente_nombre, monto, medio, origen, turno_id)
  values (v_t.fecha, date_trunc('minute', v_ahora)::time, v_t.profesional_id, v_t.servicio_id,
          coalesce(v_nombre, 'Cliente'), p_monto, p_medio, 'turno', p_id)
  returning * into v_cobro;
  return v_cobro;
end $$;

-- Cancela turnos vivos (regla 8). La notificación al cliente es aparte.
create function cancelar_turnos(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n integer;
begin
  perform exigir_panel();
  update turnos set estado = 'cancelado'
   where id = any (p_ids) and estado in ('reservado', 'llego');
  get diagnostics v_n = row_count;
  return v_n;
end $$;
