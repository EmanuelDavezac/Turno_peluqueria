import { useState } from 'react';
import { useStore, useHoy } from '@/data/local/store';
import { DIAS_NOMBRE, DIAS_ORDEN } from '@/domain/modalidad';
import { turnosAfectadosPorFecha, turnosAfectadosPorSemana } from '@/domain/impacto';
import type { DiaSemana, Excepcion, Franja, Modalidad } from '@/domain/types';
import { ConfirmCambioModalidad, type Decision } from './ConfirmCambioModalidad';
import { DiaCard } from './DiaCard';
import { ExcepcionForm, ListaExcepciones } from './Excepciones';
import { VistaPreviaCliente } from './VistaPreviaCliente';

type Pendiente =
  | { tipo: 'semana'; dia: DiaSemana; modalidad: Modalidad; ids: string[] }
  | { tipo: 'excepcion'; data: Omit<Excepcion, 'id'>; ids: string[] };

const plural = (d: string) => (d.endsWith('s') ? d : `${d}s`);
const FRANJA_DEFAULT: Franja[] = [{ desde: '09:00', hasta: '13:00' }];

export function HorariosPage() {
  const { semana, excepciones, turnos, setDia, addExcepcion, removeExcepcion, cancelarTurnos } = useStore();
  const hoy = useHoy();
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const avisar = (msg: string) => {
    setAviso(msg);
    window.setTimeout(() => setAviso(null), 5000);
  };

  const aplicarSemana = (dia: DiaSemana, modalidad: Modalidad) => {
    const actual = semana.find((d) => d.dia === dia)!;
    setDia(dia, { modalidad, franjas: modalidad !== 'cerrado' && !actual.franjas.length ? FRANJA_DEFAULT : actual.franjas });
  };

  const onModalidad = (dia: DiaSemana, modalidad: Modalidad) => {
    const afectados = turnosAfectadosPorSemana(dia, modalidad, turnos, semana, excepciones, hoy);
    if (afectados.length) setPendiente({ tipo: 'semana', dia, modalidad, ids: afectados.map((t) => t.id) });
    else aplicarSemana(dia, modalidad);
  };

  const onAgregarExcepcion = (data: Omit<Excepcion, 'id'>) => {
    const afectados = turnosAfectadosPorFecha(data.fecha, data.modalidad, turnos);
    if (afectados.length) setPendiente({ tipo: 'excepcion', data, ids: afectados.map((t) => t.id) });
    else addExcepcion(data);
  };

  const decidir = (d: Decision) => {
    if (!pendiente) return;
    if (pendiente.tipo === 'semana') aplicarSemana(pendiente.dia, pendiente.modalidad);
    else addExcepcion(pendiente.data);
    if (d === 'cancelar') {
      cancelarTurnos(pendiente.ids);
      avisar(`Se cancelaron ${pendiente.ids.length} turno(s) y se avisó a los clientes por WhatsApp (simulado).`);
    }
    setPendiente(null);
  };

  const descripcion = !pendiente
    ? ''
    : pendiente.tipo === 'semana'
      ? `Los ${plural(DIAS_NOMBRE[pendiente.dia].toLowerCase())} próximos pasan a "${pendiente.modalidad}" y`
      : 'Esa fecha pasa a ser excepción y';

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Horarios y modalidad</h1>
        <p className="mt-1 max-w-2xl text-mute">
          Definí cómo atiende cada día: con turno, por orden de llegada, mixto o cerrado. La página de reservas se actualiza al instante.
        </p>
      </header>

      {aviso && (
        <div role="status" className="rounded-xl border border-line bg-sunken px-4 py-3 text-sm font-medium">
          {aviso}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <section aria-labelledby="semana" className="space-y-3">
            <h2 id="semana" className="text-xl font-bold">
              Semana tipo
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {DIAS_ORDEN.map((d) => {
                const cfg = semana.find((x) => x.dia === d)!;
                return (
                  <DiaCard
                    key={d}
                    cfg={cfg}
                    onModalidad={(m) => onModalidad(d, m)}
                    onFranjas={(f) => setDia(d, { franjas: f })}
                  />
                );
              })}
            </div>
          </section>

          <section aria-labelledby="excepciones" className="space-y-3">
            <h2 id="excepciones" className="text-xl font-bold">
              Excepciones por fecha
            </h2>
            <p className="text-sm text-mute">Una excepción pisa la configuración semanal para ese día puntual (feriados, cierres, horarios especiales).</p>
            <ListaExcepciones excepciones={excepciones} onQuitar={removeExcepcion} />
            <ExcepcionForm minFecha={hoy} onAgregar={onAgregarExcepcion} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <VistaPreviaCliente semana={semana} excepciones={excepciones} hoy={hoy} />
        </aside>
      </div>

      <ConfirmCambioModalidad
        cantidad={pendiente?.ids.length ?? 0}
        descripcion={descripcion}
        onDecidir={decidir}
        onVolver={() => setPendiente(null)}
      />
    </div>
  );
}
