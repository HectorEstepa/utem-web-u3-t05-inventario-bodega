import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrar } from './schema.ts';
import {
  actualizarProducto, buscarPorCodigo, crearProducto, historial, listarProductos,
  obtenerResumenEjecutivo, registrarMovimiento, sembrarCatalogoDemo,
} from './inventario.ts';
import { esGtinValido } from '../lib/gtin.ts';

// Ejecuta las funciones de producción contra SQLite real de Node.
// Este adaptador cubre SQL, transacciones y disco; no sustituye el puente nativo de Expo.
function adaptar(sql: DatabaseSync) {
  const db = {
    async execAsync(query: string) { sql.exec(query); },
    async getFirstAsync(query: string, ...params: (string | number)[]) {
      return sql.prepare(query).get(...params) ?? null;
    },
    async getAllAsync(query: string, ...params: (string | number)[]) {
      return sql.prepare(query).all(...params);
    },
    async runAsync(query: string, ...params: (string | number)[]) {
      return sql.prepare(query).run(...params);
    },
    async withExclusiveTransactionAsync(task: (tx: unknown) => Promise<void>) {
      sql.exec('BEGIN IMMEDIATE');
      try {
        await task(db);
        sql.exec('COMMIT');
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return db as unknown as SQLiteDatabase;
}

const ficha = { codigo: '4006381333931', nombre: 'Producto de prueba', stockInicial: 10, minimo: 5, precio: 1290 };

test('persiste alta, entrada, salida e historial al cerrar y reabrir el archivo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bodega-'));
  const archivo = join(dir, 'bodega.db');
  let sql = new DatabaseSync(archivo);
  try {
    let db = adaptar(sql);
    await migrar(db);
    await migrar(db); // inicialización repetida sin pérdida de datos
    await crearProducto(db, ficha);
    assert.equal(await registrarMovimiento(db, ficha.codigo, 'IN', 3), 13);
    await actualizarProducto(db, { ...ficha, minimo: 5, precio: 1500 });
    assert.equal(await registrarMovimiento(db, ficha.codigo, 'OUT', 8), 5);
    await assert.rejects(registrarMovimiento(db, ficha.codigo, 'OUT', 6), /solo hay 5/);
    const resumen = await obtenerResumenEjecutivo(db);
    assert.equal(resumen.totalMovimientos, 3);
    assert.equal(resumen.skusCriticos, 1);
    assert.equal(resumen.entradasMontoCLP, 13 * 1290);
    assert.equal(resumen.salidasMontoCLP, 8 * 1500);
    sql.close();
    sql = new DatabaseSync(archivo);
    db = adaptar(sql);
    await migrar(db);
    assert.equal((await buscarPorCodigo(db, ficha.codigo))?.stock, 5);
    assert.equal((await historial(db, ficha.codigo)).length, 3);
    assert.equal((await listarProductos(db, { filtroEstado: 'bajo' })).length, 1);
    assert.equal((await listarProductos(db, { filtroEstado: 'agotado' })).length, 0);
  } finally {
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rechaza datos inválidos y códigos duplicados antes de alterar el inventario', async () => {
  const sql = new DatabaseSync(':memory:');
  const db = adaptar(sql);
  try {
    await migrar(db);
    for (const cambio of [
      { stockInicial: -1 }, { stockInicial: 1.5 }, { stockInicial: NaN },
      { minimo: 0 }, { minimo: 2.5 }, { minimo: Infinity }, { precio: -1 },
      { codigo: '4006381333932' }, { nombre: '   ' },
    ]) {
      await assert.rejects(crearProducto(db, { ...ficha, ...cambio }));
    }
    await crearProducto(db, { ...ficha, codigo: '036000291452' });
    await assert.rejects(crearProducto(db, { ...ficha, codigo: '0036000291452' }), /UNIQUE/);
    assert.equal((await listarProductos(db)).length, 1);
    assert.equal((await buscarPorCodigo(db, '0036000291452'))?.stock, 10);
  } finally { sql.close(); }
});

test('revierte el saldo si falla la escritura del movimiento', async () => {
  const sql = new DatabaseSync(':memory:');
  const db = adaptar(sql);
  try {
    await migrar(db);
    await crearProducto(db, ficha);
    sql.exec("CREATE TRIGGER fallo BEFORE INSERT ON movimientos BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END");
    await assert.rejects(registrarMovimiento(db, ficha.codigo, 'OUT', 2), /fallo simulado/);
    assert.equal((await buscarPorCodigo(db, ficha.codigo))?.stock, 10);
    assert.equal((await historial(db, ficha.codigo)).length, 1);
  } finally { sql.close(); }
});

test('migra v1 sin perder productos ni historial y revierte una migración interrumpida', async () => {
  const sql = new DatabaseSync(':memory:');
  const db = adaptar(sql);
  try {
    sql.exec(`
      CREATE TABLE productos (codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL, stock INTEGER NOT NULL, minimo INTEGER NOT NULL, creado_en INTEGER NOT NULL);
      CREATE TABLE movimientos (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT REFERENCES productos(codigo), tipo TEXT, cantidad INTEGER, fecha INTEGER);
      INSERT INTO productos VALUES ('4006381333931', 'Anterior', 3, 5, 1);
      INSERT INTO movimientos (codigo,tipo,cantidad,fecha) VALUES ('4006381333931','IN',3,1);
      PRAGMA user_version = 1;
      CREATE INDEX idx_mov_fecha ON movimientos(fecha DESC);
    `);
    const fallando = adaptar(sql);
    const transaccion = fallando.withExclusiveTransactionAsync.bind(fallando);
    fallando.withExclusiveTransactionAsync = (task) => transaccion(async (tx) => {
      await task(tx);
      throw new Error('corte simulado');
    });
    await assert.rejects(migrar(fallando), /corte simulado/);
    assert.equal(sql.prepare('PRAGMA user_version').get()?.user_version, 1);
    assert.ok(!sql.prepare('PRAGMA table_info(productos)').all().some((col) => col.name === 'precio'));
    await migrar(db);
    assert.equal((await buscarPorCodigo(db, ficha.codigo))?.precio, 0);
    assert.equal((await historial(db, ficha.codigo))[0]?.cantidad, 3);
    sql.exec('PRAGMA user_version = 99');
    await assert.rejects(migrar(db), /versión más reciente/);
  } finally { sql.close(); }
});

test('catálogo demo usa dígitos válidos y conserva saldos e historial al repetirse', async () => {
  const sql = new DatabaseSync(':memory:');
  const db = adaptar(sql);
  try {
    await migrar(db);
    await sembrarCatalogoDemo(db);
    const antes = await obtenerResumenEjecutivo(db);
    await sembrarCatalogoDemo(db);
    assert.deepEqual(await obtenerResumenEjecutivo(db), antes);
    const productos = await listarProductos(db);
    assert.equal(productos.length, 5);
    assert.ok(productos.every((p) => esGtinValido(p.codigo)));
    for (const p of productos) {
      const movs = await historial(db, p.codigo);
      assert.equal(movs.reduce((saldo, m) => saldo + (m.tipo === 'IN' ? m.cantidad : -m.cantidad), 0), p.stock);
    }
  } finally { sql.close(); }
});
