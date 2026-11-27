import React from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { TOQUE_MINIMO, useTema } from '../theme';

type Estilo = 'primario' | 'secundario' | 'peligro' | 'exito' | 'salida' | 'fantasma';

export function Boton({
  titulo,
  onPress,
  estilo = 'primario',
  deshabilitado = false,
  ancho,
  compacto = false,
}: {
  titulo: string;
  onPress: () => void;
  estilo?: Estilo;
  deshabilitado?: boolean;
  ancho?: ViewStyle['width'];
  compacto?: boolean;
}) {
  const { paleta } = useTema();

  const fondo: Record<Estilo, string> = {
    primario: paleta.acento,
    secundario: paleta.superficieElevada,
    peligro: paleta.rojo,
    exito: paleta.verde,
    salida: paleta.salida,
    fantasma: 'transparent',
  };

  const colorTexto: Record<Estilo, string> = {
    primario: '#FFFFFF',
    secundario: paleta.acento,
    peligro: '#FFFFFF',
    exito: '#FFFFFF',
    salida: paleta.oscura ? '#22123D' : '#FFFFFF',
    fantasma: paleta.acento,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => [
        s.base,
        compacto ? s.compacto : null,
        { backgroundColor: fondo[estilo], width: ancho },
        estilo === 'secundario' && { borderWidth: 1, borderColor: paleta.borde },
        deshabilitado && { opacity: 0.42 },
        pressed && !deshabilitado && { opacity: 0.76, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Text style={[s.texto, compacto && s.textoCompacto, { color: colorTexto[estilo] }]}>
        {titulo}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: {
    minHeight: TOQUE_MINIMO,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compacto: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 11,
  },
  texto: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  textoCompacto: {
    fontSize: 14,
    fontWeight: '600',
  },
});
