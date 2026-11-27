import XLSX from 'xlsx-js-style';
import type { DatosReporte, FlujoProducto } from '../db/reportes.ts';
import { estadoDeStock, ETIQUETA_ESTADO } from './stock.ts';
import { fechaLocal } from './periodo.ts';

const CLP = '"$"#,##0';
const borde = { top: { style: 'thin', color: { rgb: 'CBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'CBD5E1' } }, left: { style: 'thin', color: { rgb: 'CBD5E1' } }, right: { style: 'thin', color: { rgb: 'CBD5E1' } } };
const estilo = (fondo = 'FFFFFF', color = '0F172A', bold = false) => ({ font: { name: 'Calibri', sz: 11, bold, color: { rgb: color } }, fill: { fgColor: { rgb: fondo } }, border: borde, alignment: { vertical: 'center', wrapText: true } });
const celda = (v: string | number, s = estilo(), z?: string): XLSX.CellObject => ({ v, t: typeof v === 'number' ? 'n' : 's', s, ...(z ? { z } : {}) });
const dinero = (v: number) => celda(v, estilo(), CLP);
const formula = (f: string, v: number, z?: string): XLSX.CellObject => ({ f, v, t: 'n', s: estilo('E0F2FE', '0F172A', true), ...(z ? { z } : {}) });
const fechaHora = (n: number) => new Date(n).toLocaleString('es-CL');

/** Generación pura: se prueba con Node sin archivos, Expo ni menú de compartir. */
export function crearLibroReporte(d: DatosReporte): XLSX.WorkBook {
  const libro = XLSX.utils.book_new();
  const r = d.resumen;
  function hoja(nombre: string, titulo: string, alcance: string, columnas: string[], filas: unknown[][], anchos?: number[]) {
    const n = columnas.length;
    const datos = [
      [celda(titulo, estilo('075985', 'FFFFFF', true))],
      [celda(`Movimientos: ${d.periodo.etiqueta} · ${d.periodo.detalle}`, estilo('E0F2FE'))],
      [celda(`Generado: ${fechaHora(d.generadoEn)} · zona horaria: ${d.zonaHoraria}`, estilo('F1F5F9'))],
      [celda(alcance, estilo('F1F5F9'))], [],
      columnas.map((v) => celda(v, estilo('0369A1', 'FFFFFF', true))), ...filas,
    ];
    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws['!merges'] = [0, 1, 2, 3].map((i) => ({ s: { r: i, c: 0 }, e: { r: i, c: n - 1 } }));
    ws['!cols'] = columnas.map((_, i) => ({ wch: anchos?.[i] ?? 21 }));
    ws['!rows'] = [{ hpt: 30 }, { hpt: 30 }, { hpt: 30 }, { hpt: 35 }, {}, { hpt: 36 }];
    if (filas.length) ws['!autofilter'] = { ref: `A6:${XLSX.utils.encode_col(n - 1)}${6 + filas.length}` };
    XLSX.utils.book_append_sheet(libro, ws, nombre);
  }

  hoja('Resumen', 'REPORTE DE INVENTARIO Y MOVIMIENTOS', 'Stock y valorización: estado actual al generar. Flujos: solo el período elegido. CLP valorizados, sin cálculo de utilidad.',
    ['Indicador', 'Unidades / cantidad', 'Monto CLP', 'Alcance'], [
      ['Stock disponible', r.unidadesTotales, dinero(r.valorInventarioCLP), 'ACTUAL, no stock histórico'],
      [celda('Entradas', estilo('DCFCE7', '166534', true)), r.entradasUnidades, dinero(r.entradasMontoCLP), 'Período seleccionado'],
      [celda('Salidas', estilo('EDE9FE', '6D28D9', true)), r.salidasUnidades, dinero(r.salidasMontoCLP), 'Período seleccionado'],
      ['Variación de unidades', r.entradasUnidades - r.salidasUnidades, '', 'Entradas menos salidas; no es el stock final'],
      ['Ajustes de conteo', d.movimientos.filter((m) => m.tipo === 'ADJ' && !m.entrada_corregida_id).length, '', 'Solo diferencias físicas, sin rectificar entradas'],
      ['Diferencia por conteos u.', d.movimientos.reduce((n, m) => n + (m.tipo === 'ADJ' && !m.entrada_corregida_id ? (m.stock_despues ?? 0) - (m.stock_antes ?? 0) : 0), 0), '', 'Excluye rectificaciones ya aplicadas a entradas'],
      ['Rectificaciones de entrada', d.movimientos.filter((m) => !!m.entrada_corregida_id).length, '', 'Constancias hechas en este período; entrada efectiva en su fecha original'],
      ['Movimientos incluidos', r.totalMovimientos, '', 'Todas las filas del período, sin truncamiento'],
      ['Primera operación incluida', r.primeraFecha === null ? 'Sin movimientos' : fechaHora(r.primeraFecha), '', 'Fecha local'],
      ['Última operación incluida', r.ultimaFecha === null ? 'Sin movimientos' : fechaHora(r.ultimaFecha), '', 'Fecha local'],
      ['Productos actuales / críticos', r.totalSkus, '', `${r.skusCriticos} críticos · ${r.skusAgotados} agotados`],
    ], [32, 29, 22, 52]);

  const inv: unknown[][] = d.productos.map((p, i) => [celda(p.codigo), p.nombre, p.stock, p.minimo,
    celda(ETIQUETA_ESTADO[estadoDeStock(p)].texto, estadoDeStock(p) === 'agotado' ? estilo('FEE2E2', 'B91C1C') : estadoDeStock(p) === 'bajo' ? estilo('FEF3C7', '92400E') : estilo('DCFCE7', '166534')),
    dinero(p.precio), formula(`C${i + 7}*F${i + 7}`, p.stock * p.precio, CLP), fechaHora(p.creado_en)]);
  if (inv.length) inv.push(['TOTAL ACTUAL', '', formula(`SUM(C7:C${inv.length + 6})`, r.unidadesTotales), '', '', '', formula(`SUM(G7:G${inv.length + 6})`, r.valorInventarioCLP, CLP), '']);
  hoja('Inventario_actual', 'INVENTARIO ACTUAL', 'Esta hoja muestra existencias actuales, aunque los movimientos se filtren por fechas. No reconstruye el stock al cierre del período.',
    ['GTIN', 'Producto', 'Stock actual', 'Mínimo', 'Estado actual', 'Precio actual CLP', 'Valor actual CLP', 'Alta local'], inv, [18, 36, 17, 13, 20, 22, 23, 26]);

  const flujo = (p: FlujoProducto) => [celda(p.codigo), p.nombre, p.entradas, p.salidas, p.entradas - p.salidas, dinero(p.montoEntradas), dinero(p.montoSalidas), fechaHora(p.primeraFecha), fechaHora(p.ultimaFecha)];
  hoja('Por_producto', 'MOVIMIENTOS POR PRODUCTO', 'Unidades recibidas y despachadas en el período; montos calculados con el precio histórico guardado en cada movimiento.',
    ['GTIN', 'Producto', 'Entradas u.', 'Salidas u.', 'Variación u.', 'Entradas CLP', 'Salidas CLP', 'Primera operación local', 'Última operación local'], d.porProducto.map(flujo), [18, 36, 17, 17, 18, 22, 22, 27, 27]);

  hoja('Por_dia_producto', 'MOVIMIENTOS DIARIOS POR PRODUCTO', 'Una fila por fecha local y producto. Permite consultar cuánto entró y salió de cada artículo cada día.',
    ['Fecha local AAAA-MM-DD', 'GTIN', 'Producto', 'Entradas u.', 'Salidas u.', 'Variación u.', 'Entradas CLP', 'Salidas CLP'],
    d.porDia.map((p) => [p.dia, celda(p.codigo), p.nombre, p.entradas, p.salidas, p.entradas - p.salidas, dinero(p.montoEntradas), dinero(p.montoSalidas)]), [26, 18, 36, 17, 17, 18, 22, 22]);

  const movs: unknown[][] = d.movimientos.map((m, i) => [m.id, fechaLocal(new Date(m.fecha)), new Date(m.fecha).toLocaleTimeString('es-CL'),
    celda(m.entrada_corregida_id ? 'RECTIFICACIÓN ENTRADA' : m.tipo === 'ADJ' ? 'AJUSTE' : m.tipo === 'IN' ? 'ENTRADA' : 'SALIDA', m.tipo === 'ADJ' ? estilo('E0F2FE', '075985', true) : m.tipo === 'IN' ? estilo('DCFCE7', '166534', true) : estilo('EDE9FE', '6D28D9', true)),
    celda(m.codigo), m.nombre_producto, m.cantidad, dinero(m.precio_unitario), m.tipo === 'ADJ' ? '' : formula(`G${i + 7}*H${i + 7}`, m.cantidad * m.precio_unitario, CLP), m.nota, new Date(m.fecha).toISOString(), m.stock_antes ?? '', m.stock_despues ?? '', m.tipo === 'ADJ' ? (m.stock_despues ?? 0) - (m.stock_antes ?? 0) : '', m.cantidad_original ?? m.cantidad, m.entrada_corregida_id ?? '', m.entrada_cantidad_antes ?? '', m.entrada_cantidad_despues ?? '']);
  hoja('Movimientos', 'DETALLE DE MOVIMIENTOS', `${d.movimientos.length} operaciones del período. Entradas con cantidad vigente y precio/fecha originales; rectificaciones con vínculo y valores anteriores/nuevos en su fecha de corrección. Las constancias no son despachos ni se suman otra vez al flujo.`,
    ['ID', 'Fecha local AAAA-MM-DD', 'Hora local', 'Tipo', 'GTIN', 'Producto', 'Cantidad vigente u.', 'Precio histórico CLP', 'Subtotal CLP', 'Nota / motivo', 'Fecha UTC ISO 8601', 'Saldo antes ajuste', 'Saldo después ajuste', 'Diferencia ajuste u.', 'Cantidad originalmente registrada', 'ID entrada rectificada', 'Entrada antes corrección u.', 'Entrada después corrección u.'], movs, [10, 26, 16, 15, 18, 36, 18, 25, 22, 38, 30]);
  return libro;
}
