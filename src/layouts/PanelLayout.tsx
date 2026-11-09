import { BarChart3, CalendarDays, Clock, Cog, LogOut, MessageCircle, Moon, Receipt, Sun, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAhora, useHoy, useStore } from '@/data/local/store';
import { cerrarSesionPanel } from '@/layouts/PinGate';
import { hoyReal } from '@/lib/horas';

const NAV = [
  { to: 'agenda', label: 'Agenda', Icon: CalendarDays },
  { to: 'horarios', label: 'Horarios', Icon: Clock },
  { to: 'caja', label: 'Caja', Icon: Receipt },
  { to: 'clientes', label: 'Clientes', Icon: Users },
  { to: 'reportes', label: 'Reportes', Icon: BarChart3 },
  { to: 'recordatorios', label: 'Recordatorios', Icon: MessageCircle },
  { to: 'config', label: 'Configuración', Icon: Cog },
];

export function PanelLayout() {
  const hoy = useHoy();
  const { tema, setTema, hoySimulado, setHoySimulado, horaSimulada, setHoraSimulada, resetDemo } = useStore();
  const ahora = useAhora();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-3 md:block md:py-5">
          <span className="font-display text-2xl font-bold">Turnero</span>
          <button
            type="button"
            aria-label="Cambiar tema"
            onClick={() => setTema(tema === 'claro' ? 'oscuro' : 'claro')}
            className="rounded-lg p-2 text-mute hover:bg-sunken md:hidden"
          >
            {tema === 'claro' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:pb-0" aria-label="Panel">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive ? 'bg-brand text-brand-ink' : 'text-mute hover:bg-sunken hover:text-ink'
                }`
              }
            >
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden space-y-1 border-t border-line p-2 md:mt-4 md:block">
          <a href="/reservas" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-mute hover:bg-sunken hover:text-ink">
            <CalendarDays size={16} /> Página de reservas
          </a>
          <button
            type="button"
            onClick={() => setTema(tema === 'claro' ? 'oscuro' : 'claro')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-mute hover:bg-sunken hover:text-ink"
          >
            {tema === 'claro' ? <Moon size={16} /> : <Sun size={16} />} Tema {tema === 'claro' ? 'oscuro' : 'claro'}
          </button>
          <a
            href="/reservas"
            onClick={cerrarSesionPanel}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-mute hover:bg-sunken hover:text-ink"
          >
            <LogOut size={16} /> Salir del panel
          </a>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-line bg-sunken px-4 py-2 text-xs text-mute">
          <span className="font-semibold uppercase tracking-wide">Demo</span>
          <label className="flex items-center gap-2">
            Simular hoy:
            <input
              type="date"
              value={hoy}
              onChange={(e) => setHoySimulado(e.target.value || null)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-ink"
            />
          </label>
          <label className="flex items-center gap-2">
            Simular hora:
            <input
              type="time"
              value={ahora.slice(11, 16)}
              onChange={(e) => setHoraSimulada(e.target.value || null)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-ink"
            />
          </label>
          {((hoySimulado && hoySimulado !== hoyReal()) || horaSimulada) && (
            <button
              type="button"
              onClick={() => {
                setHoySimulado(null);
                setHoraSimulada(null);
              }}
              className="font-semibold underline"
            >
              Volver a fecha y hora reales
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Esto borra los datos cargados y vuelve a los datos de ejemplo. ¿Seguro?')) resetDemo();
            }}
            className="font-semibold underline"
          >
            Restablecer demo
          </button>
        </div>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
