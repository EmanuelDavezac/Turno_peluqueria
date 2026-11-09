import { Lock } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { useStore } from '@/data/local/store';

const CLAVE_SESION = 'turnero-panel-ok';

export const sesionPanelAbierta = () => sessionStorage.getItem(CLAVE_SESION) === '1';
export const cerrarSesionPanel = () => sessionStorage.removeItem(CLAVE_SESION);

/** Pide el PIN del local antes de mostrar el panel. La sesión dura hasta cerrar la pestaña. */
export function PinGate({ children }: { children: ReactNode }) {
  const pin = useStore((s) => s.local.pin);
  const nombre = useStore((s) => s.local.nombre);
  const [abierto, setAbierto] = useState(sesionPanelAbierta);
  const [valor, setValor] = useState('');
  const [error, setError] = useState(false);

  if (abierto) return <>{children}</>;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (valor === pin) {
      sessionStorage.setItem(CLAVE_SESION, '1');
      setAbierto(true);
    } else {
      setError(true);
      setValor('');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={enviar} className="w-full max-w-xs space-y-4 rounded-2xl border border-line bg-surface p-6 text-center">
        <Lock className="mx-auto text-mute" size={32} aria-hidden />
        <div>
          <h1 className="text-xl font-bold">{nombre}</h1>
          <p className="text-sm text-mute">Panel de administración</p>
        </div>
        <label className="block text-left text-sm font-medium">
          PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            value={valor}
            aria-invalid={error}
            onChange={(e) => { setValor(e.target.value); setError(false); }}
            className={`mt-1 w-full rounded-lg border bg-surface px-3 py-2.5 text-center text-2xl tracking-[0.5em] ${error ? 'border-red-500' : 'border-line'}`}
          />
        </label>
        {error && <p role="alert" className="text-sm font-medium text-red-600">PIN incorrecto.</p>}
        <Button type="submit" className="w-full py-3">
          Entrar
        </Button>
        <a href="/reservas" className="block text-sm text-mute underline">
          Ir a la página de reservas
        </a>
      </form>
    </div>
  );
}
