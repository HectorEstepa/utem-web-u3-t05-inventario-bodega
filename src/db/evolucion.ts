import type { SQLiteDatabase } from 'expo-sqlite';
import { validarPeriodo, type Periodo } from '../lib/periodo.ts';

export interface PuntoEvolucion { desde: number; hasta: number; entradas: number; salidas: number }
export interface Evolucion { puntos: PuntoEvolucion[]; agrupacion: 'día' | 'mes' | 'año' }

/** Agrega en SQLite y completa intervalos sin actividad con cero, sin cargar eventos en memoria. */
export async function obtenerEvolucion(db: SQLiteDatabase, periodo: Periodo, ahora = Date.now()): Promise<Evolucion> {
  validarPeriodo(periodo);
  const limites = await db.getFirstAsync<{ primera: number | null; ultima: number | null }>(
    "SELECT MIN(fecha) AS primera, MAX(fecha) AS ultima FROM movimientos WHERE tipo IN ('IN','OUT')"
  );
  if (periodo.desde === null && limites?.primera == null) return { puntos: [], agrupacion: 'día' };
  const inicio = new Date(periodo.desde ?? limites?.primera ?? ahora);
  inicio.setHours(0, 0, 0, 0);
  const fin = periodo.hasta ?? (() => { const d = new Date(Math.max(ahora, limites?.ultima ?? ahora)); d.setHours(24, 0, 0, 0); return d.getTime(); })();
  const dias = (fin - inicio.getTime()) / 86_400_000;
  const agrupacion = dias <= 120 ? 'día' : dias <= 366 * 8 ? 'mes' : 'año';
  const formato = agrupacion === 'día' ? '%Y-%m-%d' : agrupacion === 'mes' ? '%Y-%m' : '%Y';
  const filas = await db.getAllAsync<{ clave: string; entradas: number; salidas: number }>(
    `SELECT strftime('${formato}',fecha / 1000,'unixepoch','localtime') AS clave,
      SUM(CASE WHEN tipo='IN' THEN cantidad ELSE 0 END) AS entradas,
      SUM(CASE WHEN tipo='OUT' THEN cantidad ELSE 0 END) AS salidas
     FROM movimientos WHERE fecha >= ? AND fecha < ? AND tipo IN ('IN','OUT') GROUP BY clave`, inicio.getTime(), fin
  );
  const porClave = new Map(filas.map((f) => [f.clave, f]));
  const puntos: PuntoEvolucion[] = [];
  const cursor = new Date(inicio);
  if (agrupacion !== 'día') cursor.setDate(1);
  if (agrupacion === 'año') cursor.setMonth(0);
  while (cursor.getTime() < fin) {
    const desde = Math.max(inicio.getTime(), cursor.getTime());
    const clave = `${cursor.getFullYear()}${agrupacion !== 'año' ? `-${String(cursor.getMonth() + 1).padStart(2, '0')}` : ''}${agrupacion === 'día' ? `-${String(cursor.getDate()).padStart(2, '0')}` : ''}`;
    if (agrupacion === 'día') cursor.setDate(cursor.getDate() + 1);
    else if (agrupacion === 'mes') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setFullYear(cursor.getFullYear() + 1);
    const fila = porClave.get(clave);
    puntos.push({ desde, hasta: Math.min(fin, cursor.getTime()), entradas: fila?.entradas ?? 0, salidas: fila?.salidas ?? 0 });
  }
  return { puntos, agrupacion };
}
