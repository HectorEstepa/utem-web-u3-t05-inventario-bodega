import XLSX from 'xlsx-js-style';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  listarMovimientosGlobales,
  listarProductos,
  obtenerResumenEjecutivo,
} from '../db/inventario';
import { estadoDeStock, ETIQUETA_ESTADO } from './stock';

const BORDE_FINO = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

const ESTILO_TITULO = {
  font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '0369A1' } },
  alignment: { horizontal: 'left', vertical: 'center' },
};

const ESTILO_SUBTITULO = {
  font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '0369A1' } },
  fill: { fgColor: { rgb: 'E0F2FE' } },
  alignment: { horizontal: 'left', vertical: 'center' },
};

const ESTILO_SECCION = {
  font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0F172A' } },
  fill: { fgColor: { rgb: 'E0F2FE' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDE_FINO,
};

const ESTILO_CABECERA = {
  font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '0284C7' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDE_FINO,
};

const ESTILO_TOTAL = {
  font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '0F172A' } },
  fill: { fgColor: { rgb: 'BAE6FD' } },
  border: {
    top: { style: 'medium', color: { rgb: '0284C7' } },
    bottom: { style: 'medium', color: { rgb: '0284C7' } },
    left: { style: 'thin', color: { rgb: '94A3B8' } },
    right: { style: 'thin', color: { rgb: '94A3B8' } },
  },
};

const FORMATO_CLP = '"$"#,##0';

function barraVisual(porcentaje: number): string {
  const llenos = Math.max(0, Math.min(12, Math.round((porcentaje / 100) * 12)));
  return `${'█'.repeat(llenos)}${'░'.repeat(12 - llenos)}  ${porcentaje.toFixed(0)}%`;
}

function celda(
  valor: string | number,
  estilo: Record<string, unknown>,
  tipo?: 's' | 'n',
  formato?: string
) {
  const c: Record<string, unknown> = {
    v: valor,
    t: tipo ?? (typeof valor === 'number' ? 'n' : 's'),
    s: estilo,
  };
  if (formato) c.z = formato;
  return c;
}

function formula(expr: string, estilo: Record<string, unknown>, formato?: string) {
  const c: Record<string, unknown> = {
    f: expr,
    t: 'n',
    s: estilo,
  };
  if (formato) c.z = formato;
  return c;
}

function estiloDato(
  par: boolean,
  alineacion: 'left' | 'center' | 'right' = 'left',
  negrita = false,
  colorTexto = '0F172A'
) {
  return {
    font: { name: 'Calibri', sz: 10, bold: negrita, color: { rgb: colorTexto } },
    fill: { fgColor: { rgb: par ? 'F8FAFC' : 'FFFFFF' } },
    alignment: { horizontal: alineacion, vertical: 'center' },
    border: BORDE_FINO,
  };
}

function estiloEstado(textoEstado: string) {
  if (textoEstado === 'AGOTADO' || textoEstado === 'SALIDA') {
    return {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'B91C1C' } },
      fill: { fgColor: { rgb: 'FEE2E2' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDE_FINO,
    };
  }
  if (textoEstado === 'STOCK BAJO') {
    return {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'B45309' } },
      fill: { fgColor: { rgb: 'FEF3C7' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDE_FINO,
    };
  }
  return {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '15803D' } },
    fill: { fgColor: { rgb: 'DCFCE7' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDE_FINO,
  };
}

/**
 * Genera un libro Excel (.xlsx) estilizado de nivel gerencial con 3 hojas:
 *   1. Resumen_Ejecutivo (KPIs CLP, distribución visual de stock y Top 5)
 *   2. Inventario (tabla completa con bordes, semáforos y fila TOTAL con =SUM)
 *   3. Movimientos (bitácora de entradas/salidas con colores y totales =SUM)
 */
export async function exportarReporteExcel(db: SQLiteDatabase): Promise<string> {
  const [resumen, productos, movimientos] = await Promise.all([
    obtenerResumenEjecutivo(db),
    listarProductos(db),
    listarMovimientosGlobales(db, { limite: 2000 }),
  ]);

  const ahora = new Date();
  const fechaLegible = ahora.toLocaleString('es-CL');
  const marcaArchivo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(ahora.getDate()).padStart(2, '0')}_${String(ahora.getHours()).padStart(
    2,
    '0'
  )}${String(ahora.getMinutes()).padStart(2, '0')}`;

  const libro = XLSX.utils.book_new();

  // ===================== HOJA 1: RESUMEN EJECUTIVO =====================
  const totalSkusSafe = Math.max(1, resumen.totalSkus);
  const pctOpt = (resumen.skusOptimos / totalSkusSafe) * 100;
  const pctBaj = (resumen.skusBajoMinimo / totalSkusSafe) * 100;
  const pctAgo = (resumen.skusAgotados / totalSkusSafe) * 100;

  const filasResumen: unknown[][] = [
    [celda('REPORTE EJECUTIVO DE INVENTARIO Y MOVIMIENTOS', ESTILO_TITULO), '', '', ''],
    [celda(`Generado desde Bodega App (100% Offline SQLite) · ${fechaLegible}`, ESTILO_SUBTITULO), '', '', ''],
    [],
    [
      celda('Indicador Ejecutivo', ESTILO_CABECERA),
      celda('Unidades / Cant.', ESTILO_CABECERA),
      celda('Monto (CLP)', ESTILO_CABECERA),
      celda('Lectura Rápida', ESTILO_CABECERA),
    ],
    [
      celda('Capital valorizado actual en bodega', estiloDato(false, 'left', true)),
      celda(resumen.unidadesTotales, estiloDato(false, 'right', true)),
      celda(resumen.valorInventarioCLP, estiloDato(false, 'right', true, '0369A1'), 'n', FORMATO_CLP),
      celda(`${resumen.totalSkus} productos registrados`, estiloDato(false, 'left')),
    ],
    [
      celda('Salidas / Despachos acumulados', estiloDato(true, 'left', true)),
      celda(resumen.salidasUnidades, estiloDato(true, 'right', true)),
      celda(resumen.salidasMontoCLP, estiloDato(true, 'right', true, 'B91C1C'), 'n', FORMATO_CLP),
      celda('Flujo de salida valorizado', estiloDato(true, 'left')),
    ],
    [
      celda('Entradas / Recepciones acumuladas', estiloDato(false, 'left', true)),
      celda(resumen.entradasUnidades, estiloDato(false, 'right', true)),
      celda(resumen.entradasMontoCLP, estiloDato(false, 'right', true, '15803D'), 'n', FORMATO_CLP),
      celda(`${resumen.totalMovimientos} movimientos totales`, estiloDato(false, 'left')),
    ],
    [],
    [celda('DISTRIBUCIÓN DE SALUD DEL STOCK (DATOS LISTOS PARA GRÁFICO)', ESTILO_SECCION), '', '', ''],
    [
      celda('Estado del Stock', ESTILO_CABECERA),
      celda('Cantidad SKUs', ESTILO_CABECERA),
      celda('Participación', ESTILO_CABECERA),
      celda('Gráfico Visual Proporcional', ESTILO_CABECERA),
    ],
    [
      celda('EN STOCK', estiloEstado('EN STOCK')),
      celda(resumen.skusOptimos, estiloDato(false, 'right', true)),
      celda(Number((pctOpt / 100).toFixed(4)), estiloDato(false, 'right'), 'n', '0.0%'),
      celda(barraVisual(pctOpt), estiloDato(false, 'left', true, '15803D')),
    ],
    [
      celda('STOCK BAJO', estiloEstado('STOCK BAJO')),
      celda(resumen.skusBajoMinimo, estiloDato(true, 'right', true)),
      celda(Number((pctBaj / 100).toFixed(4)), estiloDato(true, 'right'), 'n', '0.0%'),
      celda(barraVisual(pctBaj), estiloDato(true, 'left', true, 'B45309')),
    ],
    [
      celda('AGOTADO', estiloEstado('AGOTADO')),
      celda(resumen.skusAgotados, estiloDato(false, 'right', true)),
      celda(Number((pctAgo / 100).toFixed(4)), estiloDato(false, 'right'), 'n', '0.0%'),
      celda(barraVisual(pctAgo), estiloDato(false, 'left', true, 'B91C1C')),
    ],
    [],
    [celda('TOP 5 PRODUCTOS POR CAPITAL INMOVILIZADO', ESTILO_SECCION), '', '', ''],
    [
      celda('Producto', ESTILO_CABECERA),
      celda('Stock Actual', ESTILO_CABECERA),
      celda('Valor Total (CLP)', ESTILO_CABECERA),
      celda('Participación del Capital', ESTILO_CABECERA),
    ],
  ];

  const capTotalSafe = Math.max(1, resumen.valorInventarioCLP);
  resumen.topValorizados.forEach((item, i) => {
    const pct = (item.valorTotal / capTotalSafe) * 100;
    filasResumen.push([
      celda(item.nombre, estiloDato(i % 2 === 1, 'left', true)),
      celda(item.stock, estiloDato(i % 2 === 1, 'right')),
      celda(item.valorTotal, estiloDato(i % 2 === 1, 'right', true, '0369A1'), 'n', FORMATO_CLP),
      celda(barraVisual(pct), estiloDato(i % 2 === 1, 'left', false, '0284C7')),
    ]);
  });

  const wsResumen = XLSX.utils.aoa_to_sheet(filasResumen);
  wsResumen['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 3 } },
    { s: { r: 14, c: 0 }, e: { r: 14, c: 3 } },
  ];
  wsResumen['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 19 }, { wch: 28 }];
  wsResumen['!rows'] = [{ hpt: 28 }, { hpt: 20 }];
  XLSX.utils.book_append_sheet(libro, wsResumen, 'Resumen_Ejecutivo');

  // ===================== HOJA 2: INVENTARIO =====================
  const filasInv: unknown[][] = [
    [celda('CATÁLOGO DE INVENTARIO VALORIZADO', ESTILO_TITULO), '', '', '', '', '', '', ''],
    [celda(`Corte al ${fechaLegible} · Total artículos: ${productos.length}`, ESTILO_SUBTITULO), '', '', '', '', '', '', ''],
    [],
    [
      celda('Código GTIN', ESTILO_CABECERA),
      celda('Producto', ESTILO_CABECERA),
      celda('Stock Actual', ESTILO_CABECERA),
      celda('Stock Mínimo', ESTILO_CABECERA),
      celda('Estado', ESTILO_CABECERA),
      celda('Precio Unit. (CLP)', ESTILO_CABECERA),
      celda('Valor Total (CLP)', ESTILO_CABECERA),
      celda('Fecha Alta', ESTILO_CABECERA),
    ],
  ];

  productos.forEach((p, idx) => {
    const est = estadoDeStock(p);
    const etiqueta = ETIQUETA_ESTADO[est].texto;
    const par = idx % 2 === 1;
    const filaExcel = idx + 5; // fila 1-based en Excel
    filasInv.push([
      celda(p.codigo, estiloDato(par, 'center'), 's'),
      celda(p.nombre, estiloDato(par, 'left', true)),
      celda(p.stock, estiloDato(par, 'right', true)),
      celda(p.minimo, estiloDato(par, 'right')),
      celda(etiqueta, estiloEstado(etiqueta)),
      celda(p.precio, estiloDato(par, 'right'), 'n', FORMATO_CLP),
      formula(`C${filaExcel}*F${filaExcel}`, estiloDato(par, 'right', true, '0369A1'), FORMATO_CLP),
      celda(new Date(p.creado_en).toLocaleDateString('es-CL'), estiloDato(par, 'center')),
    ]);
  });

  if (productos.length > 0) {
    const ultima = productos.length + 4;
    filasInv.push([
      celda('TOTAL GENERAL', { ...ESTILO_TOTAL, alignment: { horizontal: 'left', vertical: 'center' } }),
      celda(`${productos.length} SKUs`, { ...ESTILO_TOTAL, alignment: { horizontal: 'left', vertical: 'center' } }),
      formula(`SUM(C5:C${ultima})`, { ...ESTILO_TOTAL, alignment: { horizontal: 'right', vertical: 'center' } }),
      celda('', ESTILO_TOTAL),
      celda('', ESTILO_TOTAL),
      celda('', ESTILO_TOTAL),
      formula(`SUM(G5:G${ultima})`, { ...ESTILO_TOTAL, alignment: { horizontal: 'right', vertical: 'center' } }, FORMATO_CLP),
      celda('', ESTILO_TOTAL),
    ]);
  }

  const wsInv = XLSX.utils.aoa_to_sheet(filasInv);
  wsInv['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
  ];
  wsInv['!cols'] = [
    { wch: 16 },
    { wch: 30 },
    { wch: 13 },
    { wch: 13 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 13 },
  ];
  wsInv['!rows'] = [{ hpt: 28 }, { hpt: 20 }];
  XLSX.utils.book_append_sheet(libro, wsInv, 'Inventario');

  // ===================== HOJA 3: MOVIMIENTOS =====================
  const filasMov: unknown[][] = [
    [celda('BITÁCORA AUDITABLE DE ENTRADAS Y SALIDAS', ESTILO_TITULO), '', '', '', '', '', '', '', ''],
    [celda(`Corte al ${fechaLegible} · Registros exportados: ${movimientos.length}`, ESTILO_SUBTITULO), '', '', '', '', '', '', '', ''],
    [],
    [
      celda('ID', ESTILO_CABECERA),
      celda('Fecha y Hora', ESTILO_CABECERA),
      celda('Tipo', ESTILO_CABECERA),
      celda('Código GTIN', ESTILO_CABECERA),
      celda('Producto', ESTILO_CABECERA),
      celda('Cantidad', ESTILO_CABECERA),
      celda('Precio Unit. (CLP)', ESTILO_CABECERA),
      celda('Subtotal (CLP)', ESTILO_CABECERA),
      celda('Nota / Motivo', ESTILO_CABECERA),
    ],
  ];

  movimientos.forEach((m, idx) => {
    const tipoTxt = m.tipo === 'IN' ? 'ENTRADA' : 'SALIDA';
    const par = idx % 2 === 1;
    const filaExcel = idx + 5;
    filasMov.push([
      celda(m.id, estiloDato(par, 'center')),
      celda(new Date(m.fecha).toLocaleString('es-CL'), estiloDato(par, 'center')),
      celda(tipoTxt, estiloEstado(tipoTxt)),
      celda(m.codigo, estiloDato(par, 'center'), 's'),
      celda(m.nombre_producto, estiloDato(par, 'left', true)),
      celda(m.cantidad, estiloDato(par, 'right', true)),
      celda(m.precio_unitario, estiloDato(par, 'right'), 'n', FORMATO_CLP),
      formula(`F${filaExcel}*G${filaExcel}`, estiloDato(par, 'right', true), FORMATO_CLP),
      celda(m.nota || '—', estiloDato(par, 'left')),
    ]);
  });

  if (movimientos.length > 0) {
    const ultima = movimientos.length + 4;
    filasMov.push([
      celda('TOTAL', { ...ESTILO_TOTAL, alignment: { horizontal: 'center', vertical: 'center' } }),
      celda(`${movimientos.length} movimientos`, { ...ESTILO_TOTAL, alignment: { horizontal: 'left', vertical: 'center' } }),
      celda('', ESTILO_TOTAL),
      celda('', ESTILO_TOTAL),
      celda('', ESTILO_TOTAL),
      formula(`SUM(F5:F${ultima})`, { ...ESTILO_TOTAL, alignment: { horizontal: 'right', vertical: 'center' } }),
      celda('', ESTILO_TOTAL),
      formula(`SUM(H5:H${ultima})`, { ...ESTILO_TOTAL, alignment: { horizontal: 'right', vertical: 'center' } }, FORMATO_CLP),
      celda('', ESTILO_TOTAL),
    ]);
  }

  const wsMov = XLSX.utils.aoa_to_sheet(filasMov);
  wsMov['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
  ];
  wsMov['!cols'] = [
    { wch: 7 },
    { wch: 20 },
    { wch: 11 },
    { wch: 16 },
    { wch: 28 },
    { wch: 11 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
  ];
  wsMov['!rows'] = [{ hpt: 28 }, { hpt: 20 }];
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
    throw new Error(`Archivo generado (${nombreArchivo}), pero Compartir no está disponible aquí.`);
  }

  await Sharing.shareAsync(archivo.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar reporte gerencial de bodega (.xlsx)',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });

  return nombreArchivo;
}
