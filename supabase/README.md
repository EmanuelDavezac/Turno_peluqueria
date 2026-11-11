# Base de datos (Supabase)

Todo el esquema vive en `migrations/` y se aplica en orden. **No se edita nada a mano en el dashboard.**

| Migración | Qué hace |
|---|---|
| `…_schema.sql` | Tipos, tablas, constraints (`EXCLUDE` de turnos), reloj `ahora_ar()` / `hoy_ar()` |
| `…_funciones.sql` | Funciones públicas (`ocupados`, `reservar`) y del panel (`cobrar_turno`, `cancelar_turnos`) |
| `…_rls_grants.sql` | RLS, `GRANT`/`REVOKE`. Todo cerrado por defecto |

## Comandos (requieren Docker)

```
npm run db:start    # levanta Supabase local
npm run db:reset    # recrea la base desde las migraciones
npm run db:test     # corre los pgTAP de supabase/tests/database
```

Nueva migración: `npx supabase migration new <nombre>`. Remoto: `npx supabase link` + `npx supabase db push`.

Si un test de concurrencia (`900_`) muere a mitad de camino puede dejar datos: `npm run db:reset`.

## Modelo de seguridad

- **anon** (cliente sin login) no tiene permiso sobre `turnos`, `clientes`, `cobros` ni `caja`. Solo lee configuración pública (`negocio`, `semana`, `excepciones`, `servicios`, y de `profesionales` solo `id, nombre, activo`) y opera mediante funciones.
- **authenticated** entra al panel solo si está en `usuarios_panel` (`es_panel()`).
- `cobros` se escribe **solo** con funciones (cobro atómico).
- La `service_role` key no va al frontend. Solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Signups desactivados (`[auth] enable_signup = false`). **En el proyecto remoto hay que desactivarlos también** (Authentication → Sign In / Providers).

## Auth del panel: checklist del proyecto remoto

`config.toml` solo rige el entorno local. En el proyecto remoto hay que hacerlo en el dashboard (o con `npx supabase config push`):

1. **Authentication → Sign In / Providers → "Allow new users to sign up": desactivado.** Sin esto, cualquiera crea una cuenta (igual no entraría al panel, pero ensucia Auth).
2. **Authentication → URL Configuration.** Si falta esto, el link de "olvidé mi contraseña" no vuelve a la app:
   - *Site URL*: la URL de producción (por ejemplo `https://turnero-pelu.vercel.app`).
   - *Redirect URLs*: `https://<tu-dominio>/panel` y `http://localhost:5173/panel`. Son exactas, sin comodines si se puede evitar.
3. **SMTP propio** (Authentication → Emails → SMTP Settings). El correo integrado de Supabase es solo para probar: está muy limitado en cantidad y solo envía a miembros del equipo del proyecto. **Sin SMTP propio la recuperación de contraseña falla o no llega.** Alcanza con un proveedor transaccional (Resend, Brevo, Postmark, SES) y un remitente con dominio verificado (SPF/DKIM).
4. Crear al dueño en **Authentication → Users → Add user** y habilitarlo en el panel:
   ```sql
   insert into usuarios_panel (user_id) values ('<uuid del usuario>') on conflict do nothing;
   ```
   Tener cuenta no alcanza: sin esa fila, el login muestra "no tiene acceso al panel".
5. Contraseña mínima de 8 caracteres (el front la exige; en Authentication → Policies conviene subir el mínimo también).
6. Recomendado: activar MFA (TOTP) para el dueño.

## Hora de Argentina

`date` / `time` / `timestamp` sin zona, siempre hora local de Argentina (UTC-3, sin horario de verano). El reloj de negocio es `ahora_ar()` / `hoy_ar()`; el reloj del cliente nunca decide nada.

## Contrato de funciones (para el front)

Los errores de negocio son `raise exception '<codigo>'` (SQLSTATE `P0001`); el código llega en `error.message`.

| Función | Rol | Devuelve | Errores |
|---|---|---|---|
| `ocupados(desde, hasta)` | anon | `fecha, profesional_id, ini, fin` (minutos desde 00:00; turnos vivos) | `rango_invalido` |
| `reservar(fecha, hora, servicio, nombre, whatsapp)` | anon | `turno_id, turno_fecha, turno_hora` | `nombre_invalido` `whatsapp_invalido` `horario_pasado` `fecha_fuera_de_rango` `servicio_inexistente` `dia_cerrado` `dia_sin_turnos` `fuera_de_horario` `horario_invalido` `tope_turnos` `sin_profesionales` `horario_ocupado` |
| `cobrar_turno(id, medio, monto)` | panel | cobro | `no_autorizado` `turno_no_cobrable` |
| `cancelar_turnos(ids[])` | panel | cantidad cancelada | `no_autorizado` |

Altas de turnos desde el panel: `insert` directo en `turnos` (el trigger completa la duración; el `EXCLUDE` rechaza turno contra turno con SQLSTATE `23P01`).

## Reglas que la base impone (y el front solo refleja)

- Turnos del mismo profesional no se superponen (cancelados liberan; atendidos y ausentes siguen ocupando, igual que el cálculo de disponibilidad).
- Un turno se cobra una sola vez.
- Tope de 2 turnos vivos por WhatsApp.

## Sin fila virtual

La fila (anotarse sin turno, ticket, llamar al siguiente) se quitó del producto: migración `20261111010000_quitar_fila.sql`. Los días `llegada` y `mixto` siguen existiendo pero solo como aviso al cliente ("vení directo, sin turno"): no hay cola ni números. **La migración borra la tabla `fila`: aplicarla al remoto es irreversible** (`npx supabase db push`).
