/**
 * Estado de stock, reglas de negocio y formateo monetario en pesos chilenos (CLP).
 *
 * Decisiones de ingeniería:
 * 1. El estado ('agotado' | 'bajo' | 'ok') es derivado en memoria, nunca columna
 *    persistida, evitando desincronización con el saldo real.
 * 2. Los montos en pesos chilenos se manejan siempre como enteros no negativos
 *    (INTEGER), eliminando errores de coma flotante IEEE 754 al valorizar miles
 *    de movimientos.
 */

export type EstadoStock = 'agotado' | 'bajo' | 'ok';

export interface ProductoBase {
  stock: number;
  minimo: number;
}

export function estadoDeStock({ stock, minimo }: ProductoBase): EstadoStock {
  if (stock <= 0) return 'agotado';
  if (stock <= minimo) return 'bajo';
  return 'ok';
}

/**
 * El color nunca es el único portador de significado: cada estado combina
 * símbolo y texto explícito para accesibilidad y lectura rápida en bodega.
 */
export const ETIQUETA_ESTADO: Record<EstadoStock, { texto: string; icono: string }> = {
  agotado: { texto: 'AGOTADO', icono: '✕' },
  bajo: { texto: 'STOCK BAJO', icono: '!' },
  ok: { texto: 'EN STOCK', icono: '✓' },
};

export function validarMovimiento(
  tipo: 'IN' | 'OUT',
  cantidad: number,
  stockActual: number
): string | null {
  if (!Number.isInteger(cantidad)) return 'La cantidad debe ser un número entero.';
  if (cantidad <= 0) return 'La cantidad debe ser mayor que cero.';
  if (cantidad > 99999) return 'La cantidad supera el máximo permitido (99.999).';
  if (tipo === 'OUT' && cantidad > stockActual) {
    return `No puedes despachar ${cantidad}: solo hay ${stockActual} en bodega.`;
  }
  return null;
}

export function validarPrecio(precio: number): string | null {
  if (!Number.isInteger(precio)) return 'El precio debe ser un monto entero en pesos (CLP).';
  if (precio < 0) return 'El precio no puede ser negativo.';
  if (precio > 99_999_999) return 'El precio supera el máximo permitido ($99.999.999).';
  return null;
}

/**
 * Formatea un entero en CLP con separador de miles chileno ($12.990) sin
 * depender de configuraciones regionales incompletas en motores antiguos.
 */
export function formatearCLP(monto: number): string {
  const entero = Math.round(Number.isFinite(monto) ? monto : 0);
  const signo = entero < 0 ? '-' : '';
  const abs = Math.abs(entero)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}$${abs}`;
}
