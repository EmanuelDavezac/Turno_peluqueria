import { ChevronLeft, ChevronRight } from 'lucide-react';
import { sumarDias } from '@/lib/horas';
import { fechaLarga } from '@/lib/format';

/** Navegación anterior / hoy / siguiente. */
export function NavFecha({ fecha, hoy, onChange }: { fecha: string; hoy: string; onChange: (f: string) => void }) {
  const btn = 'rounded-lg border border-line bg-surface p-2 text-ink hover:bg-sunken';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-label="Día anterior" className={btn} onClick={() => onChange(sumarDias(fecha, -1))}>
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        className={`${btn} px-3 text-sm font-semibold disabled:opacity-40`}
        disabled={fecha === hoy}
        onClick={() => onChange(hoy)}
      >
        Hoy
      </button>
      <button type="button" aria-label="Día siguiente" className={btn} onClick={() => onChange(sumarDias(fecha, 1))}>
        <ChevronRight size={18} />
      </button>
      <span className="ml-1 text-lg font-bold first-letter:uppercase">{fechaLarga(fecha)}</span>
    </div>
  );
}
