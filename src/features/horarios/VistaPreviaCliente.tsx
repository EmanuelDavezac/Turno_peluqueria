import { addDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getDia } from '@/domain/getDia';
import { MODALIDAD_CLASES, formatFranjas } from '@/domain/modalidad';
import type { ConfigDia, Excepcion } from '@/domain/types';
import { ISO } from '@/lib/horas';

/** Los próximos 7 días tal como los ve el cliente (ya con excepciones aplicadas). */
export function VistaPreviaCliente({ semana, excepciones, hoy }: { semana: ConfigDia[]; excepciones: Excepcion[]; hoy: string }) {
  const dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = format(addDays(parseISO(hoy), i), ISO);
    return getDia(fecha, semana, excepciones);
  });

  return (
    <section aria-labelledby="preview" className="rounded-2xl border border-line bg-surface p-4">
      <h2 id="preview" className="text-lg font-bold">
        Así lo ve el cliente
      </h2>
      <p className="mb-3 text-xs text-mute">Próximos 7 días, con excepciones aplicadas.</p>
      <ul className="space-y-2">
        {dias.map((d) => {
          const c = MODALIDAD_CLASES[d.modalidad];
          const detalle =
            d.modalidad === 'cerrado'
              ? 'Cerrado'
              : `${d.modalidad === 'llegada' ? 'Por orden de llegada' : d.modalidad === 'mixto' ? 'Turnos y fila' : 'Con turno'} · ${formatFranjas(d.franjas)}`;
          return (
            <li key={d.fecha} className="flex gap-3 text-sm">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
              <div className="min-w-0">
                <p className="font-semibold capitalize">
                  {format(parseISO(d.fecha), 'EEEE d/M', { locale: es })}
                  {d.excepcion && <span className="ml-2 text-xs font-medium normal-case text-mute">excepción{d.excepcion.motivo ? `: ${d.excepcion.motivo}` : ''}</span>}
                </p>
                <p className="text-mute">{detalle}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
