import XLSX from 'xlsx-js-style';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { cargarDatosReporte } from '../db/reportes';
import { crearLibroReporte } from './reporteExcel';
import { fechaLocal, TODO_EL_HISTORIAL, type Periodo } from './periodo';

export async function exportarReporteExcel(db: SQLiteDatabase, periodo: Periodo = TODO_EL_HISTORIAL): Promise<string> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartir archivos no está disponible en este dispositivo.');
  const datos = await cargarDatosReporte(db, periodo);
  const libro = crearLibroReporte(datos);
  const bytes = XLSX.write(libro, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const rango = periodo.desde === null ? 'todo_historial' : `${fechaLocal(new Date(periodo.desde))}_a_${fechaLocal(new Date(periodo.hasta! - 1))}`;
  const nombre = `Bodega_${rango}_generado_${datos.generadoEn}.xlsx`;
  const archivo = new File(Paths.cache, nombre);
  archivo.create({ overwrite: true });
  archivo.write(new Uint8Array(bytes));
  await Sharing.shareAsync(archivo.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Guardar o compartir reporte del período', UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
  return nombre;
}
