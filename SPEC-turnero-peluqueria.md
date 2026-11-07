# Turnero para peluquería — Especificación para Claude Code

## Contexto

Sistema de turnos para una peluquería de Esperanza (Santa Fe). Hoy usan AgendaPro y el dueño se queja de una cosa concreta: **casi toda la semana trabaja con turnos, pero los viernes atiende por orden de llegada**, y AgendaPro no le deja configurar bien que ese día es por orden de llegada.

El objetivo es presentarle un sistema propio con las funciones que usa de AgendaPro, que resuelva ese problema de forma nativa y que esté bien diseñado.

**Fase 1 (esta):** demo funcional para mostrarle al dueño. Datos en memoria / localStorage, sin backend.
**Fase 2 (si acepta):** versión real con Supabase (auth, base de datos, tiempo real) y deploy en Vercel.

## Stack sugerido

- React + Vite + TypeScript
- Tailwind CSS
- Estado: Zustand (con persist a localStorage en fase 1)
- Fechas: date-fns con locale `es`
- Deploy: Vercel
- Fase 2: Supabase (Postgres + Auth + Realtime para la fila)

Estructurar el código para que la capa de datos se pueda cambiar de localStorage a Supabase sin tocar los componentes (un módulo `data/` o repositorios).

## El diferencial: modalidad de atención por día

Esto es lo más importante del sistema y lo que hay que mostrar primero en la presentación.

Cada día de la semana tiene una **modalidad**:

| Modalidad | Qué significa | Qué ve el cliente |
|---|---|---|
| `turnos` | Solo con turno reservado | Elige horario disponible |
| `llegada` | Por orden de llegada, sin turnos | "Este día atendemos por orden de llegada" + fila virtual |
| `mixto` | Turnos reservados + fila para los que caen sin turno | Horarios disponibles + opción de anotarse en la fila |
| `cerrado` | No abre | Día deshabilitado |

Además:

- **Horario cortado:** cada día puede tener 1 o 2 franjas (ej. 9:00–12:30 y 16:00–20:30). Es lo normal en el interior.
- **Excepciones por fecha:** pisan la configuración semanal para un día puntual. Ej: feriado 8/12 cerrado; 24/12 por orden de llegada de 8:30 a 14:00. Cada excepción tiene fecha, modalidad, franjas y motivo.
- Regla de resolución: `excepción de esa fecha` > `configuración del día de semana`.

### Configuración por defecto (ejemplo, editable)

- Lunes: cerrado
- Martes a jueves: turnos, 9:00–12:30 y 16:00–20:30
- Viernes: **orden de llegada**, 9:00–12:30 y 16:00–21:00
- Sábado: turnos, 8:30–13:30
- Domingo: cerrado

## Funciones (equivalentes a AgendaPro)

### 1. Página de reservas (cliente, mobile-first)

- Encabezado con nombre del local, dirección y horarios de la semana con la modalidad de cada día.
- Flujo: **servicio → profesional (o "cualquiera") → día → horario → datos (nombre + WhatsApp) → confirmación**.
- La tira de días muestra la modalidad de cada uno (badge de color).
- Si el día elegido es `llegada`:
  - Si es hoy: mostrar cuántas personas hay en la fila y espera estimada, y botón "Anotarme en la fila". Al anotarse recibe un número (ticket) con personas adelante y espera estimada. Puede salir de la fila.
  - Si es otro día: "Ese día no hace falta turno, vení directo. Abrimos de X a Y."
- Si es `mixto`: horarios disponibles + opción de fila.
- Confirmación con vista previa del recordatorio de WhatsApp que va a recibir.

### 2. Panel del local (admin)

Secciones:

**a) Agenda del día** (con navegación anterior / hoy / siguiente). Se adapta a la modalidad del día:
- `turnos`: grilla con una columna por profesional, bloques por turno, franjas cerradas (siesta) rayadas, línea de "ahora". Click en hueco libre → crear turno. Click en turno → marcar llegó / cobrar / cancelar / reenviar recordatorio.
- `llegada`: **gestión de la fila**:
  - "En atención": una tarjeta por profesional con quién está en el sillón y hace cuánto. Botón "Terminar y cobrar".
  - Si el profesional está libre: botón "Llamar siguiente" (toma el primero de la fila, respetando preferencia de profesional si la tiene).
  - "En espera": lista numerada con origen (Local / Online), servicio, espera estimada y acción "Ausente".
  - Form rápido "Agregar a la fila" para el que llega al local (nombre opcional + servicio).
  - Métricas: en espera, atendidos hoy, espera promedio.
- `mixto`: grilla + fila.
- `cerrado`: mensaje + botón "Abrir este día igual" (crea una excepción).

**b) Horarios y modalidad** (la pantalla estrella)
- 7 tarjetas, una por día, con selector segmentado Turnos / Llegada / Mixto / Cerrado y las franjas horarias editables (agregar/quitar segunda franja).
- Lista de excepciones por fecha con formulario para agregar.
- Vista previa de cómo lo ve el cliente ("Viernes: por orden de llegada, 9:00 a 12:30 y 16:00 a 21:00").

**c) Caja**
- Cobros del día con medio de pago: efectivo, transferencia, Mercado Pago, débito.
- Totales por medio y total general. Botón "Cerrar caja" con resumen.

**d) Clientes**
- Ficha con nombre, WhatsApp, cantidad de visitas, última visita, notas (ej. "máquina 2 a los costados"). Buscador.

**e) Reportes**
- Últimos 7 días: facturación por día (separando turnos vs orden de llegada), por profesional, servicios más pedidos.
- Comisiones: % por profesional, facturado y monto a pagar.

**f) Recordatorios por WhatsApp**
- Toggles: 24 h antes, 2 h antes, aviso de fila ("te faltan 2 personas").
- Plantilla editable con variables `{nombre}`, `{local}`, `{dia}`, `{hora}`, `{profesional}` y vista previa tipo burbuja de WhatsApp.
- En la demo el envío es simulado. En fase 2 se evalúa WhatsApp Cloud API o un link `wa.me` prearmado.

**g) Configuración**
- Nombre del local, dirección.
- Equipo: profesionales con color y % de comisión.
- Servicios: nombre, duración, precio.
- (Solo demo) "Simular fecha de hoy", para poder mostrar el modo viernes cualquier día de la semana.

### 3. Pantalla de la fila (TV del local)

- Vista a pantalla completa: "Atendiendo ahora" (número + nombre por profesional), "Próximos" (siguientes 5 números), espera estimada para quien llega ahora, y texto "Anotate desde tu celular en <link>".
- Si hoy es día de turnos: "Hoy atendemos con turno".

## Modelo de datos

```ts
type Modalidad = 'turnos' | 'llegada' | 'mixto' | 'cerrado';
type Franja = { desde: string; hasta: string }; // "09:00"

interface ConfigDia { dia: 0|1|2|3|4|5|6; modalidad: Modalidad; franjas: Franja[] }
interface Excepcion { id: string; fecha: string; modalidad: Modalidad; franjas: Franja[]; motivo?: string }

interface Profesional { id: string; nombre: string; color: string; comisionPct: number; activo: boolean }
interface Servicio { id: string; nombre: string; duracionMin: number; precio: number }
interface Cliente { id: string; nombre: string; whatsapp: string; notas?: string }

interface Turno {
  id: string; fecha: string; hora: string;
  profesionalId: string; servicioId: string; clienteId: string;
  estado: 'reservado' | 'llego' | 'atendido' | 'cancelado' | 'ausente';
  origen: 'online' | 'local';
}

interface EntradaFila {
  id: string; fecha: string; numero: number;
  clienteNombre: string; whatsapp?: string; servicioId: string;
  profesionalPreferidoId?: string; profesionalId?: string;
  estado: 'espera' | 'atendiendo' | 'listo' | 'ausente' | 'salio';
  origen: 'online' | 'local';
  ingresoAt: string; inicioAt?: string; finAt?: string;
}

interface Cobro {
  id: string; fecha: string; hora: string;
  profesionalId: string; servicioId: string; clienteNombre: string;
  monto: number; medio: 'efectivo' | 'transferencia' | 'mercadopago' | 'debito';
  origen: 'turno' | 'llegada';
}
```

## Reglas de negocio

1. `getDia(fecha)` devuelve la excepción si existe, si no la config semanal.
2. Horarios disponibles: cada 30 min dentro de las franjas, que entre la duración completa del servicio, sin superponerse con otro turno del mismo profesional (ignorar cancelados). Con "cualquiera", asignar el primer profesional libre. No ofrecer horarios pasados si es hoy.
3. Solo se pueden reservar turnos en días `turnos` o `mixto`.
4. La fila solo existe para hoy y en días `llegada` o `mixto`. El número se reinicia cada día.
5. Espera estimada para la posición N = (suma de duraciones de los que esperan adelante + minutos restantes de los que están en atención) / cantidad de profesionales activos. Redondear a 5 min.
6. "Llamar siguiente" toma el primero en espera cuya preferencia sea ese profesional o ninguna.
7. Terminar un servicio (turno o fila) abre el cobro; al confirmar se registra en caja.
8. Cambiar la modalidad de un día que ya tiene turnos reservados: avisar cuántos turnos hay y preguntar qué hacer (mantenerlos o cancelarlos y notificar).

## Datos de ejemplo (marcados como ejemplo)

- Profesionales: 2 (nombres de ejemplo, editables), comisión 50%.
- Servicios: Corte $11.000 (30 min), Corte + barba $14.000 (45), Barba $6.000 (20), Corte niño $9.000 (25), Color / mechas $28.000 (90), Lavado y peinado $8.000 (30).
- Clientes ficticios con WhatsApp de característica 3496.
- Generar turnos y cobros de los últimos 7 días y los próximos 14 para que reportes y agenda no estén vacíos, y una fila de ejemplo para hoy si es día de llegada.

## Diseño

- Mobile-first en la página de reservas; panel cómodo en notebook y tablet.
- Colores semánticos fijos por modalidad (turnos, llegada, mixto, cerrado) usados en todo el sistema: badges, tira de días, configuración.
- Tema claro y oscuro.
- Números de la fila grandes y legibles (pensar en la TV).
- Evitar el look genérico: tipografía con personalidad para títulos, paleta propia, nada de emojis como íconos.
- Todo en español rioplatense ("vení", "anotate", "cobrá").

## Criterios de aceptación de la demo

- [ ] Puedo poner el viernes en "Orden de llegada" desde Horarios y la página de reservas lo refleja al instante.
- [ ] Un cliente no puede sacar turno un viernes; ve el aviso y puede anotarse en la fila si es hoy.
- [ ] Desde el panel llamo al siguiente, termino, cobro, y el cobro aparece en Caja y Reportes.
- [ ] La pantalla TV se actualiza cuando llamo al siguiente (misma pestaña o `BroadcastChannel` entre pestañas).
- [ ] Puedo cargar una excepción (feriado cerrado) y ese día aparece cerrado para el cliente.
- [ ] Horario cortado funciona: no se ofrecen turnos en la siesta.
- [ ] Funciona bien en celular (360–400 px).

## Fase 2 (después de que el dueño acepte)

- Supabase: tablas del modelo, RLS, login del dueño y de cada profesional.
- Realtime para la fila (panel, TV y celular del cliente sincronizados).
- Recordatorios: WhatsApp Cloud API o link `wa.me` prearmado.
- Seña online con Mercado Pago (opcional).
- Migración: importar clientes y servicios desde un export de AgendaPro (CSV).