import React from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { TOQUE_MINIMO, useTema } from '../theme';

/**
 * Barra superior estilo iOS Navigation Bar con botón "‹ Volver" de 48 pt
 * siempre accesible, incluso con el teclado numérico abierto, y acción
 * opcional a la derecha (ej. "Ocultar teclado").
 */
export function BarraSubpantalla({
  titulo,
  subtitulo,
  onVolver,
  textoVolver = 'Volver',
  mostrarCerrarTeclado = false,
}: {
  titulo: string;
  subtitulo?: string;
  onVolver: () => void;
  textoVolver?: string;
  mostrarCerrarTeclado?: boolean;
}) {
  const { paleta } = useTema();

  return (
    <View
      style={[
        s.barra,
        {
          backgroundColor: paleta.superficie,
          borderBottomColor: paleta.separador,
        },
      ]}
    >
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          onVolver();
        }}
        accessibilityRole="button"
        accessibilityLabel={textoVolver}
        hitSlop={10}
        style={({ pressed }) => [s.btnVolver, pressed && { opacity: 0.6 }]}
      >
        <Text style={[s.flecha, { color: paleta.acento }]}>‹</Text>
        <Text style={[s.txtVolver, { color: paleta.acento }]}>{textoVolver}</Text>
      </Pressable>

      <View style={s.centro} pointerEvents="none">
        <Text style={[s.titulo, { color: paleta.texto }]} numberOfLines={1}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={[s.subtitulo, { color: paleta.textoTerciario }]} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>

      <View style={s.derecha}>
        {mostrarCerrarTeclado ? (
          <Pressable
            onPress={() => Keyboard.dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Ocultar teclado"
            hitSlop={10}
            style={({ pressed }) => [s.btnDerecha, pressed && { opacity: 0.6 }]}
          >
            <Text style={[s.txtDerecha, { color: paleta.acento }]}>Listo</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  barra: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  btnVolver: {
    minHeight: TOQUE_MINIMO,
    minWidth: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
  },
  flecha: {
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 28,
    marginTop: -2,
  },
  txtVolver: {
    fontSize: 16,
    fontWeight: '600',
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitulo: {
    fontSize: 11,
    marginTop: 1,
  },
  derecha: {
    minWidth: 82,
    alignItems: 'flex-end',
  },
  btnDerecha: {
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  txtDerecha: {
    fontSize: 16,
    fontWeight: '700',
  },
});
