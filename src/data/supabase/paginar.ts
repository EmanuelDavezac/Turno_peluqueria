const PAGINA = 1000; // tope de filas por pedido de la API

/**
 * Lee todas las filas de una consulta aunque superen el tope de la API (1000).
 * `pedir` recibe el rango (desde, hasta) inclusive y tiene que ordenar de forma estable.
 */
export async function leerTodo<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pagina = PAGINA,
): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await pedir(desde, desde + pagina - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < pagina) return out;
  }
}
