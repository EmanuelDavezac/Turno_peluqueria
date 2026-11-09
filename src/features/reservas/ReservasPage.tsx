import { CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ModalidadBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { WhatsAppBubble } from '@/components/WhatsAppBubble';
import { useAhora, useHoy, useStore } from '@/data/local/store';
import { CUALQUIERA, slotsDisponibles, type Slot } from '@/domain/disponibilidad';
import { getDia } from '@/domain/getDia';
import { DIAS_NOMBRE, DIAS_ORDEN, formatFranjas, permiteFila, permiteTurnos } from '@/domain/modalidad';
import { armarMensaje } from '@/domain/recordatorio';
import type { Turno } from '@/domain/types';
import { PublicLayout } from '@/layouts/PublicLayout';
import { fechaLarga, formatARS } from '@/lib/format';
import { sumarDias } from '@/lib/horas';
import { FilaCliente } from './FilaCliente';
import { TiraDias } from './TiraDias';

const DIAS_VISIBLES = 14;
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

export function ReservasPage() {
  const { semana, excepciones, servicios, profesionales, turnos, fila, local, recordatorios, reservar } = useStore();
  const hoy = useHoy();
  const ahora = useAhora();

  const [servicioId, setServicioId] = useState<string | null>(null);
  const [profesionalId, setProfesionalId] = useState<string>(CUALQUIERA);
  const [fecha, setFecha] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');
  const [turno, setTurno] = useState<Turno | null>(null);
  const datosRef = useRef<HTMLDivElement>(null);

  const activos = profesionales.filter((p) => p.activo);
  const servicio = servicios.find((s) => s.id === servicioId);

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
        ? slotsDisponibles({ dia, servicio, profesionalId, profesionales, servicios, turnos, fila, ahora })
        : [],
    [dia, servicio, profesionalId, profesionales, servicios, turnos, fila, ahora],
  );

  useEffect(() => {
    if (slot) datosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [slot]);

  const elegirSlot = (s: Slot) => {
    setSlot(s);
    setError('');
  };

  const confirmar = () => {
    if (!servicio || !dia || !slot) return;
    if (!nombre.trim()) return setError('Escribí tu nombre.');
    if (whatsapp.replace(/\D/g, '').length < 8) return setError('Escribí un WhatsApp válido (con característica).');
    const t = reservar({
      fecha: dia.fecha, hora: slot.hora, profesionalId: slot.profesionalId, servicioId: servicio.id,
      nombre: nombre.trim(), whatsapp: whatsapp.trim(),
    });
    setTurno(t);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reiniciar = () => {
    setTurno(null); setSlot(null); setFecha(null); setServicioId(null); setProfesionalId(CUALQUIERA);
    setNombre(''); setWhatsapp(''); setError('');
  };

  const cabecera = (
    <header className="mb-6">
      <h1 className="text-3xl font-bold leading-tight">{local.nombre}</h1>
      <p className="text-mute">{local.direccion}</p>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface text-sm" aria-label="Horarios de la semana">
        {DIAS_ORDEN.map((d) => {
          const c = semana.find((x) => x.dia === d)!;
          return (
            <li key={d} className="flex items-center gap-2 px-3 py-2">
              <span className="w-24 font-semibold">{DIAS_NOMBRE[d]}</span>
              <ModalidadBadge modalidad={c.modalidad} />
              <span className="ml-auto text-right text-mute">{c.modalidad === 'cerrado' ? '' : formatFranjas(c.franjas)}</span>
            </li>
          );
        })}
      </ul>
    </header>
  );

  // ---------- Confirmación ----------
  if (turno && servicio) {
    const prof = profesionales.find((p) => p.id === turno.profesionalId);
    const mensaje = armarMensaje(recordatorios.plantilla, {
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
            <p className="text-mute">Con {prof?.nombre}</p>
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
        <Paso n={1} titulo="¿Qué servicio querés?">
          <div className="space-y-2">
            {servicios.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === servicioId}
                className={opcion(s.id === servicioId)}
                onClick={() => { setServicioId(s.id); setSlot(null); }}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{s.nombre}</span>
                  <span className="font-semibold tabular-nums">{formatARS(s.precio)}</span>
                </span>
                <span className="text-sm text-mute">{s.duracionMin} min</span>
              </button>
            ))}
          </div>
        </Paso>

        {servicio && (
          <Paso n={2} titulo="¿Con quién?">
            <div className="grid grid-cols-2 gap-2">
              {[{ id: CUALQUIERA, nombre: 'Cualquiera' }, ...activos].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === profesionalId}
                  className={opcion(p.id === profesionalId)}
                  onClick={() => { setProfesionalId(p.id); setSlot(null); }}
                >
                  <span className="font-semibold">{p.nombre}</span>
                </button>
              ))}
            </div>
          </Paso>
        )}

        {servicio && (
          <Paso n={3} titulo="¿Qué día?">
            <TiraDias dias={dias} hoy={hoy} seleccionado={dia?.fecha ?? null} onElegir={(f) => { setFecha(f); setSlot(null); }} />

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
                        No quedan horarios este día{profesionalId !== CUALQUIERA ? ' con este profesional. Probá con "Cualquiera" u otro día.' : '. Probá con otro día.'}
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
        )}

        {servicio && dia && slot && (
          <div ref={datosRef}>
            <Paso n={4} titulo="Tus datos">
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
                <Button className="w-full py-3 text-base" onClick={confirmar}>
                  Confirmar turno
                </Button>
              </div>
            </Paso>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
