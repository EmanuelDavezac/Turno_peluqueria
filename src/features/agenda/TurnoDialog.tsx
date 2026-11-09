import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { WhatsAppBubble } from '@/components/WhatsAppBubble';
import { useStore } from '@/data/local/store';
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
export function TurnoDialog({ turnoId, onCerrar }: { turnoId: string | null; onCerrar: () => void }) {
  const { turnos, clientes, servicios, profesionales, local, recordatorios, setEstadoTurno, cobrarTurno } = useStore();
  const [cobrando, setCobrando] = useState(false);
  const [recordatorio, setRecordatorio] = useState<string | null>(null);

  const t = turnos.find((x) => x.id === turnoId);
  if (!t) return null;
  const cliente = clientes.find((c) => c.id === t.clienteId);
  const servicio = servicios.find((s) => s.id === t.servicioId);
  const prof = profesionales.find((p) => p.id === t.profesionalId);
  const vivo = t.estado === 'reservado' || t.estado === 'llego';

  const cerrar = () => {
    setCobrando(false);
    setRecordatorio(null);
    onCerrar();
  };

  const reenviar = () =>
    setRecordatorio(
      armarMensaje(recordatorios.plantilla, {
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

        {vivo && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {t.estado === 'reservado' && (
              <Button variante="ghost" onClick={() => { setEstadoTurno(t.id, 'llego'); cerrar(); }}>
                Marcar que llegó
              </Button>
            )}
            <Button onClick={() => setCobrando(true)}>Cobrar</Button>
            <Button variante="ghost" onClick={reenviar} disabled={!cliente?.whatsapp}>
              Reenviar recordatorio
            </Button>
            <Button variante="ghost" onClick={() => { setEstadoTurno(t.id, 'ausente'); cerrar(); }}>
              No vino
            </Button>
            <Button variante="danger" className="col-span-2" onClick={() => { setEstadoTurno(t.id, 'cancelado'); cerrar(); }}>
              Cancelar turno
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
          cobrarTurno(t.id, medio, monto);
          cerrar();
        }}
      />
    </>
  );
}
