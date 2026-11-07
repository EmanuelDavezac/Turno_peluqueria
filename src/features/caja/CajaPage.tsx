import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { NavFecha } from '@/components/NavFecha';
import { useHoy, useStore } from '@/data/local/store';
import { MEDIOS, MEDIO_LABEL, totalesCaja } from '@/domain/caja';
import { fechaLarga, formatARS } from '@/lib/format';

export function CajaPage() {
  const { cobros, servicios, profesionales, cajasCerradas, cerrarCaja } = useStore();
  const hoy = useHoy();
  const [fecha, setFecha] = useState(hoy);
  const [cerrando, setCerrando] = useState(false);
  useEffect(() => setFecha(hoy), [hoy]);

  const del = cobros.filter((c) => c.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora));
  const t = totalesCaja(cobros, fecha);
  const cerrada = cajasCerradas.includes(fecha);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Caja</h1>
        <NavFecha fecha={fecha} hoy={hoy} onChange={setFecha} />
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {MEDIOS.map((m) => (
          <div key={m} className="rounded-xl border border-line bg-surface p-3">
            <p className="text-xs text-mute">{MEDIO_LABEL[m]}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{formatARS(t.porMedio[m])}</p>
          </div>
        ))}
        <div className="col-span-2 rounded-xl bg-brand p-3 text-brand-ink md:col-span-1">
          <p className="text-xs opacity-80">Total ({t.cantidad} cobros)</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatARS(t.total)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Cobros</h2>
        {cerrada ? (
          <span className="rounded-full bg-cerrado-soft px-3 py-1 text-sm font-bold text-cerrado">Caja cerrada</span>
        ) : (
          <Button onClick={() => setCerrando(true)} disabled={!t.cantidad}>
            Cerrar caja
          </Button>
        )}
      </div>

      {del.length ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-mute">
              <tr>
                <th className="px-3 py-2">Hora</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Servicio</th>
                <th className="px-3 py-2">Profesional</th>
                <th className="px-3 py-2">Origen</th>
                <th className="px-3 py-2">Medio</th>
                <th className="px-3 py-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {del.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 tabular-nums">{c.hora}</td>
                  <td className="px-3 py-2 font-medium">{c.clienteNombre}</td>
                  <td className="px-3 py-2">{servicios.find((s) => s.id === c.servicioId)?.nombre}</td>
                  <td className="px-3 py-2">{profesionales.find((p) => p.id === c.profesionalId)?.nombre}</td>
                  <td className="px-3 py-2">{c.origen === 'turno' ? 'Turno' : 'Llegada'}</td>
                  <td className="px-3 py-2">{MEDIO_LABEL[c.medio]}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatARS(c.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-4 text-sm text-mute">No hay cobros este día.</p>
      )}

      <Dialog open={cerrando} onClose={() => setCerrando(false)} title="Cerrar caja">
        <p className="mb-3 text-sm text-mute first-letter:uppercase">{fechaLarga(fecha)} · {t.cantidad} cobros</p>
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {MEDIOS.map((m) => (
            <li key={m} className="flex justify-between px-3 py-2">
              <span>{MEDIO_LABEL[m]}</span>
              <span className="font-semibold tabular-nums">{formatARS(t.porMedio[m])}</span>
            </li>
          ))}
          <li className="flex justify-between bg-sunken px-3 py-2 text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatARS(t.total)}</span>
          </li>
        </ul>
        <div className="mt-5 flex gap-2">
          <Button variante="ghost" className="flex-1" onClick={() => setCerrando(false)}>
            Volver
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              cerrarCaja(fecha);
              setCerrando(false);
            }}
          >
            Confirmar cierre
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
