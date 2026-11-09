import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useStore } from '@/data/local/store';
import { buscarClientes, fichaCliente } from '@/domain/clientes';
import type { Cliente } from '@/domain/types';
import { fechaLarga } from '@/lib/format';

const field = 'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base';
const fechaCorta = (iso?: string) => (iso ? format(parseISO(iso), 'd MMM yyyy', { locale: es }) : '—');

/** Alta y edición de un cliente. `cliente` null = alta nueva. */
function FichaDialog({ cliente, abierto, onCerrar }: { cliente: Cliente | null; abierto: boolean; onCerrar: () => void }) {
  const { turnos, servicios, profesionales, addCliente, updateCliente } = useStore();
  const [nombre, setNombre] = useState(cliente?.nombre ?? '');
  const [whatsapp, setWhatsapp] = useState(cliente?.whatsapp ?? '');
  const [notas, setNotas] = useState(cliente?.notas ?? '');
  const [error, setError] = useState('');

  const historial = cliente
    ? turnos.filter((t) => t.clienteId === cliente.id && t.estado === 'atendido').sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5)
    : [];

  const guardar = () => {
    if (!nombre.trim()) return setError('El nombre es obligatorio.');
    if (cliente) updateCliente(cliente.id, { nombre: nombre.trim(), whatsapp: whatsapp.trim(), notas: notas.trim() || undefined });
    else addCliente({ nombre: nombre.trim(), whatsapp: whatsapp.trim(), notas: notas.trim() });
    onCerrar();
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} title={cliente ? 'Ficha del cliente' : 'Nuevo cliente'}>
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          Nombre
          <input className={field} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          WhatsApp
          <input className={field} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="3496 ..." />
        </label>
        <label className="block text-sm font-medium">
          Notas
          <textarea className={field} rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: máquina 2 a los costados" />
        </label>
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}

        {cliente && (
          <div>
            <p className="mb-1 text-sm font-semibold">Últimas visitas</p>
            {historial.length ? (
              <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                {historial.map((t) => (
                  <li key={t.id} className="flex justify-between gap-3 px-3 py-2">
                    <span className="first-letter:uppercase">{fechaLarga(t.fecha)}</span>
                    <span className="truncate text-mute">
                      {servicios.find((s) => s.id === t.servicioId)?.nombre} · {profesionales.find((p) => p.id === t.profesionalId)?.nombre}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mute">Todavía no tiene visitas registradas.</p>
            )}
          </div>
        )}
      </div>
      <div className="mt-5 flex gap-2">
        <Button variante="ghost" className="flex-1" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={guardar}>
          Guardar
        </Button>
      </div>
    </Dialog>
  );
}

export function ClientesPage() {
  const { clientes, turnos } = useStore();
  const [consulta, setConsulta] = useState('');
  const [sel, setSel] = useState<Cliente | null | undefined>(undefined); // undefined = cerrado, null = nuevo

  const fichas = useMemo(
    () =>
      buscarClientes(clientes, consulta)
        .map((c) => fichaCliente(c, turnos))
        .sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre, 'es')),
    [clientes, turnos, consulta],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-mute">{clientes.length} en total</p>
        </div>
        <Button onClick={() => setSel(null)}>
          <Plus size={16} /> Nuevo cliente
        </Button>
      </header>

      <label className="relative block">
        <span className="sr-only">Buscar cliente</span>
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar por nombre o WhatsApp"
          className="w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-3 text-base"
        />
      </label>

      {fichas.length ? (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {fichas.map(({ cliente, visitas, ultimaVisita }) => (
            <li key={cliente.id}>
              <button type="button" onClick={() => setSel(cliente)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{cliente.nombre}</p>
                  <p className="truncate text-sm text-mute">
                    {cliente.whatsapp || 'Sin WhatsApp'}
                    {cliente.notas ? ` · ${cliente.notas}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p className="font-semibold">{visitas} {visitas === 1 ? 'visita' : 'visitas'}</p>
                  <p className="text-mute">Última: {fechaCorta(ultimaVisita)}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-mute">
          {consulta ? 'No hay clientes que coincidan con la búsqueda.' : 'Todavía no hay clientes.'}
        </p>
      )}

      {/* key: reinicia los campos al cambiar de cliente */}
      <FichaDialog key={sel?.id ?? 'nuevo'} cliente={sel ?? null} abierto={sel !== undefined} onCerrar={() => setSel(undefined)} />
    </div>
  );
}
