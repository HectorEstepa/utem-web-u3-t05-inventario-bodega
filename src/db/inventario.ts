import type { SQLiteDatabase } from 'expo-sqlite';
import { validarMovimiento } from '../lib/stock';

export interface Producto {
  codigo: string;
  nombre: string;
  stock: number;
  minimo: number;
  creado_en: number;
}

export interface Movimiento {
  id: number;
  codigo: string;
  tipo: 'IN' | 'OUT';
  cantidad: number;
  fecha: number;
}

/**
 * Todas las consultas usan sentencias preparadas con parámetros (?).
 * execAsync no escapa parámetros, así que nunca se usa con datos del
 * usuario: un nombre de producto escrito a mano podría cerrar la comilla
 * e inyectar SQL. runAsync y getAllAsync sí parametrizan.
 */

export async function buscarPorCodigo(
  db: SQLiteDatabase,
  codigo: string
): Promise<Producto | null> {
  // codigo es PRIMARY KEY: SQLite resuelve por índice, no recorre la tabla.
  return db.getFirstAsync<Producto>('SELECT * FROM productos WHERE codigo = ?', codigo);
}

export async function listarProductos(
  db: SQLiteDatabase,
  opciones: { soloStockBajo?: boolean; busqueda?: string } = {}
): Promise<Producto[]> {
  const { soloStockBajo = false, busqueda = '' } = opciones;
  const condiciones: string[] = [];
  const params: (string | number)[] = [];

  if (soloStockBajo) condiciones.push('stock <= minimo');
  if (busqueda.trim()) {
    condiciones.push('(nombre LIKE ? OR codigo LIKE ?)');
    params.push(`%${busqueda.trim()}%`, `%${busqueda.trim()}%`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  // Los agotados y los bajos primero: es lo que el bodeguero necesita ver.
  return db.getAllAsync<Producto>(
    `SELECT * FROM productos ${where}
     ORDER BY (stock <= minimo) DESC, stock ASC, nombre ASC`,
    ...params
  );
}

export async function contarStockBajo(db: SQLiteDatabase): Promise<number> {
  const fila = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM productos WHERE stock <= minimo'
  );
  return fila?.n ?? 0;
}

export async function crearProducto(
  db: SQLiteDatabase,
  datos: { codigo: string; nombre: string; stockInicial: number; minimo: number }
): Promise<void> {
  const { codigo, nombre, stockInicial, minimo } = datos;
  if (!nombre.trim()) throw new Error('El nombre del producto no puede ir vacío.');

  // El alta y su movimiento inicial son una sola operación: si falla el
  // segundo INSERT, el producto no debe quedar creado sin su registro.
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      'INSERT INTO productos (codigo, nombre, stock, minimo, creado_en) VALUES (?, ?, ?, ?, ?)',
      codigo,
      nombre.trim(),
      stockInicial,
      minimo,
      Date.now()
    );
    if (stockInicial > 0) {
      await tx.runAsync(
        'INSERT INTO movimientos (codigo, tipo, cantidad, fecha) VALUES (?, ?, ?, ?)',
        codigo,
        'IN',
        stockInicial,
        Date.now()
      );
    }
  });
}

/**
 * Registra una entrada o salida.
 *
 * La lectura del stock y su actualización van dentro de la misma
 * transacción exclusiva. Sin eso, dos escaneos rápidos podrían leer el
 * mismo stock y pisarse: el clásico "lost update".
 */
export async function registrarMovimiento(
  db: SQLiteDatabase,
  codigo: string,
  tipo: 'IN' | 'OUT',
  cantidad: number
): Promise<number> {
  let stockFinal = 0;

  await db.withExclusiveTransactionAsync(async (tx) => {
    const producto = await tx.getFirstAsync<Producto>(
      'SELECT * FROM productos WHERE codigo = ?',
      codigo
    );
    if (!producto) throw new Error(`El producto ${codigo} ya no existe en la base.`);

    const error = validarMovimiento(tipo, cantidad, producto.stock);
    if (error) throw new Error(error);

    stockFinal = tipo === 'IN' ? producto.stock + cantidad : producto.stock - cantidad;

    await tx.runAsync('UPDATE productos SET stock = ? WHERE codigo = ?', stockFinal, codigo);
    await tx.runAsync(
      'INSERT INTO movimientos (codigo, tipo, cantidad, fecha) VALUES (?, ?, ?, ?)',
      codigo,
      tipo,
      cantidad,
      Date.now()
    );
  });

  return stockFinal;
}

export async function historial(
  db: SQLiteDatabase,
  codigo: string,
  limite = 20
): Promise<Movimiento[]> {
  // El índice idx_mov_codigo cubre el WHERE y el ORDER BY de esta consulta.
  return db.getAllAsync<Movimiento>(
    'SELECT * FROM movimientos WHERE codigo = ? ORDER BY fecha DESC LIMIT ?',
    codigo,
    limite
  );
}
