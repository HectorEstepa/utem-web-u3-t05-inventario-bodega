import type { SQLiteDatabase } from 'expo-sqlite';
import type { Periodo } from '../lib/periodo.ts';
import { contarMovimientos, filtroMovimientos, listarMovimientosGlobales, listarProductos, obtenerResumenEjecutivo, type MovimientoDetallado, type Producto, type ResumenEjecutivo } from './inventario.ts';

export interface FlujoProducto {
  codigo: string; nombre: string; entradas: number; salidas: number;
  montoEntradas: number; montoSalidas: number; primeraFecha: number; ultimaFecha: number;
}
export interface FlujoDia extends FlujoProducto { dia: string }
export interface DatosReporte {
  periodo: Periodo; generadoEn: number; zonaHoraria: string;
  resumen: ResumenEjecutivo; productos: Producto[]; movimientos: MovimientoDetallado[];
  porProducto: FlujoProducto[]; porDia: FlujoDia[];
}
export const MAX_MOVIMIENTOS_REPORTE = 20000;

/** Todas las hojas leen la misma instantánea; nunca se trunca un período en silencio. */
export async function cargarDatosReporte(db: SQLiteDatabase, periodo: Periodo): Promise<DatosReporte> {
  let resultado: DatosReporte | undefined;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const n = await contarMovimientos(tx, { periodo });
    if (n > MAX_MOVIMIENTOS_REPORTE) throw new Error(`Hay ${n.toLocaleString('es-CL')} movimientos en este período. Elige fechas más acotadas para exportar hasta 20.000 por reporte.`);
    const { where, params } = filtroMovimientos({ periodo });
    const columnas = `m.codigo, COALESCE(p.nombre, m.codigo) AS nombre,
      SUM(CASE WHEN m.tipo = 'IN' THEN m.cantidad ELSE 0 END) AS entradas,
      SUM(CASE WHEN m.tipo = 'OUT' THEN m.cantidad ELSE 0 END) AS salidas,
      SUM(CASE WHEN m.tipo = 'IN' THEN m.cantidad * m.precio_unitario ELSE 0 END) AS montoEntradas,
      SUM(CASE WHEN m.tipo = 'OUT' THEN m.cantidad * m.precio_unitario ELSE 0 END) AS montoSalidas,
      MIN(m.fecha) AS primeraFecha, MAX(m.fecha) AS ultimaFecha`;
    const base = `FROM movimientos m LEFT JOIN productos p ON p.codigo = m.codigo ${where}`;
    const resumen = await obtenerResumenEjecutivo(tx, periodo);
    const productos = await listarProductos(tx);
    const movimientos = await listarMovimientosGlobales(tx, { periodo, limite: MAX_MOVIMIENTOS_REPORTE });
    const porProducto = await tx.getAllAsync<FlujoProducto>(`SELECT ${columnas} ${base} GROUP BY m.codigo ORDER BY nombre, m.codigo`, ...params);
    const porDia = await tx.getAllAsync<FlujoDia>(`SELECT date(m.fecha / 1000, 'unixepoch', 'localtime') AS dia, ${columnas} ${base} GROUP BY dia, m.codigo ORDER BY dia, nombre, m.codigo`, ...params);
    resultado = { periodo, generadoEn: Date.now(), zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone, resumen, productos, movimientos, porProducto, porDia };
  });
  if (!resultado) throw new Error('No se pudo preparar el reporte.');
  return resultado;
}
