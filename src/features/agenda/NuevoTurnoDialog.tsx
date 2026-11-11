import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { AvisoError } from '@/components/EstadoCarga';
import { describirError } from '@/data/errores';
import type { AgendaVista } from '@/data/useAgendaDia';
import { puedeTomar } from '@/domain/disponibilidad';
import type { DiaResuelto } from '@/domain/types';
import { fechaLarga, formatARS } from '@/lib/format';

const input = 'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base';

/** Click en un hueco libre de la grilla → cargar un turno a mano (origen "local"). */
export function NuevoTurnoDialog({ dia, hueco, agenda, onCerrar }: {
  dia: DiaResuelto;
  agenda: AgendaVista;
  hueco: { hora: string; profesionalId: string } | null;
  onCerrar: () => void;
}) {
  const { servicios, profesionales, turnos, crearTurno } = agenda;
  const [servicioId, setServicioId] = useState(servicios[0]?.id ?? '');
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (hueco) {
      setServicioId(servicios[0]?.id ?? '');
      setNombre('');
      setWhatsapp('');
      setError('');
    }
  }, [hueco, servicios]);

  if (!hueco) return null;
  const servicio = servicios.find((s) => s.id === servicioId);
  const prof = profesionales.find((p) => p.id === hueco.profesionalId);
  const entra = !!servicio && puedeTomar({ dia, servicio, servicios, turnos, profesionalId: hueco.profesionalId, hora: hueco.hora });

  const guardar = async () => {
    if (!servicio || !entra || guardando) return;
    if (!nombre.trim()) return setError('Escribí el nombre del cliente.');
    setError('');
    setGuardando(true);
    try {
      await crearTurno({
        hora: hueco.hora, profesionalId: hueco.profesionalId, servicioId: servicio.id,
        nombre: nombre.trim(), whatsapp: whatsapp.trim(),
      });
      onCerrar();
    } catch (e) {
      // Si no se pudo (sin conexión, horario ya tomado), el diálogo sigue abierto con lo escrito.
      setError(describirError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onClose={onCerrar} title="Nuevo turno">
      <p className="mb-3 text-sm text-mute">
        <span className="first-letter:uppercase">{fechaLarga(dia.fecha)}</span> · {hueco.hora} hs · {prof?.nombre}
      </p>
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          Servicio
          <select className={input} value={servicioId} onChange={(e) => setServicioId(e.target.value)}>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} · {s.duracionMin} min · {formatARS(s.precio)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Nombre
          <input className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          WhatsApp (opcional)
          <input className={input} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" />
        </label>
        {!entra && servicio && (
          <p role="alert" className="text-sm font-medium text-red-600">
            Este servicio dura {servicio.duracionMin} min y no entra en este hueco (se pisa con otro turno o termina fuera del horario).
          </p>
        )}
        {error && <AvisoError mensaje={error} onCerrar={() => setError('')} />}
      </div>
      <div className="mt-5 flex gap-2">
        <Button variante="ghost" className="flex-1" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button className="flex-1" disabled={!entra || guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Guardar turno'}
        </Button>
      </div>
    </Dialog>
  );
}
