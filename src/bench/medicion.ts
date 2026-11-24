import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Medición M1: búsqueda de un producto por código en una bodega de 5.000
 * productos, comparando SQLite con índice contra AsyncStorage con un arreglo
 * JSON. Es la evidencia de la decisión de arquitectura: AsyncStorage obliga
 * a leer y parsear el arreglo completo en cada búsqueda, mientras SQLite
 * resuelve por PRIMARY KEY.
 *
 * Se ejecuta DENTRO de la app, en el teléfono físico y con build de
 * release. Medir esto en el emulador o en modo desarrollo da números que no
 * corresponden a lo que vive el usuario.
 */

export const N_PRODUCTOS = 5000;
const REPETICIONES = 30;
const CLAVE_AS = 'bench_productos';

function codigoSintetico(i: number): string {
  // Códigos sintéticos de 13 dígitos. No son GTIN reales ni se validan:
  // la medición compara el costo de la búsqueda, no el del parseo.
  return String(7800000000000 + i);
}

function percentil(valores: number[], p: number): number {
  const orden = [...valores].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1);
  return orden[Math.max(0, i)] ?? 0;
}

export interface ResultadoBench {
  motor: 'SQLite' | 'AsyncStorage';
  p50: number;
  p95: number;
  peor: number;
  muestras: number;
}

async function sembrarSQLite(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS bench_productos');
  await db.execAsync(
    'CREATE TABLE bench_productos (codigo TEXT PRIMARY KEY, nombre TEXT, stock INTEGER)'
  );
  // Una sola transacción para 5.000 INSERT: sin ella, cada INSERT confirma
  // en disco por separado y la siembra tarda minutos en vez de segundos.
  await db.withExclusiveTransactionAsync(async (tx) => {
    const stmt = await tx.prepareAsync(
      'INSERT INTO bench_productos (codigo, nombre, stock) VALUES (?, ?, ?)'
    );
    try {
      for (let i = 0; i < N_PRODUCTOS; i++) {
        await stmt.executeAsync(codigoSintetico(i), `Producto ${i}`, i % 50);
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
}

async function sembrarAsyncStorage(): Promise<void> {
  const arreglo = Array.from({ length: N_PRODUCTOS }, (_, i) => ({
    codigo: codigoSintetico(i),
    nombre: `Producto ${i}`,
    stock: i % 50,
  }));
  await AsyncStorage.setItem(CLAVE_AS, JSON.stringify(arreglo));
}

export async function medirSQLite(db: SQLiteDatabase): Promise<ResultadoBench> {
  const t: number[] = [];
  for (let r = 0; r < REPETICIONES; r++) {
    // Un código distinto en cada repetición: buscar siempre el mismo
    // mediría la caché de páginas de SQLite, no la búsqueda.
    const objetivo = codigoSintetico(Math.floor((r * 997) % N_PRODUCTOS));
    const t0 = performance.now();
    await db.getFirstAsync('SELECT * FROM bench_productos WHERE codigo = ?', objetivo);
    t.push(performance.now() - t0);
  }
  return { motor: 'SQLite', p50: percentil(t, 50), p95: percentil(t, 95), peor: Math.max(...t), muestras: t.length };
}

export async function medirAsyncStorage(): Promise<ResultadoBench> {
  const t: number[] = [];
  for (let r = 0; r < REPETICIONES; r++) {
    const objetivo = codigoSintetico(Math.floor((r * 997) % N_PRODUCTOS));
    const t0 = performance.now();
    // Este es el costo real del enfoque: leer la cadena completa, parsearla
    // y recorrer el arreglo. No hay índice posible.
    const crudo = await AsyncStorage.getItem(CLAVE_AS);
    const arreglo = crudo ? (JSON.parse(crudo) as { codigo: string }[]) : [];
    arreglo.find((p) => p.codigo === objetivo);
    t.push(performance.now() - t0);
  }
  return {
    motor: 'AsyncStorage',
    p50: percentil(t, 50),
    p95: percentil(t, 95),
    peor: Math.max(...t),
    muestras: t.length,
  };
}

export async function correrMedicion(db: SQLiteDatabase): Promise<ResultadoBench[]> {
  await sembrarSQLite(db);
  await sembrarAsyncStorage();
  // Una pasada en vacío antes de medir: la primera consulta paga la apertura
  // de la base y el calentamiento del motor de JavaScript.
  await db.getFirstAsync('SELECT * FROM bench_productos LIMIT 1');
  await AsyncStorage.getItem(CLAVE_AS);

  const sqlite = await medirSQLite(db);
  const asyncS = await medirAsyncStorage();
  return [sqlite, asyncS];
}

export async function limpiarMedicion(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS bench_productos');
  await AsyncStorage.removeItem(CLAVE_AS);
}
