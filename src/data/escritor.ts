import { useEffect, useRef, useSyncExternalStore } from 'react';
import { describirError } from './errores';

export type EstadoGuardado = { estado: 'ok' } | { estado: 'guardando' } | { estado: 'error'; mensaje: string };

type Item = { patch: Record<string, unknown>; enviar: (patch: never) => Promise<void> };

/**
 * Guarda cambios "mientras se escribe" sin mandar un pedido por tecla:
 *  - junta los cambios de una misma clave y los manda juntos tras `demoraMs` quieto;
 *  - manda de a uno y en orden (el último cambio siempre gana);
 *  - si falla, se queda con el cambio y lo reintenta con `reintentar()`.
 */
export class Escritor {
  private espera = new Map<string, Item>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private fallidos = new Map<string, Item>();
  private enVuelo = 0;
  private cola: Promise<void> = Promise.resolve();
  private ultimoError: unknown;
  private subs = new Set<() => void>();
  private snap: EstadoGuardado = { estado: 'ok' };

  constructor(private demoraMs = 400) {}

  programar<P extends Record<string, unknown>>(clave: string, patch: P, enviar: (patch: P) => Promise<void>): void {
    const previo = this.espera.get(clave) ?? this.fallidos.get(clave);
    this.fallidos.delete(clave);
    this.espera.set(clave, { patch: { ...previo?.patch, ...patch }, enviar: enviar as Item['enviar'] });
    clearTimeout(this.timers.get(clave));
    this.timers.set(clave, setTimeout(() => this.despachar(clave), this.demoraMs));
    this.emitir();
  }

  /** Manda ya todo lo que está esperando (al salir de la pantalla, por ejemplo). */
  vaciar(): void {
    for (const clave of [...this.espera.keys()]) {
      clearTimeout(this.timers.get(clave));
      this.despachar(clave);
    }
  }

  /** Vuelve a mandar lo que falló. */
  reintentar(): void {
    for (const [clave, item] of this.fallidos) {
      if (!this.espera.has(clave)) this.espera.set(clave, item);
    }
    this.fallidos.clear();
    this.vaciar();
  }

  private despachar(clave: string): void {
    this.timers.delete(clave);
    const item = this.espera.get(clave);
    if (!item) return;
    this.espera.delete(clave);
    this.enVuelo++;
    this.cola = this.cola.then(async () => {
      try {
        await item.enviar(item.patch as never);
      } catch (e) {
        this.ultimoError = e;
        const nuevo = this.espera.get(clave);
        // Si mientras tanto se editó lo mismo, lo nuevo pisa a lo viejo pero no lo pierde.
        if (nuevo) this.espera.set(clave, { ...nuevo, patch: { ...item.patch, ...nuevo.patch } });
        else this.fallidos.set(clave, item);
      } finally {
        this.enVuelo--;
        this.emitir();
      }
    });
    this.emitir();
  }

  private calcular(): EstadoGuardado {
    if (this.espera.size + this.enVuelo > 0) return { estado: 'guardando' };
    if (this.fallidos.size > 0) return { estado: 'error', mensaje: describirError(this.ultimoError) };
    return { estado: 'ok' };
  }

  private emitir(): void {
    const n = this.calcular();
    const igual =
      n.estado === this.snap.estado && (n.estado !== 'error' || (this.snap.estado === 'error' && n.mensaje === this.snap.mensaje));
    if (igual) return;
    this.snap = n;
    this.subs.forEach((f) => f());
  }

  suscribir = (f: () => void): (() => void) => {
    this.subs.add(f);
    return () => this.subs.delete(f);
  };
  leer = (): EstadoGuardado => this.snap;
}

/** Un `Escritor` por pantalla + su estado para mostrar "Guardando…" / "No se pudo guardar". */
export function useEscritor(demoraMs?: number) {
  const ref = useRef<Escritor | null>(null);
  ref.current ??= new Escritor(demoraMs);
  const escritor = ref.current;
  const guardado = useSyncExternalStore(escritor.suscribir, escritor.leer);

  useEffect(() => {
    // Con cambios sin guardar, el navegador avisa antes de cerrar la pestaña.
    const avisar = (ev: BeforeUnloadEvent) => {
      if (escritor.leer().estado !== 'ok') ev.preventDefault();
    };
    window.addEventListener('beforeunload', avisar);
    return () => {
      window.removeEventListener('beforeunload', avisar);
      // Al salir de la pantalla no se pierde lo que quedó esperando.
      escritor.vaciar();
    };
  }, [escritor]);

  return { escritor, guardado };
}
