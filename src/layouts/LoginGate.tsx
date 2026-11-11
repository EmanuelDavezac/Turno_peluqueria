import { Lock } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { describirError, esErrorDeRed } from '@/data/errores';
import { llegoPorRecuperacion, supabase } from '@/data/supabase/client';

// Mientras se elige la contraseña nueva, la sesión del link NO abre el panel.
let enRecuperacion = llegoPorRecuperacion;

type Estado =
  | { fase: 'cargando' }
  | { fase: 'sin_sesion' }
  | { fase: 'recuperando' } // llegó por el link del mail para elegir una contraseña nueva
  | { fase: 'fallo'; mensaje: string } // no se pudo verificar el acceso (sin conexión, sesión vencida…)
  | { fase: 'sin_acceso'; email: string } // tiene cuenta pero no está en usuarios_panel
  | { fase: 'ok' };

const input = 'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base';

export const cerrarSesion = () => supabase.auth.signOut();

/** Traduce los errores de Auth. No distingue "mail inexistente" de "clave mala" a propósito. */
function mensajeError(msg: string, status?: number, err?: unknown): string {
  if (err && esErrorDeRed(err)) return describirError(err);
  if (status === 429 || /rate limit|too many/i.test(msg)) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
  if (/invalid login|invalid credentials/i.test(msg)) return 'Mail o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Falta confirmar el mail.';
  if (/password.*(short|least|weak)|weak/i.test(msg)) return 'La contraseña es muy débil: usá al menos 8 caracteres.';
  return 'No se pudo completar la operación. Probá de nuevo.';
}

/** Exige login (Supabase Auth) y pertenecer a usuarios_panel antes de mostrar el panel. */
export function LoginGate({ children }: { children: ReactNode }) {
  const [nombre, setNombre] = useState('');
  useEffect(() => {
    let vivo = true;
    // El nombre es público. Si no se puede leer, la pantalla de ingreso funciona igual.
    import('@/data/supabase/negocio').then((m) => m.leerNombreNegocio()).then((n) => vivo && setNombre(n), () => {});
    return () => {
      vivo = false;
    };
  }, []);
  const [estado, setEstado] = useState<Estado>(enRecuperacion ? { fase: 'recuperando' } : { fase: 'cargando' });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;

    async function resolver(sesion: { user: { email?: string } } | null) {
      if (enRecuperacion) return;
      if (!sesion) return vivo && setEstado({ fase: 'sin_sesion' });
      // Tener cuenta no alcanza: la base decide si es del panel (es_panel()).
      const { data, error } = await supabase.rpc('es_panel');
      if (!vivo || enRecuperacion) return;
      // Si no se pudo preguntar (sin conexión, sesión vencida) NO es "sin acceso": se avisa y se deja reintentar.
      if (error) return setEstado({ fase: 'fallo', mensaje: describirError(error) });
      setEstado(data === true ? { fase: 'ok' } : { fase: 'sin_acceso', email: sesion.user.email ?? '' });
    }

    supabase.auth.getSession().then(({ data }) => {
      if (vivo) void resolver(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (evento === 'PASSWORD_RECOVERY') {
        enRecuperacion = true;
        return vivo && setEstado({ fase: 'recuperando' });
      }
      if (evento === 'INITIAL_SESSION') return;
      // Se mira acá, de forma síncrona: dentro del setTimeout la bandera ya podría haber cambiado.
      if (enRecuperacion) return;
      // setTimeout: no hacer llamadas a Supabase dentro del callback (puede trabarse).
      setTimeout(() => void resolver(sesion), 0);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [intento]);

  if (estado.fase === 'ok') return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xs space-y-4 rounded-2xl border border-line bg-surface p-6 text-center">
        <Lock className="mx-auto text-mute" size={32} aria-hidden />
        <div>
          <h1 className="text-xl font-bold">{nombre || 'Turnero'}</h1>
          <p className="text-sm text-mute">Panel de administración</p>
        </div>
        {estado.fase === 'cargando' && <p className="text-sm text-mute" role="status">Cargando…</p>}
        {estado.fase === 'sin_sesion' && <FormLogin />}
        {estado.fase === 'recuperando' && <FormNuevaClave onListo={() => setEstado({ fase: 'sin_sesion' })} />}
        {estado.fase === 'fallo' && (
          <div className="space-y-3">
            <p role="alert" className="text-sm font-medium text-red-600">{estado.mensaje}</p>
            <Button className="w-full" onClick={() => { setEstado({ fase: 'cargando' }); setIntento((n) => n + 1); }}>
              Reintentar
            </Button>
          </div>
        )}
        {estado.fase === 'sin_acceso' && (
          <div className="space-y-3">
            <p role="alert" className="text-sm font-medium text-red-600">
              {estado.email ? `${estado.email} no` : 'Tu cuenta no'} tiene acceso al panel.
            </p>
            <Button variante="ghost" className="w-full" onClick={() => void cerrarSesion()}>
              Cambiar de cuenta
            </Button>
          </div>
        )}
        <a href="/reservas" className="block text-sm text-mute underline">
          Ir a la página de reservas
        </a>
      </div>
    </div>
  );
}

function FormLogin() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setAviso(''); setEnviando(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
    setEnviando(false);
    if (err) {
      setClave('');
      setError(mensajeError(err.message, err.status, err));
    }
  };

  const olvide = async () => {
    setError(''); setAviso('');
    if (!email.trim()) return setError('Escribí tu mail y volvé a tocar "Olvidé mi contraseña".');
    setEnviando(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/panel` });
    setEnviando(false);
    if (err) return setError(mensajeError(err.message, err.status, err));
    // Mismo mensaje exista o no el mail, para no revelar quién tiene cuenta.
    setAviso('Si el mail tiene cuenta, te mandamos un link para elegir una contraseña nueva.');
  };

  return (
    <form onSubmit={entrar} className="space-y-3 text-left">
      <label className="block text-sm font-medium">
        Mail
        <input type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </label>
      <label className="block text-sm font-medium">
        Contraseña
        <input type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} className={input} />
      </label>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      {aviso && <p role="status" className="text-sm font-medium text-turnos">{aviso}</p>}
      <Button type="submit" className="w-full py-3" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </Button>
      <button type="button" onClick={() => void olvide()} disabled={enviando} className="block w-full text-center text-sm text-mute underline">
        Olvidé mi contraseña
      </button>
    </form>
  );
}

function FormNuevaClave({ onListo }: { onListo: () => void }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (clave.length < 8) return setError('Usá al menos 8 caracteres.');
    setError(''); setEnviando(true);
    const { error: err } = await supabase.auth.updateUser({ password: clave });
    setEnviando(false);
    if (err) return setError(mensajeError(err.message, err.status, err));
    // Limpia el #access_token de la URL y pide entrar con la contraseña nueva.
    window.history.replaceState(null, '', window.location.pathname);
    enRecuperacion = false;
    await supabase.auth.signOut();
    onListo();
  };

  return (
    <form onSubmit={guardar} className="space-y-3 text-left">
      <p className="text-sm font-medium">Elegí tu contraseña nueva.</p>
      <label className="block text-sm font-medium">
        Contraseña nueva
        <input type="password" autoComplete="new-password" autoFocus required minLength={8} value={clave} onChange={(e) => setClave(e.target.value)} className={input} />
      </label>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      <Button type="submit" className="w-full py-3" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar contraseña'}
      </Button>
    </form>
  );
}
