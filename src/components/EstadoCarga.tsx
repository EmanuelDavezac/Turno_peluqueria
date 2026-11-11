import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import type { EstadoGuardado } from '@/data/escritor';
import type { Cargable } from '@/data/recurso';

/** Mientras se traen los datos. Nunca pantalla en blanco. */
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto flex min-h-[40vh] max-w-md items-center justify-center gap-3 text-mute">
      <Loader2 size={20} className="animate-spin" aria-hidden />
      <span>{texto}</span>
    </div>
  );
}

/** Falló la carga: dice qué pasó y deja reintentar. */
export function ErrorCarga({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md space-y-3 rounded-2xl border border-red-300 bg-surface p-6 text-center">
      <AlertTriangle size={28} className="mx-auto text-red-600" aria-hidden />
      <p className="text-lg font-bold">No pudimos cargar los datos</p>
      <p className="text-sm text-mute">{mensaje}</p>
      <Button onClick={onReintentar}>Reintentar</Button>
    </div>
  );
}

/** Resuelve cualquier `Cargable` a cargando / error / contenido. */
export function Pantalla<T>({ recurso, texto, children }: { recurso: Cargable<T>; texto?: string; children: (datos: T) => ReactNode }) {
  if (recurso.estado === 'cargando') return <Cargando texto={texto} />;
  if (recurso.estado === 'error') return <ErrorCarga mensaje={recurso.mensaje} onReintentar={recurso.reintentar} />;
  return <>{children(recurso.datos)}</>;
}

/** Estado de los cambios que se guardan solos. En "ok" no muestra nada. */
export function AvisoGuardado({ guardado, onReintentar }: { guardado: EstadoGuardado; onReintentar: () => void }) {
  if (guardado.estado === 'ok') return null;
  if (guardado.estado === 'guardando') {
    return (
      <p
        role="status"
        aria-live="polite"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-mute shadow"
      >
        <Loader2 size={14} className="animate-spin" aria-hidden /> Guardando…
      </p>
    );
  }
  return (
    <div role="alert" className="fixed bottom-4 right-4 z-40 flex max-w-sm items-center gap-3 rounded-xl border border-red-300 bg-surface px-4 py-3 text-sm shadow">
      <AlertTriangle size={18} className="shrink-0 text-red-600" aria-hidden />
      <span className="flex-1">No se guardó el último cambio. {guardado.mensaje}</span>
      <Button variante="ghost" className="shrink-0 px-3 py-1.5" onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  );
}

/** Error de una acción puntual (agregar, borrar…), con reintento. */
export function AvisoError({ mensaje, onReintentar, onCerrar }: { mensaje: string; onReintentar?: () => void; onCerrar: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-300 bg-surface px-4 py-3 text-sm">
      <AlertTriangle size={18} className="shrink-0 text-red-600" aria-hidden />
      <span className="min-w-0 flex-1 font-medium">{mensaje}</span>
      {onReintentar && (
        <Button variante="ghost" className="px-3 py-1.5" onClick={onReintentar}>
          Reintentar
        </Button>
      )}
      <Button variante="ghost" className="px-3 py-1.5" onClick={onCerrar}>
        Cerrar
      </Button>
    </div>
  );
}
