import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Franja } from '@/domain/types';
import { franjasValidas } from '@/lib/horas';

const input = 'w-full min-w-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm tabular-nums';

/** Edita 1 o 2 franjas. Solo propaga cambios cuando son válidas (desde < hasta, sin solapes). */
export function FranjasEditor({ franjas, onChange }: { franjas: Franja[]; onChange: (f: Franja[]) => void }) {
  const [draft, setDraft] = useState<Franja[]>(franjas);
  const externo = JSON.stringify(franjas);
  useEffect(() => setDraft(JSON.parse(externo)), [externo]);

  const valido = franjasValidas(draft);
  const actualizar = (next: Franja[]) => {
    setDraft(next);
    if (franjasValidas(next)) onChange(next);
  };
  const set = (i: number, k: keyof Franja, v: string) => actualizar(draft.map((f, j) => (j === i ? { ...f, [k]: v } : f)));

  return (
    <div className="space-y-2">
      {draft.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="time" aria-label={`Franja ${i + 1} desde`} className={input} value={f.desde} onChange={(e) => set(i, 'desde', e.target.value)} />
          <span className="text-mute">a</span>
          <input type="time" aria-label={`Franja ${i + 1} hasta`} className={input} value={f.hasta} onChange={(e) => set(i, 'hasta', e.target.value)} />
          {draft.length > 1 && (
            <button type="button" aria-label="Quitar franja" onClick={() => actualizar(draft.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-mute hover:bg-sunken hover:text-ink">
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      {draft.length < 2 && (
        <button
          type="button"
          onClick={() => actualizar([...draft, { desde: '16:00', hasta: '20:00' }])}
          className="inline-flex items-center gap-1 text-sm font-semibold text-mute hover:text-ink"
        >
          <Plus size={14} /> Agregar horario cortado
        </button>
      )}
      {!valido && <p className="text-xs font-medium text-red-600">Revisá los horarios: "desde" tiene que ser antes de "hasta" y las franjas no pueden pisarse.</p>}
    </div>
  );
}
