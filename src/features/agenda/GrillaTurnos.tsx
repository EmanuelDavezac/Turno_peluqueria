import { useState } from 'react';
import { useAhora, useStore } from '@/data/local/store';
import { PASO_MIN, bloqueosDelDia, hayChoque } from '@/domain/disponibilidad';
import type { DiaResuelto, Turno } from '@/domain/types';
import { fromMin, toMin } from '@/lib/horas';
import { NuevoTurnoDialog } from './NuevoTurnoDialog';
import { TurnoDialog } from './TurnoDialog';

const PX_MIN = 1.5; // 30 min = 45 px
const GUTTER = '3.5rem';

const RAYADO = {
  backgroundImage:
    'repeating-linear-gradient(135deg, rgb(var(--line)) 0, rgb(var(--line)) 1px, transparent 1px, transparent 8px)',
};

/** Grilla de turnos: una columna por profesional, franjas cerradas rayadas y línea de "ahora". */
export function GrillaTurnos({ dia, hoy }: { dia: DiaResuelto; hoy: string }) {
  const { profesionales, turnos, servicios, clientes } = useStore();
  const ahora = useAhora();
  const [nuevo, setNuevo] = useState<{ hora: string; profesionalId: string } | null>(null);
  const [turnoSel, setTurnoSel] = useState<string | null>(null);

  const activos = profesionales.filter((p) => p.activo);
  const inicio = Math.min(...dia.franjas.map((f) => toMin(f.desde)));
  const fin = Math.max(...dia.franjas.map((f) => toMin(f.hasta)));
  const alto = (fin - inicio) * PX_MIN;
  const y = (min: number) => (min - inicio) * PX_MIN;

  const franjas = [...dia.franjas].sort((a, b) => toMin(a.desde) - toMin(b.desde));
  const siestas = franjas.slice(1).map((f, i) => ({ desde: toMin(franjas[i].hasta), hasta: toMin(f.desde) })).filter((s) => s.hasta > s.desde);

  const bloqueos = bloqueosDelDia(dia.fecha, turnos, servicios);
  const delDia = turnos.filter((t) => t.fecha === dia.fecha && t.estado !== 'cancelado');

  const ahoraMin = toMin(ahora.slice(11, 16));
  const lineaAhora = dia.fecha === hoy && ahoraMin >= inicio && ahoraMin <= fin;

  const marcas: number[] = [];
  for (let m = Math.ceil(inicio / 30) * 30; m <= fin; m += 30) marcas.push(m);

  const duracion = (t: Turno) => servicios.find((s) => s.id === t.servicioId)?.duracionMin ?? PASO_MIN;
  const nombreCliente = (t: Turno) => clientes.find((c) => c.id === t.clienteId)?.nombre ?? 'Cliente';

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface pb-3">
        <div className="min-w-[34rem]" style={{ display: 'grid', gridTemplateColumns: `${GUTTER} repeat(${activos.length}, minmax(9rem, 1fr))` }}>
          {/* encabezados */}
          <div className="border-b border-line" />
          {activos.map((p) => (
            <div key={p.id} className="flex items-center gap-2 border-b border-l border-line px-3 py-2.5 text-sm font-bold">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="truncate">{p.nombre}</span>
            </div>
          ))}

          {/* horas */}
          <div className="relative" style={{ height: alto }}>
            {marcas.map((m) => (
              <span key={m} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-mute" style={{ top: y(m) }}>
                {fromMin(m)}
              </span>
            ))}
          </div>

          {activos.map((p) => (
            <div key={p.id} className="relative border-l border-line" style={{ height: alto }}>
              {marcas.map((m) => (
                <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-line/60" style={{ top: y(m) }} />
              ))}

              {siestas.map((s, i) => (
                <div key={i} className="absolute inset-x-0 bg-sunken" style={{ top: y(s.desde), height: (s.hasta - s.desde) * PX_MIN, ...RAYADO }} aria-label="Cerrado" />
              ))}

              {/* huecos clickeables */}
              {franjas.flatMap((f) => {
                const slots: number[] = [];
                for (let m = toMin(f.desde); m + PASO_MIN <= toMin(f.hasta); m += PASO_MIN) slots.push(m);
                return slots.map((m) =>
                  hayChoque(bloqueos, p.id, m, PASO_MIN) ? null : (
                    <button
                      key={m}
                      type="button"
                      aria-label={`Nuevo turno ${fromMin(m)} con ${p.nombre}`}
                      onClick={() => setNuevo({ hora: fromMin(m), profesionalId: p.id })}
                      className="absolute inset-x-0 text-[11px] text-transparent hover:bg-sunken hover:text-mute"
                      style={{ top: y(m), height: PASO_MIN * PX_MIN }}
                    >
                      + {fromMin(m)}
                    </button>
                  ),
                );
              })}

              {delDia
                .filter((t) => t.profesionalId === p.id)
                .map((t) => {
                  const dur = duracion(t);
                  const llego = t.estado === 'llego';
                  const apagado = t.estado === 'atendido' || t.estado === 'ausente';
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTurnoSel(t.id)}
                      className={`absolute inset-x-1 z-10 overflow-hidden rounded-lg px-2 py-1 text-left text-xs leading-tight text-white shadow-sm ${
                        llego ? 'ring-2 ring-ink' : ''
                      } ${apagado ? 'opacity-45' : ''}`}
                      style={{ top: y(toMin(t.hora)) + 1, height: dur * PX_MIN - 2, backgroundColor: p.color }}
                    >
                      <span className={`block truncate font-bold ${t.estado === 'ausente' ? 'line-through' : ''}`}>
                        {t.hora} · {nombreCliente(t)}
                      </span>
                      <span className="block truncate opacity-90">
                        {servicios.find((s) => s.id === t.servicioId)?.nombre}
                        {llego ? ' · llegó' : t.estado === 'atendido' ? ' · cobrado' : t.estado === 'ausente' ? ' · ausente' : ''}
                      </span>
                    </button>
                  );
                })}


              {lineaAhora && (
                <div className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-red-500" style={{ top: y(ahoraMin) }}>
                  <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <NuevoTurnoDialog dia={dia} hueco={nuevo} onCerrar={() => setNuevo(null)} />
      <TurnoDialog turnoId={turnoSel} onCerrar={() => setTurnoSel(null)} />
    </>
  );
}
