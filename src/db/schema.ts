import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Esquema y migraciones incrementales de la base local SQLite.
 *
 * Decisiones de rendimiento y consistencia:
 * 1. El stock se guarda como columna en `productos` (lectura directa del saldo) y además
 *    queda la bitácora completa en `movimientos` sincronizada en transacción
 *    exclusiva, evitando `SUM()` lineal sobre miles de eventos históricos.
 * 2. Los precios en pesos chilenos (`precio` y `precio_unitario`) se guardan
 *    como `INTEGER` no negativos, nunca coma flotante. `precio_unitario` en
 *    `movimientos` congela el valor vigente al instante de la entrada/salida
 *    para que cambiar un precio mañana no altere la contabilidad histórica.
 * 3. `PRAGMA user_version` permite migrar de v1/v2/v3 → v4 atómicamente sin
 *    perder los productos que el usuario ya tenía registrados en el teléfono.
 */

export const VERSION_ESQUEMA = 4;

export async function migrar(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const actual = fila?.user_version ?? 0;
  if (actual > VERSION_ESQUEMA) {
    throw new Error('La bodega pertenece a una versión más reciente. Actualiza la app para abrirla.');
  }
  if (actual === VERSION_ESQUEMA) return;

  // El esquema y su versión se confirman juntos; un fallo permite reintentar.
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (actual < 1) {
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS productos (
          codigo      TEXT    PRIMARY KEY,
          nombre      TEXT    NOT NULL,
          stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
          minimo      INTEGER NOT NULL DEFAULT 5 CHECK (minimo >= 0),
          precio      INTEGER NOT NULL DEFAULT 0 CHECK (precio >= 0),
          creado_en   INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS movimientos (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo          TEXT    NOT NULL REFERENCES productos(codigo) ON DELETE CASCADE,
          tipo            TEXT    NOT NULL CHECK (tipo IN ('IN','OUT')),
          cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
          precio_unitario INTEGER NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0),
          nota            TEXT    NOT NULL DEFAULT '',
          fecha           INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_mov_codigo ON movimientos(codigo, fecha DESC);
        CREATE INDEX IF NOT EXISTS idx_mov_fecha ON movimientos(fecha DESC);
        CREATE INDEX IF NOT EXISTS idx_prod_stock ON productos(stock);
      `);
    } else if (actual === 1) {
      // Migración no destructiva desde v1: conserva todo el inventario previo.
      await tx.execAsync(`
        ALTER TABLE productos ADD COLUMN precio INTEGER NOT NULL DEFAULT 0 CHECK (precio >= 0);
        ALTER TABLE movimientos ADD COLUMN precio_unitario INTEGER NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0);
        ALTER TABLE movimientos ADD COLUMN nota TEXT NOT NULL DEFAULT '';
        CREATE INDEX IF NOT EXISTS idx_mov_fecha ON movimientos(fecha DESC);
      `);
    }

    if (actual < 3) {
      const secuencia = await tx.getFirstAsync<{ seq: number }>("SELECT seq FROM sqlite_sequence WHERE name = 'movimientos'");
      // SQLite no permite ampliar un CHECK con ALTER: copia atómica y conserva IDs.
      await tx.execAsync(`
        CREATE TABLE movimientos_v3 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo TEXT NOT NULL REFERENCES productos(codigo) ON DELETE CASCADE,
          tipo TEXT NOT NULL CHECK(tipo IN ('IN','OUT','ADJ')),
          cantidad INTEGER NOT NULL CHECK(cantidad > 0),
          precio_unitario INTEGER NOT NULL DEFAULT 0 CHECK(precio_unitario >= 0),
          nota TEXT NOT NULL DEFAULT '', fecha INTEGER NOT NULL,
          stock_antes INTEGER, stock_despues INTEGER,
          CHECK(tipo != 'ADJ' OR (stock_antes IS NOT NULL AND stock_despues IS NOT NULL
            AND stock_antes >= 0 AND stock_despues >= 0
            AND cantidad = abs(stock_despues - stock_antes) AND length(trim(nota)) > 0))
        );
        INSERT INTO movimientos_v3(id,codigo,tipo,cantidad,precio_unitario,nota,fecha)
          SELECT id,codigo,tipo,cantidad,precio_unitario,nota,fecha FROM movimientos;
        DROP TABLE movimientos;
        ALTER TABLE movimientos_v3 RENAME TO movimientos;
        CREATE INDEX idx_mov_codigo ON movimientos(codigo,fecha DESC);
        CREATE INDEX idx_mov_fecha ON movimientos(fecha DESC);
      `);
      if (secuencia) await tx.runAsync("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'movimientos'", secuencia.seq);
    }
    // Conserva la cantidad original; las consultas operativas usan la rectificada.
    await tx.execAsync(`
      ALTER TABLE movimientos ADD COLUMN cantidad_corregida INTEGER CHECK(cantidad_corregida >= 0);
      ALTER TABLE movimientos ADD COLUMN entrada_corregida_id INTEGER REFERENCES movimientos(id) ON DELETE CASCADE;
      ALTER TABLE movimientos ADD COLUMN entrada_cantidad_antes INTEGER;
      ALTER TABLE movimientos ADD COLUMN entrada_cantidad_despues INTEGER;
    `);
    await tx.execAsync(`PRAGMA user_version = ${VERSION_ESQUEMA}`);
  });
}
