import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAhora, useStore } from '@/data/local/store';
import { esperaEstimada, personasAdelante } from '@/domain/fila';
import { formatFranjas } from '@/domain/modalidad';
import type { DiaResuelto } from '@/domain/types';
import { toMin } from '@/lib/horas';
import { CUALQUIERA } from '@/domain/disponibilidad';

const KEY = 'turnero-mi-ticket';
const leerTicket = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const guardarTicket = (id: string | null) => {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* sin storage: el ticket vive solo en memoria */
  }
};

const input = 'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base';
const minTxt = (m: number) => (m <= 0 ? 'sin espera' : `${m} min`);

/** Fila virtual del cliente: ver cuánta gente hay, anotarse, ver su ticket y salir. Solo para hoy. */
export function FilaCliente({ dia, hoy, servicioId, profesionalId }: {
  dia: DiaResuelto; hoy: string; servicioId: string; profesionalId: string;
}) {
  const { fila, servicios, profesionales, anotarFila, salirDeFila } = useStore();
  const [ticketId, setTicketId] = useState<string | null>(leerTicket);
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');

  const ahora = useAhora();
  const activos = profesionales.filter((p) => p.activo).length;
  const espera = (numero?: number) =>
    esperaEstimada({ fila, fecha: hoy, servicios, profesionalesActivos: activos, ahora, numero });

  const mi = ticketId ? fila.find((e) => e.id === ticketId) : undefined;
  const miVigente = mi && mi.fecha === hoy && (mi.estado === 'espera' || mi.estado === 'atendiendo') ? mi : undefined;

  if (miVigente) {
    const prof = profesionales.find((p) => p.id === miVigente.profesionalId);
    const adelante = personasAdelante(fila, hoy, miVigente.numero);
    return (
      <div className="rounded-2xl border-2 border-llegada bg-llegada-soft p-5 text-center" aria-live="polite">
        <p className="text-sm font-semibold uppercase tracking-wide text-llegada">Tu número</p>
        <p className="font-display text-7xl font-bold leading-none text-llegada">{miVigente.numero}</p>
        {miVigente.estado === 'atendiendo' ? (
          <p className="mt-3 text-lg font-bold">¡Te toca! Pasá con {prof?.nombre ?? 'el profesional'}.</p>
        ) : (
          <>
            <p className="mt-3 text-lg font-bold">
              {adelante === 0 ? 'Sos el próximo' : adelante === 1 ? 'Hay 1 persona adelante' : `Hay ${adelante} personas adelante`}
            </p>
            <p className="text-mute">Espera estimada: {minTxt(espera(miVigente.numero))}</p>
            <Button
              variante="ghost"
              className="mt-4"
              onClick={() => {
                salirDeFila(miVigente.id);
                guardarTicket(null);
                setTicketId(null);
              }}
            >
              Salir de la fila
            </Button>
          </>
        )}
      </div>
    );
  }

  // ¿Está abierto ahora?
  const ahoraMin = toMin(ahora.slice(11, 16));
  const franjaActual = dia.franjas.find((f) => ahoraMin >= toMin(f.desde) && ahoraMin < toMin(f.hasta));
  const proxima = dia.franjas.find((f) => toMin(f.desde) > ahoraMin);
  const abierto = !!franjaActual;
  const enEspera = fila.filter((e) => e.fecha === hoy && e.estado === 'espera').length;

  const anotarse = () => {
    if (!nombre.trim()) return setError('Escribí tu nombre para anotarte.');
    setError('');
    const e = anotarFila({
      nombre: nombre.trim(),
      whatsapp: whatsapp.trim() || undefined,
      servicioId,
      profesionalPreferidoId: profesionalId === CUALQUIERA ? undefined : profesionalId,
    });
    guardarTicket(e.id);
    setTicketId(e.id);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-llegada/40 bg-llegada-soft/50 p-4">
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-surface p-3">
          <p className="font-display text-4xl font-bold">{enEspera}</p>
          <p className="text-xs text-mute">{enEspera === 1 ? 'persona en la fila' : 'personas en la fila'}</p>
        </div>
        <div className="rounded-xl bg-surface p-3">
          <p className="font-display text-4xl font-bold">{espera() <= 0 ? '0' : espera()}</p>
          <p className="text-xs text-mute">min de espera si llegás ahora</p>
        </div>
      </div>

      {abierto ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Tu nombre
            <input className={`${input} mt-1`} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
          </label>
          <label className="block text-sm font-medium">
            WhatsApp (opcional, para avisarte cuando falten 2)
            <input className={`${input} mt-1`} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="3496 ..." />
          </label>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <Button className="w-full py-3 text-base" onClick={anotarse}>
            Anotarme en la fila
          </Button>
        </div>
      ) : (
        <p className="text-sm font-medium">
          {proxima ? `Ahora no estamos atendiendo. Volvemos a las ${proxima.desde}.` : `Hoy ya cerramos (atendimos ${formatFranjas(dia.franjas)}).`}
        </p>
      )}
    </div>
  );
}
