# Base de datos (Supabase)

Todo el esquema vive en `migrations/` y se aplica en orden. **No se edita nada a mano en el dashboard.**

| Migración | Qué hace |
|---|---|
| `…_schema.sql` | Tipos, tablas, constraints (`EXCLUDE` de turnos, `UNIQUE` de la fila), reloj `ahora_ar()` / `hoy_ar()` |
| `…_funciones.sql` | Funciones públicas (`ocupados`, `reservar`, `anotar_fila`, `mi_ticket`…) y del panel (`llamar_siguiente`, `cobrar_*`…) |
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

- **anon** (cliente sin login) no tiene permiso sobre `turnos`, `clientes`, `fila`, `cobros` ni `caja`. Solo lee configuración pública (`negocio`, `semana`, `excepciones`, `servicios`, y de `profesionales` solo `id, nombre, activo`) y opera mediante funciones.
- **authenticated** entra al panel solo si está en `usuarios_panel` (`es_panel()`).
- `fila` y `cobros` se escriben **solo** con funciones.
- La `service_role` key no va al frontend. Solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Signups desactivados (`[auth] enable_signup = false`). **En el proyecto remoto hay que desactivarlos también** (Authentication → Sign In / Providers).

## Hora de Argentina

`date` / `time` / `timestamp` sin zona, siempre hora local de Argentina (UTC-3, sin horario de verano). El reloj de negocio es `ahora_ar()` / `hoy_ar()`; el reloj del cliente nunca decide nada.

## Contrato de funciones (para el front)

Los errores de negocio son `raise exception '<codigo>'` (SQLSTATE `P0001`); el código llega en `error.message`.

| Función | Rol | Devuelve | Errores |
|---|---|---|---|
| `ocupados(desde, hasta)` | anon | `fecha, profesional_id, ini, fin` (minutos desde 00:00; turnos vivos + quien está en el sillón) | `rango_invalido` |
| `reservar(fecha, hora, servicio, nombre, whatsapp)` | anon | `turno_id, turno_fecha, turno_hora` | `nombre_invalido` `whatsapp_invalido` `horario_pasado` `fecha_fuera_de_rango` `servicio_inexistente` `dia_cerrado` `dia_sin_turnos` `fuera_de_horario` `horario_invalido` `tope_turnos` `sin_profesionales` `horario_ocupado` |
| `anotar_fila(servicio, nombre, whatsapp?, preferido?)` | anon | `entrada_id, numero_fila` | `nombre_invalido` `whatsapp_invalido` `dia_sin_fila` `fuera_de_horario` `fila_llena` `ya_en_fila` `servicio_inexistente` |
| `mi_ticket(entrada_id)` | anon | `numero, estado, personas_adelante, espera_min, profesional_id` | — |
| `estado_fila_publico()` | anon | `en_espera, atendiendo, espera_min` | — |
| `salir_de_fila(entrada_id)` | anon | `boolean` | — |
| `panel_anotar_fila` · `panel_salir_de_fila` · `marcar_ausente` | panel | fila / `boolean` | `no_autorizado` |
| `llamar_siguiente(profesional, forzar?)` | panel | fila llamada (vacío si no hay nadie) | `no_autorizado` `profesional_inexistente` `sillon_ocupado` `turno_en_conflicto` (detalle: hora del turno) |
| `cobrar_fila(id, medio, monto)` · `cobrar_turno(id, medio, monto)` | panel | cobro | `no_autorizado` `fila_no_atendiendo` `turno_no_cobrable` |
| `cancelar_turnos(ids[])` | panel | cantidad cancelada | `no_autorizado` |

Altas de turnos desde el panel: `insert` directo en `turnos` (el trigger completa la duración y rechaza si pisa el sillón; el `EXCLUDE` rechaza turno contra turno con SQLSTATE `23P01`).

## Reglas que la base impone (y el front solo refleja)

- Turnos del mismo profesional no se superponen (cancelados liberan; atendidos y ausentes siguen ocupando, igual que el cálculo de disponibilidad).
- Quien está en el sillón por la fila ocupa al profesional desde que arranca hasta inicio + duración.
- Número de fila correlativo por día, único bajo concurrencia; un profesional atiende a uno de la fila a la vez.
- Un turno o una atención de la fila se cobra una sola vez.
- Tope de 2 turnos vivos por WhatsApp; fila de hasta 60 en espera; una persona no se anota dos veces.
