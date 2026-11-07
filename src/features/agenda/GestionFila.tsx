import { differenceInMinutes, parseISO } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useAhora, useStore } from '@/data/local/store';
import { esperaEstimada, llamarSiguiente as elegir, turnoEnConflicto } from '@/domain/fila';
import type { EntradaFila, Profesional } from '@/domain/types';
import { CobroDialog } from '@/features/caja/CobroDialog';
import { formatARS } from '@/lib/format';
import { fromMin, toMin } from '@/lib/horas';

const field = 'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base';
const minTxt = (m: number) => (m <= 0 ? 'sin espera' : `~${m} min`);

/** Gestión de la fila del día (solo existe para hoy). */
export function GestionFila({ hoy }: { hoy: string }) {
  const { fila, servicios, profesionales, turnos, anotarFila, llamarSiguiente, marcarAusente, cobrarFila, clientes } = useStore();
  const ahora = useAhora();
  const activos = profesionales.filter((p) => p.activo);

  const delDia = fila.filter((e) => e.fecha === hoy);
  const enEspera = delDia.filter((e) => e.estado === 'espera').sort((a, b) => a.numero - b.numero);
  const atendidos = delDia.filter((e) => e.estado === 'listo');
  const conInicio = delDia.filter((e) => e.inicioAt);
  const esperaProm = conInicio.length
    ? Math.round(conInicio.reduce((a, e) => a + Math.max(0, differenceInMinutes(parseISO(e.inicioAt!), parseISO(e.ingresoAt))), 0) / conInicio.length)
    : null;

  const [cobrando, setCobrando] = useState<EntradaFila | null>(null);
  const [aviso, setAviso] = useState<{ prof: Profesional; entrada: EntradaFila; turnoHora: string; turnoCliente: string } | null>(null);

  const servicioDe = (e: EntradaFila) => servicios.find((s) => s.id === e.servicioId);

  const llamar = (prof: Profesional) => {
    const sig = elegir(fila, hoy, prof.id);
    if (!sig) return;
    const choque = turnoEnConflicto({ entrada: sig, profesionalId: prof.id, turnos, servicios, fecha: hoy, ahora });
    if (choque) {
      setAviso({
        prof, entrada: sig, turnoHora: choque.hora,
        turnoCliente: clientes.find((c) => c.id === choque.clienteId)?.nombre ?? 'un cliente',
      });
      return;
    }
    llamarSiguiente(prof.id);
  };

  // --- form agregar ---
  const [nombre, setNombre] = useState('');
  const [servicioId, setServicioId] = useState(servicios[0]?.id ?? '');
  const [pref, setPref] = useState('');
  const agregar = () => {
    anotarFila({ nombre, servicioId, profesionalPreferidoId: pref || undefined, origen: 'local' });
    setNombre('');
    setPref('');
  };

  return (
    <section aria-labelledby="fila-titulo" className="space-y-6">
      <h2 id="fila-titulo" className="text-2xl font-bold">
        Fila de hoy
      </h2>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { n: enEspera.length, t: 'en espera' },
          { n: atendidos.length, t: 'atendidos hoy' },
          { n: esperaProm === null ? '—' : `${esperaProm} min`, t: 'espera promedio' },
        ].map((m) => (
          <div key={m.t} className="rounded-xl border border-line bg-surface p-3">
            <p className="font-display text-3xl font-bold leading-none">{m.n}</p>
            <p className="mt-1 text-xs text-mute">{m.t}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold">En atención</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {activos.map((p) => {
            const actual = delDia.find((e) => e.estado === 'atendiendo' && e.profesionalId === p.id);
            const sv = actual ? servicioDe(actual) : undefined;
            const hace = actual?.inicioAt ? Math.max(0, differenceInMinutes(parseISO(ahora), parseISO(actual.inicioAt))) : 0;
            const candidato = elegir(fila, hoy, p.id);
            return (
              <div key={p.id} className="rounded-2xl border border-line bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.nombre}
                </p>
                {actual ? (
                  <>
                    <p className="mt-2 flex items-baseline gap-2">
                      <span className="font-display text-4xl font-bold leading-none text-llegada">{actual.numero}</span>
                      <span className="text-lg font-bold">{actual.clienteNombre}</span>
                    </p>
                    <p className="text-sm text-mute">
                      {sv?.nombre} · hace {hace} min
                      {sv && actual.inicioAt && <> · termina ~{fromMin(toMin(actual.inicioAt.slice(11, 16)) + sv.duracionMin)}</>}
                    </p>
                    <Button className="mt-3 w-full" onClick={() => setCobrando(actual)}>
                      Terminar y cobrar
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-lg font-bold text-mute">Libre</p>
                    <Button className="mt-3 w-full" disabled={!candidato} onClick={() => llamar(p)}>
                      {candidato ? `Llamar siguiente (#${candidato.numero})` : 'No hay nadie para llamar'}
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold">En espera</h3>
        {enEspera.length ? (
          <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {enEspera.map((e) => {
              const pref = profesionales.find((p) => p.id === e.profesionalPreferidoId);
              const espera = esperaEstimada({ fila, fecha: hoy, servicios, profesionalesActivos: activos.length, ahora, numero: e.numero });
              return (
                <li key={e.id} className="flex items-center gap-3 p-3">
                  <span className="w-12 shrink-0 text-center font-display text-3xl font-bold leading-none">{e.numero}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {e.clienteNombre}{' '}
                      <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${e.origen === 'online' ? 'bg-turnos-soft text-turnos' : 'bg-sunken text-mute'}`}>
                        {e.origen === 'online' ? 'Online' : 'Local'}
                      </span>
                    </p>
                    <p className="truncate text-sm text-mute">
                      {servicioDe(e)?.nombre}
                      {pref ? ` · prefiere ${pref.nombre}` : ''} · espera {minTxt(espera)}
                    </p>
                  </div>
                  <Button variante="ghost" className="shrink-0 px-3 py-2" onClick={() => marcarAusente(e.id)}>
                    Ausente
                  </Button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-mute">No hay nadie esperando.</p>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h3 className="text-lg font-bold">Agregar a la fila</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">
            Nombre (opcional)
            <input className={field} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Servicio
            <select className={field} value={servicioId} onChange={(e) => setServicioId(e.target.value)}>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Profesional
            <select className={field} value={pref} onChange={(e) => setPref(e.target.value)}>
              <option value="">Cualquiera</option>
              {activos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
        </div>
        <Button onClick={agregar}>Agregar a la fila</Button>
      </div>

      <CobroDialog
        abierto={!!cobrando}
        titulo="Terminar y cobrar"
        detalle={cobrando ? `#${cobrando.numero} ${cobrando.clienteNombre} · ${servicioDe(cobrando)?.nombre} (${formatARS(servicioDe(cobrando)?.precio ?? 0)})` : ''}
        montoInicial={cobrando ? (servicioDe(cobrando)?.precio ?? 0) : 0}
        onCerrar={() => setCobrando(null)}
        onConfirmar={(medio, monto) => {
          if (cobrando) cobrarFila(cobrando.id, medio, monto);
          setCobrando(null);
        }}
      />

      <Dialog open={!!aviso} onClose={() => setAviso(null)} title="Ojo: hay un turno cerca">
        {aviso && (
          <>
            <p className="text-sm text-mute">
              {aviso.prof.nombre} tiene un turno a las <strong className="text-ink">{aviso.turnoHora}</strong> ({aviso.turnoCliente}) y esta atención
              (#{aviso.entrada.numero} {aviso.entrada.clienteNombre}, {servicios.find((s) => s.id === aviso.entrada.servicioId)?.duracionMin} min)
              se pisa con ese horario.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                onClick={() => {
                  llamarSiguiente(aviso.prof.id);
                  setAviso(null);
                }}
              >
                Llamar igual
              </Button>
              <Button variante="ghost" onClick={() => setAviso(null)}>
                No llamar todavía
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </section>
  );
}
