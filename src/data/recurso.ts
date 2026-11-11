import { useCallback, useEffect, useRef, useState } from 'react';
import { describirError } from './errores';

/** Lo que ve una pantalla mientras trae datos: cargando, error (con reintento) o listo. */
export type Cargable<T> =
  | { estado: 'cargando' }
  | { estado: 'error'; mensaje: string; reintentar: () => void }
  | { estado: 'listo'; datos: T };

type Interno<T> = { estado: 'cargando' } | { estado: 'error'; mensaje: string } | { estado: 'listo'; datos: T };

/**
 * Trae un recurso una vez al montar y expone carga / error / reintento.
 * `recargar()` desde "listo" refresca en silencio (sin volver a mostrar "Cargando"
 * y sin perder lo que ya se ve); desde "error" vuelve a mostrar la carga.
 */
export function useCargar<T>(cargar: () => Promise<T>) {
  const [s, setS] = useState<Interno<T>>({ estado: 'cargando' });
  const [intento, setIntento] = useState(0);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  useEffect(() => {
    let vivo = true;
    setS((p) => (p.estado === 'listo' ? p : { estado: 'cargando' }));
    cargarRef.current().then(
      (datos) => vivo && setS({ estado: 'listo', datos }),
      (e) => vivo && setS((p) => (p.estado === 'listo' ? p : { estado: 'error', mensaje: describirError(e) })),
    );
    return () => {
      vivo = false;
    };
  }, [intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);
  /** Cambia los datos ya cargados (para actualizaciones optimistas). */
  const setDatos = useCallback(
    (f: (d: T) => T) => setS((p) => (p.estado === 'listo' ? { estado: 'listo', datos: f(p.datos) } : p)),
    [],
  );

  return { estado: s, recargar, setDatos };
}

/** Un recurso que nunca espera (modo local): siempre "listo". */
export const listo = <T,>(datos: T): Cargable<T> => ({ estado: 'listo', datos });

/** Vuelve a pedir los datos cada `ms` y cuando se vuelve a la pestaña (otros dispositivos pueden haber cambiado cosas). */
export function useRefresco(recargar: () => void, ms = 30_000): void {
  useEffect(() => {
    const id = window.setInterval(recargar, ms);
    const alVolver = () => document.visibilityState === 'visible' && recargar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [recargar, ms]);
}
