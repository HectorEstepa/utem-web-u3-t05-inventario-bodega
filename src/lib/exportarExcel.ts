import * as XLSX from 'xlsx';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  listarMovimientosGlobales,
  listarProductos,
  obtenerResumenEjecutivo,
} from '../db/inventario';
import { estadoDeStock, ETIQUETA_ESTADO, formatearCLP } from './stock';

/**
 * Genera un libro Excel (.xlsx) real con tres hojas estructuradas:
 *   1. Resumen_Ejecutivo (KPIs financieros y operativos en CLP)
 *   2. Inventario (catálogo completo con stock, mínimo, estado y valorización)
 *   3. Movimientos (bitácora auditable de entradas y salidas con montos)
 *
 * Se escribe como binario Uint8Array directo en el directorio de caché del
 * dispositivo mediante la API moderna de expo-file-system (SDK 58) y se
 * entrega al menú nativo de compartir de iOS / Android (AirDrop, Archivos,
 * WhatsApp, Correo).
 */
export async function exportarReporteExcel(db: SQLiteDatabase): Promise<string> {
  const [resumen, productos, movimientos] = await Promise.all([
    obtenerResumenEjecutivo(db),
    listarProductos(db),
    listarMovimientosGlobales(db, { limite: 2000 }),
  ]);

  const ahora = new Date();
  const marcaArchivo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(ahora.getDate()).padStart(2, '0')}_${String(ahora.getHours()).padStart(
    2,
    '0'
  )}${String(ahora.getMinutes()).padStart(2, '0')}`;

  // Hoja 1: Resumen Ejecutivo
  const filasResumen = [
    { Indicador: 'Fecha de generación', Valor: ahora.toLocaleString('es-CL'), Monto_CLP: '' },
    { Indicador: 'Total SKUs registrados', Valor: resumen.totalSkus, Monto_CLP: '' },
    { Indicador: 'Unidades físicas en bodega', Valor: resumen.unidadesTotales, Monto_CLP: '' },
    {
      Indicador: 'Capital valorizado en bodega',
      Valor: resumen.valorInventarioCLP,
      Monto_CLP: formatearCLP(resumen.valorInventarioCLP),
    },
    {
      Indicador: 'Total salidas / despachos acumulados',
      Valor: resumen.salidasUnidades,
      Monto_CLP: formatearCLP(resumen.salidasMontoCLP),
    },
    {
      Indicador: 'Total entradas / recepciones acumuladas',
      Valor: resumen.entradasUnidades,
      Monto_CLP: formatearCLP(resumen.entradasMontoCLP),
    },
    { Indicador: 'SKUs óptimos (en stock)', Valor: resumen.skusOptimos, Monto_CLP: '' },
    { Indicador: 'SKUs bajo stock mínimo', Valor: resumen.skusBajoMinimo, Monto_CLP: '' },
    { Indicador: 'SKUs agotados (stock 0)', Valor: resumen.skusAgotados, Monto_CLP: '' },
    { Indicador: 'Movimientos registrados', Valor: resumen.totalMovimientos, Monto_CLP: '' },
  ];

  // Hoja 2: Inventario valorizado
  const filasInventario = productos.map((p) => {
    const est = estadoDeStock(p);
    const total = p.stock * p.precio;
    return {
      Codigo_GTIN: p.codigo,
      Producto: p.nombre,
      Stock_Actual: p.stock,
      Stock_Minimo: p.minimo,
      Estado: ETIQUETA_ESTADO[est].texto,
      Precio_Unitario_CLP: p.precio,
      Valor_Total_CLP: total,
      Valor_Formateado: formatearCLP(total),
      Fecha_Alta: new Date(p.creado_en).toLocaleDateString('es-CL'),
    };
  });

  // Hoja 3: Historial de entradas y salidas
  const filasMovimientos = movimientos.map((m) => {
    const totalMov = m.cantidad * m.precio_unitario;
    return {
      ID: m.id,
      Fecha_Hora: new Date(m.fecha).toLocaleString('es-CL'),
      Tipo: m.tipo === 'IN' ? 'ENTRADA' : 'SALIDA',
      Codigo_GTIN: m.codigo,
      Producto: m.nombre_producto,
      Cantidad: m.cantidad,
      Precio_Unitario_CLP: m.precio_unitario,
      Subtotal_CLP: totalMov,
      Subtotal_Formateado: formatearCLP(totalMov),
      Nota: m.nota || '',
    };
  });

  const libro = XLSX.utils.book_new();
  const wsResumen = XLSX.utils.json_to_sheet(filasResumen);
  const wsInv = XLSX.utils.json_to_sheet(
    filasInventario.length > 0
      ? filasInventario
      : [{ Aviso: 'Sin productos registrados en bodega' }]
  );
  const wsMov = XLSX.utils.json_to_sheet(
    filasMovimientos.length > 0
      ? filasMovimientos
      : [{ Aviso: 'Sin movimientos registrados en bodega' }]
  );

  wsResumen['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 18 }];
  wsInv['!cols'] = [
    { wch: 16 },
    { wch: 30 },
    { wch: 13 },
    { wch: 13 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
  ];
  wsMov['!cols'] = [
    { wch: 8 },
    { wch: 20 },
    { wch: 11 },
    { wch: 16 },
    { wch: 28 },
    { wch: 10 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(libro, wsResumen, 'Resumen_Ejecutivo');
  XLSX.utils.book_append_sheet(libro, wsInv, 'Inventario');
  XLSX.utils.book_append_sheet(libro, wsMov, 'Movimientos');

  const bytes = XLSX.write(libro, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const nombreArchivo = `Reporte_Bodega_${marcaArchivo}.xlsx`;
  const archivo = new File(Paths.cache, nombreArchivo);

  if (archivo.exists) {
    archivo.delete();
  }
  archivo.create({ overwrite: true });
  await archivo.write(new Uint8Array(bytes));

  const disponible = await Sharing.isAvailableAsync();
  if (!disponible) {
    throw new Error(`Archivo generado en caché (${nombreArchivo}), pero el menú Compartir no está disponible en este entorno.`);
  }

  await Sharing.shareAsync(archivo.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar reporte de inventario (.xlsx)',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });

  return nombreArchivo;
}
