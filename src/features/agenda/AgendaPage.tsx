import { useEffect, useState } from 'react';
import { ModalidadBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Segmented';
import { AvisoError, Pantalla } from '@/components/EstadoCarga';
import { NavFecha } from '@/components/NavFecha';
import { describirError } from '@/data/errores';
import { useHoy } from '@/data/local/store';
import { useAgendaDia } from '@/data/useAgendaDia';
import { useHorarios, type HorariosVista } from '@/data/useHorarios';
import { getDia } from '@/domain/getDia';
import { MODALIDAD_CLASES, MODALIDAD_LABEL, formatFranjas, permiteTurnos } from '@/domain/modalidad';
import type { DiaResuelto, Franja, Modalidad } from '@/domain/types';
import { FranjasEditor } from '@/features/horarios/FranjasEditor';
import { GrillaTurnos } from './GrillaTurnos';

const ABRIBLES: Modalidad[] = ['turnos', 'llegada', 'mixto'];

function DiaCerrado({ fecha, motivo, addExcepcion }: { fecha: string; motivo?: string; addExcepcion: HorariosVista['addExcepcion'] }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
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
        {error && <div className="mb-3 text-left"><AvisoError mensaje={error} onCerrar={() => setError(null)} /></div>}
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
            disabled={guardando}
            onClick={async () => {
              setError(null);
              setGuardando(true);
              try {
                await addExcepcion({ fecha, modalidad, franjas, motivo: 'Abierto manualmente' });
                setAbierto(false);
              } catch (e) {
                setError(describirError(e));
              } finally {
                setGuardando(false);
              }
            }}
          >
            {guardando ? 'Abriendo…' : 'Abrir'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function AgendaPage() {
  const horarios = useHorarios();
  return (
    <Pantalla recurso={horarios} texto="Cargando la agenda…">
      {(h) => <AgendaContenido h={h} />}
    </Pantalla>
  );
}

function AgendaContenido({ h }: { h: HorariosVista }) {
  const { semana, excepciones } = h;
  const hoy = useHoy();
  const [fecha, setFecha] = useState(hoy);

  // Si se simula otro "hoy", la agenda salta a esa fecha.
  useEffect(() => setFecha(hoy), [hoy]);

  const dia = getDia(fecha, semana, excepciones);

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

      {dia.modalidad === 'cerrado' && <DiaCerrado fecha={fecha} motivo={dia.excepcion?.motivo} addExcepcion={h.addExcepcion} />}

      {(dia.modalidad === 'llegada' || dia.modalidad === 'mixto') && (
        <p className="rounded-xl border border-dashed border-line p-4 text-sm text-mute">
          {dia.modalidad === 'llegada'
            ? 'Este día se atiende por orden de llegada, sin turnos: no hay nada para gestionar acá.'
            : 'Este día también se atiende sin turno, por orden de llegada. Acá se ven solo los turnos reservados.'}
        </p>
      )}

      {permiteTurnos(dia.modalidad) && <AgendaDia key={dia.fecha} dia={dia} hoy={hoy} />}
    </div>
  );
}

/** Los turnos del día: se traen al elegir la fecha, con su propio estado de carga y error. */
function AgendaDia({ dia, hoy }: { dia: DiaResuelto; hoy: string }) {
  const agenda = useAgendaDia(dia.fecha);
  return (
    <Pantalla recurso={agenda} texto="Cargando los turnos…">
      {(a) => <GrillaTurnos dia={dia} hoy={hoy} agenda={a} />}
    </Pantalla>
  );
}
