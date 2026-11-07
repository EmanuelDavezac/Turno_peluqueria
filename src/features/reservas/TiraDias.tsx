import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { MODALIDAD_CLASES, MODALIDAD_LABEL } from '@/domain/modalidad';
import type { DiaResuelto } from '@/domain/types';

/** Tira horizontal de días; cada uno muestra su modalidad con el color fijo del sistema. */
export function TiraDias({ dias, hoy, seleccionado, onElegir }: {
  dias: DiaResuelto[];
  hoy: string;
  seleccionado: string | null;
  onElegir: (fecha: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Día" className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2">
      {dias.map((d) => {
        const c = MODALIDAD_CLASES[d.modalidad];
        const cerrado = d.modalidad === 'cerrado';
        const activo = d.fecha === seleccionado;
        const f = parseISO(d.fecha);
        return (
          <button
            key={d.fecha}
            type="button"
            role="radio"
            aria-checked={activo}
            disabled={cerrado}
            onClick={() => onElegir(d.fecha)}
            className={`flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-center transition ${
              activo ? `border-2 ${c.border} bg-surface` : 'border-line bg-surface'
            } ${cerrado ? 'opacity-50' : 'hover:bg-sunken'}`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-mute">
              {d.fecha === hoy ? 'Hoy' : format(f, 'EEE', { locale: es })}
            </span>
            <span className="font-display text-2xl font-bold leading-none">{format(f, 'd')}</span>
            <span className={`mt-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${c.badge}`}>{MODALIDAD_LABEL[d.modalidad]}</span>
          </button>
        );
      })}
    </div>
  );
}
