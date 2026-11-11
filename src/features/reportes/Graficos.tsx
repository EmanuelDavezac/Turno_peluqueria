import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import type { DiaFacturacion } from '@/domain/reportes';
import { formatARS } from '@/lib/format';

/** "$ 50 mil" para el eje y las etiquetas; el valor exacto va en el tooltip y en la tabla. */
const ejeARS = (n: number) => (n < 1000 ? `$ ${Math.round(n)}` : `$ ${Math.round(n / 1000)} mil`);

/** Techo "redondo" para el eje (1, 2, 2,5, 5 × 10ⁿ) para que las marcas queden en números limpios. */
function techoLimpio(max: number): number {
  if (max <= 0) return 1000;
  const exp = 10 ** Math.floor(Math.log10(max));
  const f = max / exp;
  const paso = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return paso * exp;
}

const SERIE = 'rgb(var(--chart-turnos))';
const ALTO = 200; // px del área de barras

/**
 * Columnas: facturación por día.
 * Marcas finas (24 px máx.), extremo superior redondeado de 4 px,
 * grilla en hairline. Tooltip con hover o foco; la tabla alternativa muestra todo sin tooltips.
 */
export function ColumnasPorDia({ datos }: { datos: DiaFacturacion[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const [tabla, setTabla] = useState(false);

  const max = Math.max(...datos.map((d) => d.total));
  const techo = techoLimpio(max);
  const marcas = [0, techo / 2, techo];
  const iMax = max > 0 ? datos.findIndex((d) => d.total === max) : -1;
  const diaCorto = (f: string) => format(parseISO(f), 'EEE d', { locale: es });

  return (
    <figure className="rounded-2xl border border-line bg-surface p-4">
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mute">Facturación de cada día</p>
        <button type="button" onClick={() => setTabla((t) => !t)} className="text-sm font-semibold text-mute underline hover:text-ink">
          {tabla ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </figcaption>

      {tabla ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[16rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-mute">
              <tr>
                <th className="py-2">Día</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {datos.map((d) => (
                <tr key={d.fecha}>
                  <td className="py-2 capitalize">{diaCorto(d.fecha)}</td>
                  <td className="py-2 text-right font-semibold">{formatARS(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-[3.5rem_1fr] gap-x-2">
          {/* eje Y */}
          <div className="relative" style={{ height: ALTO }} aria-hidden>
            {marcas.map((m) => (
              <span key={m} className="absolute right-0 text-[11px] tabular-nums text-mute" style={{ bottom: (m / techo) * ALTO - 0, transform: 'translateY(50%)' }}>
                {ejeARS(m)}
              </span>
            ))}
          </div>

          {/* área */}
          <div>
            <div className="relative" style={{ height: ALTO }}>
              {marcas.map((m) => (
                <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ bottom: (m / techo) * ALTO }} />
              ))}
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${datos.length}, 1fr)` }}>
                {datos.map((d, i) => {
                  const h = (d.total / techo) * ALTO;
                  return (
                    <button
                      key={d.fecha}
                      type="button"
                      onMouseEnter={() => setActivo(i)}
                      onMouseLeave={() => setActivo(null)}
                      onFocus={() => setActivo(i)}
                      onBlur={() => setActivo(null)}
                      aria-label={`${diaCorto(d.fecha)}: ${formatARS(d.total)}`}
                      className="relative flex min-w-0 items-end justify-center rounded-md outline-none hover:bg-sunken focus-visible:bg-sunken focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span className="flex w-full max-w-6 flex-col-reverse">
                        {h > 0 && <span style={{ height: h, background: SERIE }} className="rounded-t" />}
                      </span>
                      {i === iMax && (
                        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tabular-nums" style={{ bottom: h + 6 }}>
                          {ejeARS(d.total)}
                        </span>
                      )}
                      {activo === i && (
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute left-1/2 z-10 w-44 -translate-x-1/2 rounded-lg border border-line bg-surface p-2 text-left text-xs shadow-lg"
                          style={{ bottom: Math.min(h + 24, ALTO - 44) }}
                        >
                          <span className="block font-bold capitalize">{diaCorto(d.fecha)}</span>
                          <span className="mt-1 block font-bold tabular-nums">{formatARS(d.total)}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-1 grid" style={{ gridTemplateColumns: `repeat(${datos.length}, 1fr)` }} aria-hidden>
              {datos.map((d) => (
                <span key={d.fecha} className="truncate text-center text-[11px] capitalize text-mute">
                  {diaCorto(d.fecha)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}

export interface ItemRanking {
  id: string;
  nombre: string;
  valor: number;
  /** Texto del extremo de la barra. */
  etiqueta: string;
  /** Punto de identidad al lado del nombre (por ejemplo, el color del profesional). */
  punto?: string;
}

/**
 * Ranking horizontal, de mayor a menor, un solo tono (el orden ya está en el largo).
 * Barras de 16 px con extremo de 4 px redondeado, desde una única línea base y con el valor en la punta.
 */
export function BarrasRanking({ items, titulo }: { items: ItemRanking[]; titulo: string }) {
  const max = Math.max(...items.map((i) => i.valor), 1);
  return (
    <ul className="space-y-3" aria-label={titulo}>
      {items.map((it) => (
        <li key={it.id} className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[minmax(5.5rem,11rem)_1fr] sm:gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            {it.punto && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.punto }} />}
            <span className="truncate">{it.nombre}</span>
          </span>
          <div className="flex items-center gap-2">
            {/* el ancho es proporcional al espacio que deja la etiqueta (4,5 rem) */}
            <span
              className="h-4 shrink-0 rounded-r bg-brand"
              style={{ width: it.valor > 0 ? `max(0.5rem, calc((100% - 4.5rem) * ${it.valor / max}))` : 0 }}
            />
            <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{it.etiqueta}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
