# Turnero para peluquería

Sistema de turnos para una peluquería de Esperanza (Santa Fe). Diferencial: cada día tiene su modalidad de atención (turnos, orden de llegada, mixto o cerrado), con horario cortado y excepciones por fecha.

**Fase 1 (actual):** demo sin backend, datos en localStorage. Ver `SPEC-turnero-peluqueria.md`.

## Stack

React + Vite + TypeScript, Tailwind CSS, Zustand, date-fns.

## Correr

```
npm install
npm run dev
npm test
```

## Estructura

- `src/domain/`: lógica pura (`getDia`, modalidades, impacto de cambios).
- `src/data/`: capa de datos intercambiable (localStorage hoy, Supabase en fase 2) y datos de ejemplo.
- `src/features/`: pantallas (`horarios` listo; reservas, agenda, TV y el resto pendientes).
