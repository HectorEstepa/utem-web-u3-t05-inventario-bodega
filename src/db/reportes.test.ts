import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import XLSX from 'xlsx-js-style';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrar } from './schema.ts';
import { contarMovimientos, listarMovimientosGlobales, obtenerResumenEjecutivo } from './inventario.ts';
import { cargarDatosReporte } from './reportes.ts';
import { resolverPeriodo, TODO_EL_HISTORIAL } from '../lib/periodo.ts';
import { crearLibroReporte } from '../lib/reporteExcel.ts';

function base() {
  const sql = new DatabaseSync(':memory:');
  const db = {
    async execAsync(q: string) { sql.exec(q); },
    async getFirstAsync(q: string, ...p: (string | number)[]) { return sql.prepare(q).get(...p) ?? null; },
    async getAllAsync(q: string, ...p: (string | number)[]) { return sql.prepare(q).all(...p); },
    async runAsync(q: string, ...p: (string | number)[]) { return sql.prepare(q).run(...p); },
    async withExclusiveTransactionAsync(f: (tx: unknown) => Promise<void>) {
      sql.exec('BEGIN'); try { await f(db); sql.exec('COMMIT'); } catch (e) { sql.exec('ROLLBACK'); throw e; }
    },
  };
  return { sql, db: db as unknown as SQLiteDatabase };
}
const periodo = resolverPeriodo({ modo: 'rango', desde: '2026-11-01', hasta: '2026-11-30' });

test('totales y reporte respetan inicio inclusivo/fin exclusivo sin cambiar stock actual', async () => {
  const { sql, db } = base();
  try {
    await migrar(db);
    const codigo = '0036000291452';
    sql.prepare('INSERT INTO productos VALUES (?, ?, ?, ?, ?, ?)').run(codigo, '=Producto literal', 8, 5, 2000, 1);
    const insertar = sql.prepare('INSERT INTO movimientos(codigo,tipo,cantidad,precio_unitario,nota,fecha) VALUES(?,?,?,?,?,?)');
    insertar.run(codigo, 'IN', 100, 100, 'Antes', periodo.desde! - 1);
    insertar.run(codigo, 'IN', 10, 1000, 'Recepción', periodo.desde!);
    insertar.run(codigo, 'OUT', 2, 1500, 'Despacho', periodo.hasta! - 1);
    insertar.run(codigo, 'OUT', 99, 100, 'Después', periodo.hasta!);
    const r = await obtenerResumenEjecutivo(db, periodo);
    assert.equal(r.entradasUnidades, 10); assert.equal(r.salidasUnidades, 2);
    assert.equal(r.entradasMontoCLP, 10000); assert.equal(r.salidasMontoCLP, 3000);
    assert.equal(r.unidadesTotales, 8); assert.equal(r.valorInventarioCLP, 16000);
    const d = await cargarDatosReporte(db, periodo);
    assert.equal(d.movimientos.length, 2); assert.equal(d.porProducto[0]?.entradas, 10);
    assert.equal(d.porProducto[0]?.salidas, 2);
    assert.equal(d.porDia[0]?.dia, '2026-11-01');
    assert.equal(d.porDia.at(-1)?.dia, '2026-11-30');
    assert.equal(d.porDia.reduce((a, x) => a + x.entradas, 0), 10);
    assert.equal(d.porDia.reduce((a, x) => a + x.salidas, 0), 2);
    const libro = crearLibroReporte(d);
    const bytes = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
    const leido = XLSX.read(bytes, { type: 'buffer', cellStyles: true });
    assert.deepEqual(leido.SheetNames, ['Resumen', 'Inventario_actual', 'Por_producto', 'Por_dia_producto', 'Movimientos']);
    assert.equal(leido.Sheets.Inventario_actual?.A7?.v, codigo, 'conserva cero inicial');
    assert.equal(leido.Sheets.Inventario_actual?.B7?.t, 's', 'nombre que empieza por = no es fórmula');
    assert.equal(leido.Sheets.Inventario_actual?.G7?.v, 16000, 'fórmula tiene valor almacenado para visores sin cálculo');
    assert.equal(leido.Sheets.Movimientos?.I7?.v, 3000);
    assert.equal(leido.Sheets.Movimientos?.D7?.v, 'SALIDA');
    assert.match(String(leido.Sheets.Por_producto?.A2?.v), /2026/);
  } finally { sql.close(); }
});

test('paginación estable con fechas iguales y filtros por tipo, producto y búsqueda', async () => {
  const { sql, db } = base();
  try {
    await migrar(db);
    sql.exec("INSERT INTO productos VALUES ('4006381333931','Arroz',100,5,1000,1)");
    const insertar = sql.prepare("INSERT INTO movimientos(codigo,tipo,cantidad,precio_unitario,nota,fecha) VALUES ('4006381333931',?,1,1000,?,?)");
    for (let i = 0; i < 125; i++) insertar.run(i % 2 === 0 ? 'IN' : 'OUT', i === 5 ? 'OC especial' : '', periodo.desde!);
    let cursor: { fecha: number; id: number } | undefined;
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) {
      const pagina = await listarMovimientosGlobales(db, { periodo, limite: 50, antesDe: cursor });
      ids.push(...pagina.map((m) => m.id));
      const ultimo = pagina.at(-1)!; cursor = { fecha: ultimo.fecha, id: ultimo.id };
    }
    assert.equal(ids.length, 125); assert.equal(new Set(ids).size, 125);
    assert.equal(await contarMovimientos(db, { tipo: 'OUT', periodo }), 62);
    assert.equal(await contarMovimientos(db, { codigo: 'otro', periodo }), 0);
    assert.equal(await contarMovimientos(db, { busqueda: 'especial', periodo }), 1);
    assert.equal(await contarMovimientos(db, { busqueda: 'Arroz', periodo }), 125);
    assert.equal((await cargarDatosReporte(db, resolverPeriodo({ modo: 'rango', desde: '2027-01-01', hasta: '2027-01-01' }))).movimientos.length, 0);
  } finally { sql.close(); }
});

test('no trunca reportes por encima del límite y libera la transacción tras rechazar', async () => {
  const { sql, db } = base();
  try {
    await migrar(db);
    sql.exec("INSERT INTO productos VALUES ('4006381333931','Prueba',0,5,1,1)");
    sql.exec("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<20001) INSERT INTO movimientos(codigo,tipo,cantidad,precio_unitario,nota,fecha) SELECT '4006381333931','IN',1,1,'',x FROM n");
    await assert.rejects(cargarDatosReporte(db, TODO_EL_HISTORIAL), /20.000/);
    assert.equal(await contarMovimientos(db), 20001);
    assert.equal((await cargarDatosReporte(db, periodo)).movimientos.length, 0);
  } finally { sql.close(); }
});
