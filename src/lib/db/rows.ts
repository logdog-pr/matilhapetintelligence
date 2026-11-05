/** Normaliza o retorno de db.execute (node-postgres/PGlite → {rows}; postgres-js → array). */
export function rowsOf<T>(res: unknown): T[] {
  return (Array.isArray(res) ? res : ((res as { rows?: T[] }).rows ?? [])) as T[];
}
