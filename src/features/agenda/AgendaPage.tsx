import { useEffect, useState } from 'react';
import { ModalidadBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Segmented';
import { NavFecha } from '@/components/NavFecha';
import { useHoy, useStore } from '@/data/local/store';
import { getDia } from '@/domain/getDia';
import { MODALIDAD_CLASES, MODALIDAD_LABEL, formatFranjas, permiteFila, permiteTurnos } from '@/domain/modalidad';
import type { Franja, Modalidad } from '@/domain/types';
import { FranjasEditor } from '@/features/horarios/FranjasEditor';
import { GestionFila } from './GestionFila';
import { GrillaTurnos } from './GrillaTurnos';

const ABRIBLES: Modalidad[] = ['turnos', 'llegada', 'mixto'];

function DiaCerrado({ fecha, motivo }: { fecha: string; motivo?: string }) {
  const addExcepcion = useStore((s) => s.addExcepcion);
  const [abierto, setAbierto] = useState(false);
  const [modalidad, setModalidad] = useState<Modalidad>('llegada');
  const [franjas, setFranjas] = useState<Franja[]>([{ desde: '09:00', hasta: '13:00' }]);

  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
      <p className="font-display text-2xl font-bold">Cerrado</p>
      <p className="mt-1 text-mute">{motivo ? `Este día no abre (${motivo}).` : 'Este día no abre.'}</p>
      <Button className="mt-4" onClick={() => setAbierto(true)}>
        Abrir este día igual
      </Button>

      <Dialog open={abierto} onClose={() => setAbierto(false)} title="Abrir este día igual">
        <p className="mb-3 text-sm text-mute">Se crea una excepción solo para esta fecha. La semana tipo no cambia.</p>
        <div className="space-y-3 text-left">
          <Segmented
            label="Modalidad"
            value={modalidad}
            onChange={setModalidad}
            opciones={ABRIBLES.map((m) => ({ value: m, label: MODALIDAD_LABEL[m], activeClass: MODALIDAD_CLASES[m].solid }))}
          />
          <FranjasEditor franjas={franjas} onChange={setFranjas} />
        </div>
        <div className="mt-5 flex gap-2">
          <Button variante="ghost" className="flex-1" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              addExcepcion({ fecha, modalidad, franjas, motivo: 'Abierto manualmente' });
              setAbierto(false);
            }}
          >
            Abrir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function AgendaPage() {
  const { semana, excepciones } = useStore();
  const hoy = useHoy();
  const [fecha, setFecha] = useState(hoy);

  // Si se simula otro "hoy", la agenda salta a esa fecha.
  useEffect(() => setFecha(hoy), [hoy]);

  const dia = getDia(fecha, semana, excepciones);
  const esHoy = fecha === hoy;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Agenda del día</h1>
        <NavFecha fecha={fecha} hoy={hoy} onChange={setFecha} />
        <p className="flex flex-wrap items-center gap-2 text-sm text-mute">
          <ModalidadBadge modalidad={dia.modalidad} />
          {dia.modalidad !== 'cerrado' && <span>{formatFranjas(dia.franjas)}</span>}
          {dia.excepcion && <span className="font-medium">· excepción{dia.excepcion.motivo ? `: ${dia.excepcion.motivo}` : ''}</span>}
        </p>
      </header>

      {dia.modalidad === 'cerrado' && <DiaCerrado fecha={fecha} motivo={dia.excepcion?.motivo} />}

      <div className={dia.modalidad === 'mixto' ? 'grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem]' : 'space-y-8'}>
        {permiteTurnos(dia.modalidad) && <GrillaTurnos dia={dia} hoy={hoy} />}
        {permiteFila(dia.modalidad) &&
          (esHoy ? (
            <GestionFila hoy={hoy} />
          ) : (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-mute">
              La fila funciona solo el día de hoy. Este día se atiende por orden de llegada.
            </p>
          ))}
      </div>
    </div>
  );
}
