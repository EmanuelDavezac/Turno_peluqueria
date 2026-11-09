-- =====================================================================
-- Turnero — RLS y permisos
--
-- Modelo:
--  * anon (cliente sin login): NO lee turnos, clientes, fila, cobros ni caja.
--    Lee solo la configuración pública y opera mediante funciones que no
--    exponen datos personales (ocupados, reservar, anotar_fila, mi_ticket...).
--  * authenticated: solo entra al panel si está en usuarios_panel (es_panel()).
--    Tener cuenta en Auth no alcanza.
--  * fila y cobros solo se escriben mediante funciones (número correlativo
--    y cobro atómico): el panel tiene SELECT y nada más sobre esas tablas.
--  * service_role no se toca; nunca va al frontend.
-- =====================================================================

set search_path = public, extensions;

-- ---------- Cerrar todo por defecto ----------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- ---------- RLS activado en todas las tablas ----------
alter table negocio        enable row level security;
alter table semana         enable row level security;
alter table excepciones    enable row level security;
alter table profesionales  enable row level security;
alter table servicios      enable row level security;
alter table clientes       enable row level security;
alter table turnos         enable row level security;
alter table fila           enable row level security;
alter table cobros         enable row level security;
alter table cajas_cerradas enable row level security;
alter table usuarios_panel enable row level security;

-- ---------- Lectura pública: configuración ----------
create policy publico_lee on negocio     for select to anon, authenticated using (true);
create policy publico_lee on semana      for select to anon, authenticated using (true);
create policy publico_lee on excepciones for select to anon, authenticated using (true);
create policy publico_lee on servicios   for select to anon, authenticated using (true);
-- Del equipo, el público ve solo id, nombre y activo (la comisión es privada).
create policy publico_lee on profesionales for select to anon using (activo);

grant select on negocio, semana, excepciones, servicios to anon, authenticated;
grant select (id, nombre, activo) on profesionales to anon;

-- ---------- Panel ----------
create policy panel_todo on negocio        for all to authenticated using (es_panel()) with check (es_panel());
create policy panel_todo on semana         for all to authenticated using (es_panel()) with check (es_panel());
create policy panel_todo on excepciones    for all to authenticated using (es_panel()) with check (es_panel());
create policy panel_todo on profesionales  for all to authenticated using (es_panel()) with check (es_panel());
create policy panel_todo on servicios      for all to authenticated using (es_panel()) with check (es_panel());
create policy panel_todo on clientes       for all to authenticated using (es_panel()) with check (es_panel());
create policy panel_todo on turnos         for all to authenticated using (es_panel()) with check (es_panel());
create policy panel_todo on cajas_cerradas for all to authenticated using (es_panel()) with check (es_panel());
create policy panel_lee  on fila           for select to authenticated using (es_panel());
create policy panel_lee  on cobros         for select to authenticated using (es_panel());
create policy propio_lee on usuarios_panel for select to authenticated using (user_id = auth.uid());

-- Mínimo privilegio: sin DELETE donde el dominio nunca borra.
grant select, update                 on negocio, semana          to authenticated;
grant select, insert, update, delete on excepciones, profesionales, servicios to authenticated;
grant select, insert, update         on clientes, turnos          to authenticated;
grant select, insert                 on cajas_cerradas            to authenticated;
grant select                         on fila, cobros, usuarios_panel to authenticated;

-- ---------- Funciones ----------
-- Todo REVOKE-ado arriba; acá se concede lo justo.

-- Las ejecuta Postgres al evaluar defaults, checks y políticas con el rol del que escribe.
grant execute on function ahora_ar(), hoy_ar(), franjas_validas(jsonb) to anon, authenticated;
grant execute on function es_panel() to authenticated;

-- Públicas (cliente sin login)
grant execute on function
  ocupados(date, date),
  reservar(date, time, uuid, text, text),
  anotar_fila(uuid, text, text, uuid),
  mi_ticket(uuid),
  estado_fila_publico(),
  salir_de_fila(uuid)
to anon, authenticated;

-- Solo panel (además validan es_panel() adentro)
grant execute on function
  panel_anotar_fila(uuid, text, text, uuid),
  panel_salir_de_fila(uuid),
  marcar_ausente(uuid),
  llamar_siguiente(uuid, boolean),
  cobrar_fila(uuid, medio_pago, integer),
  cobrar_turno(uuid, medio_pago, integer),
  cancelar_turnos(uuid[])
to authenticated;

-- Internas (time_min, hhmm_min, digitos, lock_*, exigir_panel, dia_efectivo,
-- franja_admite, hay_*_en, espera_estimada, anotar_fila_interno, turnos_validar):
-- sin GRANT. Las llaman las funciones SECURITY DEFINER de arriba, que corren
-- con los permisos de su dueño. PostgREST no las expone a anon ni a authenticated.
