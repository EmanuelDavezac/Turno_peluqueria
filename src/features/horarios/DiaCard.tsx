import { Segmented } from '@/components/ui/Segmented';
import {
  DIAS_NOMBRE, MODALIDADES, MODALIDAD_CLASES, MODALIDAD_DESC, MODALIDAD_LABEL, textoCliente,
} from '@/domain/modalidad';
import type { ConfigDia, Franja, Modalidad } from '@/domain/types';
import { FranjasEditor } from './FranjasEditor';

const FRANJA_NUEVA: Franja[] = [{ desde: '09:00', hasta: '13:00' }];

export function DiaCard({ cfg, onModalidad, onFranjas }: {
  cfg: ConfigDia;
  onModalidad: (m: Modalidad) => void;
  onFranjas: (f: Franja[]) => void;
}) {
  const nombre = DIAS_NOMBRE[cfg.dia];
  const c = MODALIDAD_CLASES[cfg.modalidad];
  const abierto = cfg.modalidad !== 'cerrado';

  return (
    <section className={`rounded-2xl border border-line border-l-4 bg-surface p-4 ${c.border}`}>
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-bold">{nombre}</h3>
        <span className="text-xs text-mute">{MODALIDAD_DESC[cfg.modalidad]}</span>
      </header>

      <Segmented
        label={`Modalidad del ${nombre}`}
        value={cfg.modalidad}
        onChange={onModalidad}
        opciones={MODALIDADES.map((m) => ({ value: m, label: MODALIDAD_LABEL[m], activeClass: MODALIDAD_CLASES[m].solid }))}
      />

      <div className="mt-3 min-h-[3.5rem]">
        {abierto ? (
          <FranjasEditor franjas={cfg.franjas.length ? cfg.franjas : FRANJA_NUEVA} onChange={onFranjas} />
        ) : (
          <p className="py-2 text-sm text-mute">Este día no abre.</p>
        )}
      </div>

      <p className="mt-3 border-t border-line pt-2 text-xs text-mute">
        Lo ve el cliente: <strong className="text-ink">{textoCliente(nombre, cfg.modalidad, cfg.franjas)}</strong>
      </p>
    </section>
  );
}
