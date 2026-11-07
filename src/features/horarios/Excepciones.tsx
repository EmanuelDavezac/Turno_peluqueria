import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ModalidadBadge } from '@/components/ui/Badge';
import { Segmented } from '@/components/ui/Segmented';
import { MODALIDADES, MODALIDAD_CLASES, MODALIDAD_LABEL, formatFranjas } from '@/domain/modalidad';
import type { Excepcion, Franja, Modalidad } from '@/domain/types';
import { FranjasEditor } from './FranjasEditor';

const input = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm';

export function ListaExcepciones({ excepciones, onQuitar }: { excepciones: Excepcion[]; onQuitar: (id: string) => void }) {
  if (!excepciones.length) {
    return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-mute">No hay excepciones cargadas.</p>;
  }
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {excepciones.map((e) => (
        <li key={e.id} className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold first-letter:uppercase">{format(parseISO(e.fecha), "EEEE d 'de' MMMM", { locale: es })}</p>
            <p className="truncate text-sm text-mute">
              {e.modalidad === 'cerrado' ? 'Cerrado' : formatFranjas(e.franjas)}
              {e.motivo ? ` · ${e.motivo}` : ''}
            </p>
          </div>
          <ModalidadBadge modalidad={e.modalidad} />
          <button type="button" aria-label="Quitar excepción" onClick={() => onQuitar(e.id)} className="rounded-lg p-2 text-mute hover:bg-sunken hover:text-ink">
            <Trash2 size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ExcepcionForm({ minFecha, onAgregar }: { minFecha: string; onAgregar: (e: Omit<Excepcion, 'id'>) => void }) {
  const [fecha, setFecha] = useState('');
  const [modalidad, setModalidad] = useState<Modalidad>('cerrado');
  const [franjas, setFranjas] = useState<Franja[]>([{ desde: '08:30', hasta: '14:00' }]);
  const [motivo, setMotivo] = useState('');

  const abierto = modalidad !== 'cerrado';
  const puede = !!fecha;

  const submit = () => {
    if (!puede) return;
    onAgregar({ fecha, modalidad, franjas: abierto ? franjas : [], motivo: motivo.trim() || undefined });
    setFecha('');
    setMotivo('');
  };

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Fecha
          <input type="date" min={minFecha} value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          Motivo (opcional)
          <input type="text" placeholder="Ej: Feriado" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={`${input} mt-1`} />
        </label>
      </div>
      <Segmented
        label="Modalidad de la excepción"
        value={modalidad}
        onChange={setModalidad}
        opciones={MODALIDADES.map((m) => ({ value: m, label: MODALIDAD_LABEL[m], activeClass: MODALIDAD_CLASES[m].solid }))}
      />
      {abierto && <FranjasEditor franjas={franjas} onChange={setFranjas} />}
      <Button onClick={submit} disabled={!puede}>
        Agregar excepción
      </Button>
    </div>
  );
}
