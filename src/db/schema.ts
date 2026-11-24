import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Esquema y migraciones de la base local.
 *
 * Decisión de rendimiento: el stock se guarda como columna en `productos`
 * y además queda la bitácora completa en `movimientos`. Calcular el stock
 * con SUM() sobre la bitácora en cada render sería O(movimientos) y crece
 * para siempre; la columna se lee en O(1). La consistencia entre ambas se
 * garantiza porque todo movimiento se escribe dentro de una transacción
 * junto con el UPDATE del stock.
 *
 * El CHECK(stock >= 0) es la última línea de defensa: aunque la interfaz
 * falle, el motor rechaza un stock negativo.
 */

export const VERSION_ESQUEMA = 1;

export async function migrar(db: SQLiteDatabase): Promise<void> {
  // WAL mejora el rendimiento general de escritura y permite leer mientras
  // se escribe, que es justo lo que pasa al registrar un movimiento con la
  // lista abierta detrás. Recomendado por la documentación de expo-sqlite.
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const actual = fila?.user_version ?? 0;
  if (actual >= VERSION_ESQUEMA) return;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS productos (
      codigo      TEXT    PRIMARY KEY,
      nombre      TEXT    NOT NULL,
      stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      minimo      INTEGER NOT NULL DEFAULT 5 CHECK (minimo >= 0),
      creado_en   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movimientos (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo   TEXT    NOT NULL REFERENCES productos(codigo) ON DELETE CASCADE,
      tipo     TEXT    NOT NULL CHECK (tipo IN ('IN','OUT')),
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      fecha    INTEGER NOT NULL
    );

    -- Sin este índice, el historial de un producto obliga a recorrer la
    -- tabla completa. Con 20.000 movimientos eso se nota en pantalla.
    CREATE INDEX IF NOT EXISTS idx_mov_codigo ON movimientos(codigo, fecha DESC);

    -- El filtro de stock bajo compara stock contra minimo, así que un índice
    -- por stock acelera el orden de la lista cuando hay miles de productos.
    CREATE INDEX IF NOT EXISTS idx_prod_stock ON productos(stock);
  `);

  await db.execAsync(`PRAGMA user_version = ${VERSION_ESQUEMA}`);
}
