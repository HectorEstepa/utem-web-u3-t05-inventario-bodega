export const C = {
  azul: '#0d63a5',
  azulOscuro: '#08497c',
  navy: '#0f2740',
  teal: '#14b8a6',
  verde: '#16a34a',
  ambar: '#f59e0b',
  rojo: '#e11d48',
  gris: '#5b7997',
  linea: '#dbe7f3',
  fondo: '#f2f7fc',
  blanco: '#ffffff',
};

export const ESTADO_COLOR = {
  agotado: C.rojo,
  bajo: C.ambar,
  ok: C.verde,
} as const;

/**
 * 48 dp es el área táctil mínima recomendada por Material Design.
 * En una bodega el usuario toca con guantes o con la mano ocupada,
 * así que ningún botón de acción baja de esta altura.
 */
export const TOQUE_MINIMO = 48;
