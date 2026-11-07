import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { MEDIOS, MEDIO_LABEL, type Medio } from '@/domain/caja';
import { formatARS } from '@/lib/format';

/** Cobro de un servicio (turno o fila): medio de pago y monto. */
export function CobroDialog({ abierto, titulo, detalle, montoInicial, onConfirmar, onCerrar }: {
  abierto: boolean;
  titulo: string;
  detalle: string;
  montoInicial: number;
  onConfirmar: (medio: Medio, monto: number) => void;
  onCerrar: () => void;
}) {
  const [medio, setMedio] = useState<Medio>('efectivo');
  const [monto, setMonto] = useState(String(montoInicial));
  useEffect(() => {
    if (abierto) {
      setMedio('efectivo');
      setMonto(String(montoInicial));
    }
  }, [abierto, montoInicial]);

  const n = Number(monto);
  const valido = Number.isFinite(n) && n > 0;

  return (
    <Dialog open={abierto} onClose={onCerrar} title={titulo}>
      <p className="mb-4 text-sm text-mute">{detalle}</p>
      <label className="block text-sm font-medium">
        Monto
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-lg font-bold tabular-nums"
        />
      </label>
      <div className="mt-4">
        <p className="mb-1 text-sm font-medium">Medio de pago</p>
        <div className="grid grid-cols-2 gap-2">
          {MEDIOS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === medio}
              onClick={() => setMedio(m)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${m === medio ? 'border-2 border-brand bg-surface' : 'border-line bg-surface hover:bg-sunken'}`}
            >
              {MEDIO_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button variante="ghost" className="flex-1" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button className="flex-1" disabled={!valido} onClick={() => onConfirmar(medio, n)}>
          Cobrar {valido ? formatARS(n) : ''}
        </Button>
      </div>
    </Dialog>
  );
}

