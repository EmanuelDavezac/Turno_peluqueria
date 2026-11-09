import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NumeroInput } from '@/components/ui/NumeroInput';
import { TextoInput } from '@/components/ui/TextoInput';
import { Toggle } from '@/components/ui/Toggle';
import { BACKEND } from '@/data/backend';
import { useAhora, useHoy, useStore } from '@/data/local/store';
import { servicioEnUso } from '@/domain/clientes';

function Seccion({ id, titulo, ayuda, children }: { id: string; titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="text-xl font-bold">
          {titulo}
        </h2>
        {ayuda && <p className="text-sm text-mute">{ayuda}</p>}
      </div>
      {children}
    </section>
  );
}

export function ConfigPage() {
  const s = useStore();
  const { local, profesionales, servicios, turnos, fila, cobros } = s;
  const hoy = useHoy();
  const ahora = useAhora();

  const activos = profesionales.filter((p) => p.activo).length;

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header>
        <h1 className="text-3xl font-bold">Configuración</h1>
      </header>

      <Seccion id="local" titulo="El local">
        <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2">
          <div className="text-sm font-medium">
            <p aria-hidden>Nombre</p>
            <TextoInput className="mt-1" label="Nombre del local" value={local.nombre} onCommit={(v) => s.setLocal({ nombre: v })} />
          </div>
          <div className="text-sm font-medium">
            <p aria-hidden>Dirección</p>
            <TextoInput className="mt-1" label="Dirección" value={local.direccion} onCommit={(v) => s.setLocal({ direccion: v })} />
          </div>
          {BACKEND === 'local' && (
            <div className="text-sm font-medium">
              <p aria-hidden>PIN del panel</p>
              <TextoInput className="mt-1" label="PIN para entrar al panel" value={local.pin} onCommit={(v) => s.setLocal({ pin: v.trim() })} />
              <p className="mt-1 text-xs font-normal text-mute">Se pide al abrir el panel. Los clientes nunca lo ven.</p>
            </div>
          )}
        </div>
      </Seccion>

      <Seccion id="equipo" titulo="Equipo" ayuda="El color identifica al profesional en la agenda. La comisión se usa en Reportes.">
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {profesionales.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              <input
                type="color"
                aria-label={`Color de ${p.nombre}`}
                value={p.color}
                onChange={(e) => s.updateProfesional(p.id, { color: e.target.value })}
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-0.5"
              />
              <TextoInput className="min-w-[10rem] flex-1" label="Nombre del profesional" value={p.nombre} onCommit={(v) => s.updateProfesional(p.id, { nombre: v })} />
              <NumeroInput className="w-28" label={`Comisión de ${p.nombre}`} value={p.comisionPct} min={0} max={100} sufijo="%" onCommit={(n) => s.updateProfesional(p.id, { comisionPct: n })} />
              <div className="flex items-center gap-2">
                <Toggle
                  compacto
                  label={`${p.nombre} activo`}
                  checked={p.activo}
                  // siempre tiene que quedar al menos un profesional activo
                  disabled={p.activo && activos <= 1}
                  onChange={(v) => s.updateProfesional(p.id, { activo: v })}
                />
                <span className="w-14 text-sm text-mute">{p.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
            </li>
          ))}
        </ul>
        <Button variante="ghost" onClick={() => s.addProfesional()}>
          <Plus size={16} /> Agregar profesional
        </Button>
      </Seccion>

      <Seccion id="servicios" titulo="Servicios" ayuda="La duración define cuántos horarios ocupa un turno (de a 30 minutos).">
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {servicios.map((sv) => {
            const enUso = servicioEnUso(sv.id, turnos, fila, cobros);
            return (
              <li key={sv.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 p-3 sm:grid-cols-[1fr_7.5rem_9rem_auto] sm:gap-3">
                <TextoInput className="col-span-3 sm:col-span-1" label="Nombre del servicio" value={sv.nombre} onCommit={(v) => s.updateServicio(sv.id, { nombre: v })} />
                <NumeroInput label={`Duración de ${sv.nombre}`} value={sv.duracionMin} min={5} max={480} sufijo="min" onCommit={(n) => s.updateServicio(sv.id, { duracionMin: n })} />
                <NumeroInput label={`Precio de ${sv.nombre}`} value={sv.precio} min={0} sufijo="$" onCommit={(n) => s.updateServicio(sv.id, { precio: n })} />
                <button
                  type="button"
                  aria-label={`Borrar ${sv.nombre}`}
                  title={enUso ? 'Tiene turnos, fila o cobros: no se puede borrar' : 'Borrar servicio'}
                  disabled={enUso || servicios.length <= 1}
                  onClick={() => s.removeServicio(sv.id)}
                  className="rounded-lg p-2 text-mute hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
        <Button variante="ghost" onClick={() => s.addServicio()}>
          <Plus size={16} /> Agregar servicio
        </Button>
      </Seccion>

      <Seccion id="demo" titulo="Solo para la demo" ayuda="Sirve para mostrar el modo orden de llegada cualquier día de la semana y a cualquier hora.">
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Simular fecha de hoy
              <input type="date" value={hoy} onChange={(e) => s.setHoySimulado(e.target.value || null)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base" />
            </label>
            <label className="text-sm font-medium">
              Simular hora
              <input type="time" value={ahora.slice(11, 16)} onChange={(e) => s.setHoraSimulada(e.target.value || null)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variante="ghost" onClick={() => { s.setHoySimulado(null); s.setHoraSimulada(null); }}>
              Volver a fecha y hora reales
            </Button>
            <Button
              variante="danger"
              onClick={() => {
                if (window.confirm('Esto borra los datos cargados y vuelve a los datos de ejemplo. ¿Seguro?')) s.resetDemo();
              }}
            >
              Restablecer datos de ejemplo
            </Button>
          </div>
        </div>
      </Seccion>
    </div>
  );
}
