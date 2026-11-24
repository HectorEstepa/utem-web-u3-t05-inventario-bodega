/**
 * Estado de stock de un producto.
 *
 * Se calcula a partir del stock y del mínimo, y NO se guarda en la base:
 * es estado derivado. Guardarlo obligaría a recalcularlo en cada movimiento
 * y abriría la puerta a que la columna quede desincronizada del stock real.
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
 * Texto e ícono por estado.
 *
 * El color NO es el único portador de la información: cada estado trae
 * además una etiqueta y un símbolo. Un usuario con daltonismo (cerca del 8%
 * de los hombres) distingue igual "AGOTADO" de "STOCK BAJO", y la pantalla
 * sigue siendo legible bajo la luz de una bodega.
 */
export const ETIQUETA_ESTADO: Record<EstadoStock, { texto: string; icono: string }> = {
  agotado: { texto: 'AGOTADO', icono: '✕' },
  bajo: { texto: 'STOCK BAJO', icono: '!' },
  ok: { texto: 'EN STOCK', icono: '✓' },
};

/**
 * Valida un movimiento antes de tocar la base.
 * Devuelve null si es válido, o el mensaje de error para el usuario.
 */
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
