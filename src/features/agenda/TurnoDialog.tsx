import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { WhatsAppBubble } from '@/components/WhatsAppBubble';
import { AvisoError } from '@/components/EstadoCarga';
import { describirError } from '@/data/errores';
import type { AgendaVista } from '@/data/useAgendaDia';
import { armarMensaje } from '@/domain/recordatorio';
import { fechaLarga, formatARS } from '@/lib/format';
import { CobroDialog } from '@/features/caja/CobroDialog';

const ESTADO: Record<string, string> = {
  reservado: 'Reservado',
  llego: 'Ya llegó',
  atendido: 'Atendido y cobrado',
  ausente: 'No vino',
  cancelado: 'Cancelado',
};

/** Acciones sobre un turno: marcar llegó, cobrar, ausente, cancelar, reenviar recordatorio. */
export function TurnoDialog({ turnoId, agenda, onCerrar }: { turnoId: string | null; agenda: AgendaVista; onCerrar: () => void }) {
  const { turnos, clientes, servicios, profesionales, local, plantilla, setEstadoTurno, cobrarTurno } = agenda;
  const [cobrando, setCobrando] = useState(false);
  const [recordatorio, setRecordatorio] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const t = turnos.find((x) => x.id === turnoId);
  if (!t) return null;
  const cliente = clientes.find((c) => c.id === t.clienteId);
  const servicio = servicios.find((s) => s.id === t.servicioId);
  const prof = profesionales.find((p) => p.id === t.profesionalId);
  const vivo = t.estado === 'reservado' || t.estado === 'llego';

  const cerrar = () => {
    setCobrando(false);
    setRecordatorio(null);
    setError('');
    onCerrar();
  };

  /** Corre el cambio en el servidor: si sale bien cierra; si falla, deja el diálogo abierto con el motivo. */
  const hacer = async (accion: () => Promise<void>) => {
    if (ocupado) return;
    setError('');
    setOcupado(true);
    try {
      await accion();
      cerrar();
    } catch (e) {
      setError(describirError(e));
    } finally {
      setOcupado(false);
    }
  };

  const reenviar = () =>
    setRecordatorio(
      armarMensaje(plantilla, {
        nombre: (cliente?.nombre ?? '').split(' ')[0], local: local.nombre, dia: fechaLarga(t.fecha),
        hora: t.hora, profesional: prof?.nombre ?? '',
      }),
    );

  return (
    <>
      <Dialog open={!cobrando} onClose={cerrar} title={`${t.hora} · ${cliente?.nombre ?? 'Cliente'}`}>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-mute">Servicio</dt><dd className="font-semibold">{servicio?.nombre} · {servicio?.duracionMin} min</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-mute">Profesional</dt><dd className="font-semibold">{prof?.nombre}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-mute">WhatsApp</dt><dd className="font-semibold">{cliente?.whatsapp || '—'}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-mute">Origen</dt><dd className="font-semibold">{t.origen === 'online' ? 'Online' : 'Local'}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-mute">Estado</dt><dd className="font-semibold">{ESTADO[t.estado]}</dd></div>
        </dl>

        {recordatorio && (
          <div className="mt-4 space-y-1">
            <WhatsAppBubble mensaje={recordatorio} hora="ahora" />
            <p className="text-xs text-mute">Recordatorio enviado (simulado).</p>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <AvisoError mensaje={error} onCerrar={() => setError('')} />
          </div>
        )}

        {vivo && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {t.estado === 'reservado' && (
              <Button variante="ghost" disabled={ocupado} onClick={() => void hacer(() => setEstadoTurno(t.id, 'llego'))}>
                Marcar que llegó
              </Button>
            )}
            <Button disabled={ocupado} onClick={() => setCobrando(true)}>Cobrar</Button>
            <Button variante="ghost" onClick={reenviar} disabled={!cliente?.whatsapp || ocupado}>
              Reenviar recordatorio
            </Button>
            <Button variante="ghost" disabled={ocupado} onClick={() => void hacer(() => setEstadoTurno(t.id, 'ausente'))}>
              No vino
            </Button>
            <Button variante="danger" className="col-span-2" disabled={ocupado} onClick={() => void hacer(() => setEstadoTurno(t.id, 'cancelado'))}>
              {ocupado ? 'Guardando…' : 'Cancelar turno'}
            </Button>
          </div>
        )}
        <Button variante="ghost" className="mt-2 w-full" onClick={cerrar}>
          Cerrar
        </Button>
      </Dialog>

      <CobroDialog
        abierto={cobrando}
        titulo="Cobrar turno"
        detalle={`${cliente?.nombre} · ${servicio?.nombre} (${formatARS(servicio?.precio ?? 0)})`}
        montoInicial={servicio?.precio ?? 0}
        onCerrar={() => setCobrando(false)}
        onConfirmar={(medio, monto) => {
          // Vuelve al detalle del turno: si el cobro falla, el motivo se ve ahí.
          setCobrando(false);
          void hacer(() => cobrarTurno(t.id, medio, monto));
        }}
      />
    </>
  );
}
