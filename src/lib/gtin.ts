/**
 * Validación de códigos GTIN (EAN-13, EAN-8, UPC-A) con dígito verificador.
 *
 * Por qué existe este archivo:
 * un lector de cámara entrega lecturas corruptas cuando el código está arrugado,
 * con poca luz o parcialmente tapado. Validar el dígito verificador en memoria
 * evita una consulta a SQLite por cada
 * lectura basura. Con el escáner disparando varias veces por segundo, filtrar
 * acá mantiene el hilo principal libre para dibujar.
 *
 * Algoritmo GS1 (módulo 10):
 *   1. Desde el dígito a la izquierda del verificador, hacia la izquierda,
 *      se multiplica alternadamente por 3 y por 1.
 *   2. Se suman los productos.
 *   3. El verificador es lo que falta para llegar al siguiente múltiplo de 10.
 * Fuente: GS1, "How to calculate a check digit manually".
 */

export type GtinLength = 8 | 12 | 13;

const LARGOS_VALIDOS: readonly number[] = [8, 12, 13];

/** Calcula el dígito verificador de un código SIN su último dígito. */
export function calcularDigitoVerificador(cuerpo: string): number | null {
  if (!/^\d+$/.test(cuerpo)) return null;
  // El peso depende de la posición contada DESDE LA DERECHA, no desde la
  // izquierda: por eso se invierte antes de recorrer.
  const suma = cuerpo
    .split('')
    .map(Number)
    .reverse()
    .reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10;
}

/** true solo si el código tiene largo GTIN válido y su dígito verificador cuadra. */
export function esGtinValido(codigo: string): boolean {
  if (!/^\d+$/.test(codigo)) return false;
  if (!LARGOS_VALIDOS.includes(codigo.length)) return false;
  const cuerpo = codigo.slice(0, -1);
  const verificador = Number(codigo.slice(-1));
  return calcularDigitoVerificador(cuerpo) === verificador;
}

/**
 * Normaliza a 13 dígitos para que un mismo producto no quede duplicado
 * según el simbolismo que se haya leído. Un UPC-A de 12 dígitos y su
 * EAN-13 equivalente son el mismo producto con un cero adelante.
 */
export function normalizarGtin(codigo: string): string {
  const limpio = codigo.trim();
  if (limpio.length === 12) return '0' + limpio;
  return limpio;
}

export type ResultadoLectura =
  | { ok: true; codigo: string }
  | { ok: false; motivo: 'formato' | 'verificador'; codigo: string };

/** Punto de entrada único del escáner: valida y normaliza en un solo paso. */
export function procesarLectura(bruto: string): ResultadoLectura {
  const limpio = bruto.trim();
  if (!/^\d+$/.test(limpio) || !LARGOS_VALIDOS.includes(limpio.length)) {
    return { ok: false, motivo: 'formato', codigo: limpio };
  }
  if (!esGtinValido(limpio)) {
    return { ok: false, motivo: 'verificador', codigo: limpio };
  }
  return { ok: true, codigo: normalizarGtin(limpio) };
}
