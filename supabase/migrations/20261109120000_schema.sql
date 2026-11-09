-- =====================================================================
-- Turnero — esquema base
--
-- Zona horaria: Argentina no tiene horario de verano (UTC-3 fijo), así que
-- fechas y horas se guardan como `date` / `time` / `timestamp` SIN zona,
-- siempre en hora local de Argentina. `ahora_ar()` y `hoy_ar()` son la única
-- fuente de "ahora": el reloj del cliente nunca decide nada.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;
-- btree_gist vive en `extensions`: el EXCLUDE de turnos necesita ver sus operator classes.
set search_path = public, extensions;

-- ---------- Tipos ----------
create type modalidad    as enum ('turnos', 'llegada', 'mixto', 'cerrado');
create type estado_turno as enum ('reservado', 'llego', 'atendido', 'cancelado', 'ausente');
create type estado_fila  as enum ('espera', 'atendiendo', 'listo', 'ausente', 'salio');
create type medio_pago   as enum ('efectivo', 'transferencia', 'mercadopago', 'debito');
create type origen       as enum ('online', 'local');
create type origen_cobro as enum ('turno', 'llegada');

-- ---------- Reloj de negocio ----------
create function ahora_ar() returns timestamp
language sql stable
as $$ select (now() at time zone 'America/Argentina/Buenos_Aires') $$;

create function hoy_ar() returns date
language sql stable
as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

-- ---------- Validación de franjas: [{"desde":"09:00","hasta":"12:30"}, ...] ----------
-- Formato HH:MM, desde < hasta, sin superposición entre franjas.
create function franjas_validas(f jsonb) returns boolean
language sql immutable
as $$
  select case
    when f is null or jsonb_typeof(f) <> 'array' then false
    when exists (
      select 1 from jsonb_array_elements(f) x
      where not coalesce(
        jsonb_typeof(x) = 'object'
        and (x->>'desde') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and (x->>'hasta') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and (x->>'desde') < (x->>'hasta'),
        false)
    ) then false
    else not exists (
      select 1
      from jsonb_array_elements(f) with ordinality a(v, i),
           jsonb_array_elements(f) with ordinality b(v, j)
      where i < j
        and (a.v->>'desde') < (b.v->>'hasta')
        and (b.v->>'desde') < (a.v->>'hasta'))
  end
$$;

-- ---------- Configuración ----------
-- Una sola fila (singleton). Sin PIN: el panel usa Supabase Auth.
create table negocio (
  id            boolean primary key default true check (id),
  nombre        text not null check (length(btrim(nombre)) between 1 and 80),
  direccion     text not null default '' check (length(direccion) <= 160),
  -- {"h24":true,"h2":true,"fila":true,"plantilla":"..."}
  recordatorios jsonb not null
);

create table semana (
  dia       smallint primary key check (dia between 0 and 6), -- 0 = domingo
  modalidad modalidad not null default 'cerrado',
  franjas   jsonb not null default '[]' check (franjas_validas(franjas))
);

create table excepciones (
  id        uuid primary key default gen_random_uuid(),
  fecha     date not null unique,
  modalidad modalidad not null,
  franjas   jsonb not null default '[]' check (franjas_validas(franjas)),
  motivo    text check (length(motivo) <= 120)
);

create table profesionales (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (length(btrim(nombre)) between 1 and 60),
  color        text not null default '#2a6f6b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  comision_pct numeric(5, 2) not null default 50 check (comision_pct between 0 and 100),
  activo       boolean not null default true
);

create table servicios (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (length(btrim(nombre)) between 1 and 60),
  duracion_min integer not null check (duracion_min between 5 and 480),
  precio       integer not null check (precio >= 0)
);

-- ---------- Clientes ----------
create table clientes (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (length(btrim(nombre)) between 1 and 80),
  whatsapp         text not null default '' check (length(whatsapp) <= 30),
  whatsapp_digitos text generated always as (regexp_replace(whatsapp, '\D', '', 'g')) stored,
  notas            text check (length(notas) <= 500),
  creado_at        timestamp not null default ahora_ar()
);
-- Un cliente por número de WhatsApp (los que no tienen número no se deduplican).
create unique index clientes_whatsapp_unico on clientes (whatsapp_digitos) where whatsapp_digitos <> '';

-- ---------- Turnos ----------
create table turnos (
  id             uuid primary key default gen_random_uuid(),
  fecha          date not null,
  hora           time not null,
  profesional_id uuid not null references profesionales on delete restrict,
  servicio_id    uuid not null references servicios on delete restrict,
  cliente_id     uuid not null references clientes on delete restrict,
  -- Copia de la duración del servicio al crear el turno: si el servicio cambia
  -- después, los turnos ya tomados no se mueven. Lo completa un trigger.
  duracion_min   integer not null check (duracion_min between 5 and 480),
  estado         estado_turno not null default 'reservado',
  origen         origen not null default 'online',
  creado_at      timestamp not null default ahora_ar(),
  -- Intervalo que ocupa el turno, [inicio, fin). Hora local de Argentina.
  lapso          tsrange generated always as (
                   tsrange(fecha + hora, fecha + hora + make_interval(mins => duracion_min), '[)')
                 ) stored,
  -- La base impide dos turnos superpuestos del mismo profesional, pase lo que
  -- pase en el cliente. Solo los cancelados liberan el horario (igual que el
  -- cálculo de disponibilidad del front).
  constraint turnos_sin_superposicion
    exclude using gist (profesional_id with =, lapso with &&) where (estado <> 'cancelado')
);
create index turnos_fecha_idx on turnos (fecha);
create index turnos_cliente_idx on turnos (cliente_id);

-- ---------- Fila (orden de llegada) ----------
create table fila (
  id                       uuid primary key default gen_random_uuid(),
  fecha                    date not null default hoy_ar(),
  numero                   integer not null check (numero > 0),
  cliente_nombre           text not null default 'Sin nombre' check (length(btrim(cliente_nombre)) between 1 and 80),
  whatsapp                 text check (length(whatsapp) <= 30),
  servicio_id              uuid not null references servicios on delete restrict,
  duracion_min             integer not null check (duracion_min between 5 and 480),
  profesional_preferido_id uuid references profesionales on delete set null,
  profesional_id           uuid references profesionales on delete restrict,
  estado                   estado_fila not null default 'espera',
  origen                   origen not null default 'online',
  ingreso_at               timestamp not null default ahora_ar(),
  inicio_at                timestamp,
  fin_at                   timestamp,
  -- Número correlativo por día, garantizado por la base.
  constraint fila_numero_unico unique (fecha, numero),
  -- Quien está en el sillón tiene profesional y hora de inicio.
  constraint fila_atendiendo_completa check (
    estado <> 'atendiendo' or (profesional_id is not null and inicio_at is not null)
  )
);
-- Un profesional atiende a una sola persona de la fila a la vez.
create unique index fila_un_sillon on fila (fecha, profesional_id) where estado = 'atendiendo';
create index fila_fecha_idx on fila (fecha, estado);

-- ---------- Caja ----------
create table cobros (
  id             uuid primary key default gen_random_uuid(),
  fecha          date not null,
  hora           time not null,
  profesional_id uuid not null references profesionales on delete restrict,
  servicio_id    uuid not null references servicios on delete restrict,
  cliente_nombre text not null check (length(btrim(cliente_nombre)) between 1 and 80),
  monto          integer not null check (monto >= 0),
  medio          medio_pago not null,
  origen         origen_cobro not null,
  -- Un turno o una entrada de fila se cobra una sola vez.
  turno_id       uuid unique references turnos on delete restrict,
  fila_id        uuid unique references fila on delete restrict,
  check (num_nonnulls(turno_id, fila_id) <= 1)
);
create index cobros_fecha_idx on cobros (fecha);

create table cajas_cerradas (
  fecha      date primary key,
  cerrada_at timestamp not null default ahora_ar()
);

-- ---------- Usuarios del panel ----------
-- Tener cuenta en Auth NO alcanza para entrar al panel: hay que estar acá.
create table usuarios_panel (
  user_id   uuid primary key references auth.users on delete cascade,
  creado_at timestamp not null default ahora_ar()
);

-- ---------- Filas estructurales (no son datos de ejemplo) ----------
insert into negocio (nombre, direccion, recordatorios) values (
  'Mi peluquería', '',
  jsonb_build_object(
    'h24', true, 'h2', true, 'fila', true,
    'plantilla', 'Hola {nombre}! Te recordamos tu turno en {local} el {dia} a las {hora} con {profesional}. ¡Te esperamos!'
  )
);
insert into semana (dia) select generate_series(0, 6);
