import type { SQLiteDatabase } from 'expo-sqlite';
import { validarMovimiento, validarPrecio } from '../lib/stock.ts';
import { procesarLectura } from '../lib/gtin.ts';

export interface Producto {
  codigo: string;
  nombre: string;
  stock: number;
  minimo: number;
  precio: number;
  creado_en: number;
}

export interface Movimiento {
  id: number;
  codigo: string;
  tipo: 'IN' | 'OUT';
  cantidad: number;
  precio_unitario: number;
  nota: string;
  fecha: number;
}

export interface MovimientoDetallado extends Movimiento {
  nombre_producto: string;
}

export interface ResumenEjecutivo {
  totalSkus: number;
  unidadesTotales: number;
  skusCriticos: number;
  skusAgotados: number;
  skusBajoMinimo: number;
  skusOptimos: number;
  valorInventarioCLP: number;
  entradasUnidades: number;
  entradasMontoCLP: number;
  salidasUnidades: number;
  salidasMontoCLP: number;
  totalMovimientos: number;
  topValorizados: Array<{
    codigo: string;
    nombre: string;
    stock: number;
    precio: number;
    valorTotal: number;
  }>;
}

export type FiltroEstadoLista = 'todos' | 'bajo' | 'agotado';

/**
 * Todas las consultas usan sentencias preparadas con marcadores (?) sobre
 * getFirstAsync, getAllAsync y runAsync. Jamás se interpola entrada del
 * usuario en execAsync, eliminando cualquier vector de inyección SQL.
 */

export async function buscarPorCodigo(
  db: SQLiteDatabase,
  codigo: string
): Promise<Producto | null> {
  return db.getFirstAsync<Producto>('SELECT * FROM productos WHERE codigo = ?', codigo);
}

export async function listarProductos(
  db: SQLiteDatabase,
  opciones: {
    soloStockBajo?: boolean;
    filtroEstado?: FiltroEstadoLista;
    busqueda?: string;
  } = {}
): Promise<Producto[]> {
  const { soloStockBajo = false, filtroEstado = 'todos', busqueda = '' } = opciones;
  const condiciones: string[] = [];
  const params: (string | number)[] = [];

  if (filtroEstado === 'agotado') {
    condiciones.push('stock <= 0');
  } else if (filtroEstado === 'bajo' || soloStockBajo) {
    condiciones.push('stock <= minimo');
  }

  if (busqueda.trim()) {
    condiciones.push('(nombre LIKE ? OR codigo LIKE ?)');
    params.push(`%${busqueda.trim()}%`, `%${busqueda.trim()}%`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  return db.getAllAsync<Producto>(
    `SELECT * FROM productos ${where}
     ORDER BY (stock <= 0) DESC, (stock <= minimo) DESC, stock ASC, nombre ASC`,
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
  datos: {
    codigo: string;
    nombre: string;
    stockInicial: number;
    minimo: number;
    precio?: number;
  }
): Promise<void> {
  const { nombre, stockInicial, minimo, precio = 0 } = datos;
  const lectura = procesarLectura(datos.codigo);
  if (!lectura.ok) throw new Error('El código GTIN no es válido. Revisa sus dígitos.');
  const codigo = lectura.codigo;
  if (!nombre.trim()) throw new Error('El nombre del producto no puede ir vacío.');
  if (!Number.isInteger(stockInicial) || stockInicial < 0 || stockInicial > 99999) {
    throw new Error('El stock inicial debe ser un entero entre 0 y 99.999.');
  }
  if (!Number.isInteger(minimo) || minimo < 1 || minimo > 99999) {
    throw new Error('El stock mínimo debe ser un entero entre 1 y 99.999.');
  }
  const errPrecio = validarPrecio(precio);
  if (errPrecio) throw new Error(errPrecio);

  await db.withExclusiveTransactionAsync(async (tx) => {
    const ahora = Date.now();
    await tx.runAsync(
      `INSERT INTO productos (codigo, nombre, stock, minimo, precio, creado_en)
       VALUES (?, ?, ?, ?, ?, ?)`,
      codigo,
      nombre.trim(),
      stockInicial,
      minimo,
      precio,
      ahora
    );
    if (stockInicial > 0) {
      await tx.runAsync(
        `INSERT INTO movimientos (codigo, tipo, cantidad, precio_unitario, nota, fecha)
         VALUES (?, ?, ?, ?, ?, ?)`,
        codigo,
        'IN',
        stockInicial,
        precio,
        'Stock inicial de alta',
        ahora
      );
    }
  });
}

export async function actualizarProducto(
  db: SQLiteDatabase,
  datos: { codigo: string; nombre: string; minimo: number; precio: number }
): Promise<void> {
  const { codigo, nombre, minimo, precio } = datos;
  if (!nombre.trim()) throw new Error('El nombre no puede quedar vacío.');
  if (!Number.isInteger(minimo) || minimo < 1 || minimo > 99999) {
    throw new Error('El stock mínimo debe ser un entero entre 1 y 99.999.');
  }
  const errPrecio = validarPrecio(precio);
  if (errPrecio) throw new Error(errPrecio);

  await db.runAsync(
    'UPDATE productos SET nombre = ?, minimo = ?, precio = ? WHERE codigo = ?',
    nombre.trim(),
    minimo,
    precio,
    codigo
  );
}

export async function eliminarProducto(db: SQLiteDatabase, codigo: string): Promise<void> {
  // ON DELETE CASCADE elimina automáticamente su historial en `movimientos`.
  await db.runAsync('DELETE FROM productos WHERE codigo = ?', codigo);
}

export async function vaciarBodega(db: SQLiteDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM movimientos');
    await tx.runAsync('DELETE FROM productos');
  });
}

export async function listarCriticos(db: SQLiteDatabase, limite = 6): Promise<Producto[]> {
  return db.getAllAsync<Producto>(
    `SELECT * FROM productos
     WHERE stock <= minimo
     ORDER BY (stock <= 0) DESC, stock ASC, nombre ASC
     LIMIT ?`,
    limite
  );
}

/**
 * Registra una entrada (recepción) o salida (despacho/venta) dentro de una
 * transacción exclusiva, congelando el precio unitario vigente del producto.
 */
export async function registrarMovimiento(
  db: SQLiteDatabase,
  codigo: string,
  tipo: 'IN' | 'OUT',
  cantidad: number,
  nota = ''
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
      `INSERT INTO movimientos (codigo, tipo, cantidad, precio_unitario, nota, fecha)
       VALUES (?, ?, ?, ?, ?, ?)`,
      codigo,
      tipo,
      cantidad,
      producto.precio ?? 0,
      nota.trim().slice(0, 80),
      Date.now()
    );
  });

  return stockFinal;
}

export async function historial(
  db: SQLiteDatabase,
  codigo: string,
  limite = 25
): Promise<Movimiento[]> {
  return db.getAllAsync<Movimiento>(
    'SELECT * FROM movimientos WHERE codigo = ? ORDER BY fecha DESC LIMIT ?',
    codigo,
    limite
  );
}

export async function listarMovimientosGlobales(
  db: SQLiteDatabase,
  opciones: { tipo?: 'TODOS' | 'IN' | 'OUT'; limite?: number } = {}
): Promise<MovimientoDetallado[]> {
  const { tipo = 'TODOS', limite = 80 } = opciones;
  if (tipo === 'IN' || tipo === 'OUT') {
    return db.getAllAsync<MovimientoDetallado>(
      `SELECT m.*, COALESCE(p.nombre, m.codigo) AS nombre_producto
       FROM movimientos m
       LEFT JOIN productos p ON p.codigo = m.codigo
       WHERE m.tipo = ?
       ORDER BY m.fecha DESC
       LIMIT ?`,
      tipo,
      limite
    );
  }
  return db.getAllAsync<MovimientoDetallado>(
    `SELECT m.*, COALESCE(p.nombre, m.codigo) AS nombre_producto
     FROM movimientos m
     LEFT JOIN productos p ON p.codigo = m.codigo
     ORDER BY m.fecha DESC
     LIMIT ?`,
    limite
  );
}

/**
 * Calcula las métricas con dos agregaciones y una consulta de los cinco
 * productos de mayor valor. Su duración debe medirse en el dispositivo.
 */
export async function obtenerResumenEjecutivo(db: SQLiteDatabase): Promise<ResumenEjecutivo> {
  const [aggProd, aggMov, top] = await Promise.all([
    db.getFirstAsync<{
      totalSkus: number;
      unidadesTotales: number;
      skusAgotados: number;
      skusBajoMinimo: number;
      skusOptimos: number;
      valorInventarioCLP: number;
    }>(`
      SELECT
        COUNT(*) AS totalSkus,
        COALESCE(SUM(stock), 0) AS unidadesTotales,
        COALESCE(SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END), 0) AS skusAgotados,
        COALESCE(SUM(CASE WHEN stock > 0 AND stock <= minimo THEN 1 ELSE 0 END), 0) AS skusBajoMinimo,
        COALESCE(SUM(CASE WHEN stock > minimo THEN 1 ELSE 0 END), 0) AS skusOptimos,
        COALESCE(SUM(stock * precio), 0) AS valorInventarioCLP
      FROM productos
    `),
    db.getFirstAsync<{
      totalMovimientos: number;
      entradasUnidades: number;
      entradasMontoCLP: number;
      salidasUnidades: number;
      salidasMontoCLP: number;
    }>(`
      SELECT
        COUNT(*) AS totalMovimientos,
        COALESCE(SUM(CASE WHEN tipo = 'IN' THEN cantidad ELSE 0 END), 0) AS entradasUnidades,
        COALESCE(SUM(CASE WHEN tipo = 'IN' THEN cantidad * precio_unitario ELSE 0 END), 0) AS entradasMontoCLP,
        COALESCE(SUM(CASE WHEN tipo = 'OUT' THEN cantidad ELSE 0 END), 0) AS salidasUnidades,
        COALESCE(SUM(CASE WHEN tipo = 'OUT' THEN cantidad * precio_unitario ELSE 0 END), 0) AS salidasMontoCLP
      FROM movimientos
    `),
    db.getAllAsync<{
      codigo: string;
      nombre: string;
      stock: number;
      precio: number;
      valorTotal: number;
    }>(`
      SELECT
        codigo,
        nombre,
        stock,
        precio,
        (stock * precio) AS valorTotal
      FROM productos
      ORDER BY valorTotal DESC, stock DESC
      LIMIT 5
    `),
  ]);

  const skusAgotados = aggProd?.skusAgotados ?? 0;
  const skusBajoMinimo = aggProd?.skusBajoMinimo ?? 0;

  return {
    totalSkus: aggProd?.totalSkus ?? 0,
    unidadesTotales: aggProd?.unidadesTotales ?? 0,
    skusCriticos: skusAgotados + skusBajoMinimo,
    skusAgotados,
    skusBajoMinimo,
    skusOptimos: aggProd?.skusOptimos ?? 0,
    valorInventarioCLP: aggProd?.valorInventarioCLP ?? 0,
    entradasUnidades: aggMov?.entradasUnidades ?? 0,
    entradasMontoCLP: aggMov?.entradasMontoCLP ?? 0,
    salidasUnidades: aggMov?.salidasUnidades ?? 0,
    salidasMontoCLP: aggMov?.salidasMontoCLP ?? 0,
    totalMovimientos: aggMov?.totalMovimientos ?? 0,
    topValorizados: top,
  };
}

/**
 * Carga un lote ficticio con códigos de dígito verificador válido cuando la
 * bodega está vacía y el usuario desea probar el dashboard y la exportación
 * inmediatamente.
 */
export async function sembrarCatalogoDemo(db: SQLiteDatabase): Promise<void> {
  const muestras: Array<{
    codigo: string;
    nombre: string;
    stock: number;
    minimo: number;
    precio: number;
    salidasDemo: number;
  }> = [
    { codigo: '4006381333931', nombre: 'Destacador Escolar Amarillo', stock: 24, minimo: 6, precio: 1290, salidasDemo: 8 },
    { codigo: '5012345670003', nombre: 'Café Tostado Molido 250 g', stock: 3, minimo: 5, precio: 4890, salidasDemo: 9 },
    { codigo: '0036000291452', nombre: 'Pañuelos Desechables Pack x6', stock: 0, minimo: 4, precio: 2190, salidasDemo: 6 },
    { codigo: '7801610001622', nombre: 'Bebida Cola Retornable 2 L', stock: 18, minimo: 8, precio: 1950, salidasDemo: 12 },
    { codigo: '7802900001018', nombre: 'Arroz Grado 1 Selección 1 kg', stock: 4, minimo: 6, precio: 1690, salidasDemo: 10 },
  ];

  await db.withExclusiveTransactionAsync(async (tx) => {
    const ahora = Date.now();
    for (let idx = 0; idx < muestras.length; idx++) {
      const m = muestras[idx];
      if (!m) continue;
      const yaExiste = await tx.getFirstAsync<{ codigo: string }>(
        'SELECT codigo FROM productos WHERE codigo = ?',
        m.codigo
      );
      if (yaExiste) continue;

      const stockInicial = m.stock + m.salidasDemo;
      await tx.runAsync(
        `INSERT INTO productos (codigo, nombre, stock, minimo, precio, creado_en)
         VALUES (?, ?, ?, ?, ?, ?)`,
        m.codigo,
        m.nombre,
        m.stock,
        m.minimo,
        m.precio,
        ahora - (idx + 1) * 3_600_000
      );
      await tx.runAsync(
        `INSERT INTO movimientos (codigo, tipo, cantidad, precio_unitario, nota, fecha)
         VALUES (?, 'IN', ?, ?, 'Recepción proveedor', ?)`,
        m.codigo,
        stockInicial,
        m.precio,
        ahora - (idx + 1) * 3_500_000
      );
      if (m.salidasDemo > 0) {
        await tx.runAsync(
          `INSERT INTO movimientos (codigo, tipo, cantidad, precio_unitario, nota, fecha)
           VALUES (?, 'OUT', ?, ?, 'Despacho mostrador', ?)`,
          m.codigo,
          m.salidasDemo,
          m.precio,
          ahora - idx * 900_000
        );
      }
    }
  });
}
