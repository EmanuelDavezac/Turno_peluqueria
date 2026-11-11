import { CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ModalidadBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { WhatsAppBubble } from '@/components/WhatsAppBubble';
import { Pantalla } from '@/components/EstadoCarga';
import { describirErrorReserva } from '@/data/errores';
import { DIAS_VISIBLES, useReservas, type ReservasVista } from '@/data/useReservas';
import { CUALQUIERA, slotsDisponibles, type Slot } from '@/domain/disponibilidad';
import { getDia } from '@/domain/getDia';
import { DIAS_NOMBRE, DIAS_ORDEN, formatFranjas, permiteFila, permiteTurnos } from '@/domain/modalidad';
import { armarMensaje } from '@/domain/recordatorio';
import type { ConfigDia, Turno } from '@/domain/types';
import { PublicLayout } from '@/layouts/PublicLayout';
import { fechaLarga, formatARS } from '@/lib/format';
import { sumarDias } from '@/lib/horas';
import { FilaCliente } from './FilaCliente';
import { TiraDias } from './TiraDias';

const input = 'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base';
const opcion = (activo: boolean) =>
  `w-full rounded-xl border p-3 text-left transition ${activo ? 'border-2 border-brand bg-surface' : 'border-line bg-surface hover:bg-sunken'}`;

function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-brand-ink">{n}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

const DIA_CORTO = (d: number) => DIAS_NOMBRE[d].slice(0, 3);

/** Agrupa días consecutivos con la misma modalidad y franjas: "Lun a Vie", "Sáb", "Dom". */
function agruparSemana(semana: ConfigDia[]) {
  const grupos: { desde: number; hasta: number; cfg: ConfigDia }[] = [];
  for (const d of DIAS_ORDEN) {
    const cfg = semana.find((x) => x.dia === d)!;
    const ult = grupos[grupos.length - 1];
    const igual = ult && ult.cfg.modalidad === cfg.modalidad && JSON.stringify(ult.cfg.franjas) === JSON.stringify(cfg.franjas);
    if (igual) ult.hasta = d;
    else grupos.push({ desde: d, hasta: d, cfg });
  }
  return grupos.map((g) => ({
    ...g,
    etiqueta: g.desde === g.hasta ? DIA_CORTO(g.desde) : `${DIA_CORTO(g.desde)} a ${DIA_CORTO(g.hasta)}`,
  }));
}

export function ReservasPage() {
  const reservas = useReservas();
  // Mientras carga o si falla la conexión, se ve igual la página (con estado y Reintentar), nunca en blanco.
  if (reservas.estado !== 'listo') {
    return (
      <PublicLayout>
        <Pantalla recurso={reservas} texto="Cargando horarios…">{() => null}</Pantalla>
      </PublicLayout>
    );
  }
  return <ReservasContenido v={reservas.datos} />;
}

function ReservasContenido({ v }: { v: ReservasVista }) {
  const { semana, excepciones, servicios, profesionales, local, hoy, ahora } = v;

  const [servicioId, setServicioId] = useState<string | null>(null);
  // El servicio elegido se muestra resumido; "Cambiar" vuelve a abrir la lista.
  const [eligiendoServicio, setEligiendoServicio] = useState(true);
  const [fecha, setFecha] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');
  // Fallo que viene del servidor (día cerrado, horario tomado…): se muestra arriba, porque el paso 3 puede desaparecer.
  const [falloReserva, setFalloReserva] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [turno, setTurno] = useState<Turno | null>(null);
  const diaRef = useRef<HTMLDivElement>(null);
  const datosRef = useRef<HTMLDivElement>(null);

  // Un solo peluquero: no se elige profesional.
  const profesionalId = CUALQUIERA;
  const servicio = servicios.find((s) => s.id === servicioId);
  const grupos = useMemo(() => agruparSemana(semana), [semana]);

  const dias = useMemo(
    () => Array.from({ length: DIAS_VISIBLES }, (_, i) => getDia(sumarDias(hoy, i), semana, excepciones)),
    [hoy, semana, excepciones],
  );
  // Si la configuración cambia y el día elegido pasó a estar cerrado, se deselecciona.
  const dia = dias.find((d) => d.fecha === fecha && d.modalidad !== 'cerrado');
  useEffect(() => {
    if (fecha && !dia) {
      setFecha(null);
      setSlot(null);
    }
  }, [fecha, dia]);

  const slots = useMemo(
    () =>
      dia && servicio
        ? slotsDisponibles({ dia, servicio, profesionalId, profesionales, servicios, turnos: [], bloqueos: v.bloqueosDe(dia.fecha), ahora })
        : [],
    // `v` es un objeto nuevo en cada render: se miran solo los datos que cambian los horarios.
    [dia, servicio, profesionalId, profesionales, servicios, ahora, v.bloqueosDe(dia?.fecha ?? '')],
  );

  useEffect(() => {
    if (slot) datosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [slot]);

  const elegirServicio = (id: string) => {
    setServicioId(id);
    setSlot(null);
    setEligiendoServicio(false);
    // Espera al render del paso siguiente antes de desplazarse.
    requestAnimationFrame(() => diaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const elegirSlot = (s: Slot) => {
    setSlot(s);
    setError('');
    setFalloReserva('');
  };

  const confirmar = async () => {
    if (!servicio || !dia || !slot || enviando) return;
    if (!nombre.trim()) return setError('Escribí tu nombre.');
    if (whatsapp.replace(/\D/g, '').length < 8) return setError('Escribí un WhatsApp válido (con característica).');
    setError('');
    setFalloReserva('');
    setEnviando(true);
    try {
      const t = await v.reservar({
        fecha: dia.fecha, hora: slot.hora, profesionalId: slot.profesionalId, servicioId: servicio.id,
        nombre: nombre.trim(), whatsapp: whatsapp.trim(),
      });
      setTurno(t);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      // La base es la que decide: si el día se cerró o el horario ya no está, se explica y se actualizan los horarios.
      const { texto, refrescar } = describirErrorReserva(e);
      if (refrescar) {
        setSlot(null);
        setFalloReserva(texto);
        void v.refrescar().catch(() => {});
      } else {
        setError(texto);
      }
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => {
    setTurno(null); setSlot(null); setFecha(null); setServicioId(null); setEligiendoServicio(true);
    setNombre(''); setWhatsapp(''); setError(''); setFalloReserva('');
  };

  const cabecera = (
    <header className="mb-6">
      <h1 className="text-3xl font-bold leading-tight">{local.nombre}</h1>
      <p className="text-mute">{local.direccion}</p>
      <ul className="mt-3 space-y-1 text-sm" aria-label="Horarios de la semana">
        {grupos.map((g) => (
          <li key={g.desde} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="w-24 shrink-0 font-semibold">{g.etiqueta}</span>
            <ModalidadBadge modalidad={g.cfg.modalidad} />
            {g.cfg.modalidad !== 'cerrado' && <span className="text-mute">{formatFranjas(g.cfg.franjas)}</span>}
          </li>
        ))}
      </ul>
    </header>
  );

  // ---------- Confirmación ----------
  if (turno && servicio) {
    const prof = profesionales.find((p) => p.id === turno.profesionalId);
    const mensaje = armarMensaje(v.plantilla, {
      nombre: nombre.trim().split(' ')[0], local: local.nombre, dia: fechaLarga(turno.fecha),
      hora: turno.hora, profesional: prof?.nombre ?? '',
    });
    return (
      <PublicLayout>
        <div className="space-y-5 text-center">
          <CheckCircle2 className="mx-auto text-turnos" size={56} aria-hidden />
          <h1 className="text-3xl font-bold">¡Turno confirmado!</h1>
          <div className="rounded-2xl border border-line bg-surface p-4 text-left">
            <p className="text-lg font-bold">{servicio.nombre}</p>
            <p className="first-letter:uppercase">{fechaLarga(turno.fecha)} · {turno.hora} hs</p>
            <p className="mt-2 font-semibold">{formatARS(servicio.precio)}</p>
          </div>
          <div className="text-left">
            <p className="mb-2 text-sm font-semibold">Así va a ser tu recordatorio por WhatsApp (simulado)</p>
            <WhatsAppBubble mensaje={mensaje} hora={turno.hora} />
          </div>
          <Button className="w-full py-3" onClick={reiniciar}>
            Sacar otro turno
          </Button>
        </div>
      </PublicLayout>
    );
  }

  const esHoy = dia?.fecha === hoy;

  return (
    <PublicLayout>
      {cabecera}
      <div className="space-y-8">
        {falloReserva && (
          <p role="alert" className="rounded-xl border border-red-300 bg-surface px-4 py-3 text-sm font-medium text-red-700">
            {falloReserva}
          </p>
        )}
        <Paso n={1} titulo="¿Qué servicio querés?">
          {servicio && !eligiendoServicio ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-brand bg-surface p-3">
              <div>
                <p className="font-semibold">{servicio.nombre}</p>
                <p className="text-sm text-mute">{servicio.duracionMin} min · {formatARS(servicio.precio)}</p>
              </div>
              <Button variante="ghost" className="shrink-0" onClick={() => setEligiendoServicio(true)}>
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {servicios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === servicioId}
                  className={opcion(s.id === servicioId)}
                  onClick={() => elegirServicio(s.id)}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{s.nombre}</span>
                    <span className="font-semibold tabular-nums">{formatARS(s.precio)}</span>
                  </span>
                  <span className="text-sm text-mute">{s.duracionMin} min</span>
                </button>
              ))}
            </div>
          )}
        </Paso>

        {servicio && (
          <div ref={diaRef} className="scroll-mt-4">
          <Paso n={2} titulo="¿Qué día?">
            <TiraDias dias={dias} hoy={hoy} seleccionado={dia?.fecha ?? null} onElegir={(f) => { setFecha(f); setSlot(null); setFalloReserva(''); void v.refrescar().catch(() => {}); }} />

            {dia && (
              <div className="space-y-4">
                {permiteTurnos(dia.modalidad) && (
                  <div>
                    {dia.modalidad === 'mixto' && <p className="mb-2 text-sm text-mute">Elegí un horario o, si pasás sin turno, anotate en la fila.</p>}
                    {slots.length ? (
                      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Horarios disponibles">
                        {slots.map((s) => (
                          <button
                            key={s.hora}
                            type="button"
                            role="radio"
                            aria-checked={slot?.hora === s.hora}
                            onClick={() => elegirSlot(s)}
                            className={`rounded-lg border py-2.5 text-sm font-semibold tabular-nums transition ${
                              slot?.hora === s.hora ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface hover:bg-sunken'
                            }`}
                          >
                            {s.hora}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-line p-4 text-sm text-mute">
                        No quedan horarios este día. Probá con otro día.
                      </p>
                    )}
                  </div>
                )}

                {dia.modalidad === 'llegada' && !esHoy && (
                  <div className="rounded-2xl border border-llegada/40 bg-llegada-soft p-4">
                    <p className="font-bold">Ese día no hace falta turno, vení directo.</p>
                    <p className="text-sm">Abrimos de {formatFranjas(dia.franjas)}. Se atiende por orden de llegada.</p>
                  </div>
                )}

                {permiteFila(dia.modalidad) && esHoy && servicio && (
                  <div className="space-y-2">
                    {dia.modalidad === 'llegada' && <p className="font-bold">Hoy atendemos por orden de llegada.</p>}
                    <FilaCliente dia={dia} hoy={hoy} servicioId={servicio.id} profesionalId={profesionalId} />
                  </div>
                )}

                {dia.modalidad === 'mixto' && !esHoy && (
                  <p className="text-sm text-mute">Ese día también podés venir sin turno: se atiende por orden de llegada.</p>
                )}
              </div>
            )}
          </Paso>
          </div>
        )}

        {servicio && dia && slot && (
          <div ref={datosRef}>
            <Paso n={3} titulo="Tus datos">
              <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm text-mute">
                  {servicio.nombre} · <span className="first-letter:uppercase">{fechaLarga(dia.fecha)}</span> · {slot.hora} hs
                </p>
                <label className="block text-sm font-medium">
                  Nombre
                  <input className={`${input} mt-1`} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
                </label>
                <label className="block text-sm font-medium">
                  WhatsApp
                  <input className={`${input} mt-1`} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="3496 ..." />
                </label>
                {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
                <Button className="w-full py-3 text-base" onClick={() => void confirmar()} disabled={enviando}>
                  {enviando ? 'Reservando…' : 'Confirmar turno'}
                </Button>
              </div>
            </Paso>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
